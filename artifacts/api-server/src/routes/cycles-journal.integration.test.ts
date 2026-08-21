import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../app.js";

type ApiResult<T> = {
  response: Response;
  body: T;
};

type Session = {
  token: string;
  userId: string;
};

type Cycle = {
  id: string;
  cycleName: string | null;
  desiredDose: string;
};

type InjectionEvent = {
  id: string;
  scheduledAt: string;
  plannedDose: string;
  status: string;
};

type JournalEntry = {
  id: string;
  entryType: string;
  body: string | null;
};

let server: Server;
let baseUrl: string;
let sessions: Session[] = [];
let session: Session;

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  return { response, body: await response.json() as T };
}

async function createSession(): Promise<Session> {
  const result = await request<{ token: string; user: { id: string } }>("/api/auth/anonymous", {
    method: "POST",
  });

  expect(result.response.status).toBe(201);
  const created = { token: result.body.token, userId: result.body.user.id };
  sessions.push(created);
  return created;
}

function cyclePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    customCompoundName: "Test compound",
    cycleName: "Baseline cycle",
    desiredDose: 250,
    doseUnit: "mcg",
    calculatedVolumeMl: 0.1,
    calculatedSyringeUnits: 10,
    startDate: "2030-01-01",
    endDate: "2030-01-13",
    scheduleRule: {
      frequencyType: "daily",
      injectionTimes: ["any"],
      timezone: "UTC",
    },
    ...overrides,
  };
}

async function createCycle(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<Cycle> {
  const result = await request<{ cycle: Cycle }>("/api/cycles", {
    method: "POST",
    body: JSON.stringify(cyclePayload(overrides)),
  }, token);

  expect(result.response.status).toBe(201);
  return result.body.cycle;
}

function eventDate(event: InjectionEvent): string {
  return new Date(event.scheduledAt).toISOString().slice(0, 10);
}

async function eventsFor(token: string, cycleId: string): Promise<InjectionEvent[]> {
  const result = await request<{ events: InjectionEvent[] }>(
    `/api/injection-events?cycleId=${cycleId}`,
    {},
    token,
  );
  expect(result.response.status).toBe(200);
  return result.body.events;
}

async function cycleUpdatesFor(token: string, cycleId: string): Promise<JournalEntry[]> {
  const result = await request<{ entries: JournalEntry[] }>(
    `/api/journal?type=cycle_update&cycleId=${cycleId}`,
    {},
    token,
  );
  expect(result.response.status).toBe(200);
  return result.body.entries;
}

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  sessions = [];
  session = await createSession();
});

afterEach(async () => {
  await Promise.allSettled(
    sessions.map(({ token }) => request("/api/auth/account", { method: "DELETE" }, token)),
  );
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

describe("cycle edits", () => {
  it("writes one audit entry for a multi-field change and none for a no-op edit", async () => {
    const cycle = await createCycle(session.token);

    const changed = await request<{ cycle: Cycle }>(`/api/cycles/${cycle.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        cycleName: "Adjusted cycle",
        desiredDose: 300,
        calculatedVolumeMl: 0.12,
        calculatedSyringeUnits: 12,
        applyFrom: "2030-01-06",
      }),
    }, session.token);
    expect(changed.response.status).toBe(200);

    const updatesAfterChange = await cycleUpdatesFor(session.token, cycle.id);
    expect(updatesAfterChange).toHaveLength(1);
    expect(updatesAfterChange[0]?.body).toContain("Cycle name: Baseline cycle → Adjusted cycle");
    expect(updatesAfterChange[0]?.body).toContain("Desired dose:");
    expect(updatesAfterChange[0]?.body).toContain("→ 300");

    const unchanged = await request<{ cycle: Cycle }>(`/api/cycles/${cycle.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        cycleName: "Adjusted cycle",
        desiredDose: 300,
        calculatedVolumeMl: 0.12,
        calculatedSyringeUnits: 12,
      }),
    }, session.token);
    expect(unchanged.response.status).toBe(200);
    expect((await cycleUpdatesFor(session.token, cycle.id))).toHaveLength(1);
  });

  it("keeps scheduled events before the effective date and anchors interval cadence to the cycle start", async () => {
    const cycle = await createCycle(session.token, {
      scheduleRule: {
        frequencyType: "every_x_days",
        intervalDays: 3,
        injectionTimes: ["any"],
        timezone: "UTC",
      },
    });
    const before = await eventsFor(session.token, cycle.id);
    expect(before.map(eventDate)).toEqual([
      "2030-01-01",
      "2030-01-04",
      "2030-01-07",
      "2030-01-10",
      "2030-01-13",
    ]);

    const update = await request(`/api/cycles/${cycle.id}`, {
      method: "PATCH",
      body: JSON.stringify({ desiredDose: 300, applyFrom: "2030-01-06" }),
    }, session.token);
    expect(update.response.status).toBe(200);

    const after = await eventsFor(session.token, cycle.id);
    expect(after.map(eventDate)).toEqual([
      "2030-01-01",
      "2030-01-04",
      "2030-01-07",
      "2030-01-10",
      "2030-01-13",
    ]);
    expect(after.slice(0, 2).map((event) => event.id)).toEqual(before.slice(0, 2).map((event) => event.id));
    expect(after.slice(0, 2).map((event) => Number(event.plannedDose))).toEqual([250, 250]);
    expect(after.slice(2).map((event) => Number(event.plannedDose))).toEqual([300, 300, 300]);
  });

  it("rejects invalid interval and weekly day-count schedules", async () => {
    const invalidInterval = await request<{ error: string }>("/api/cycles", {
      method: "POST",
      body: JSON.stringify(cyclePayload({
        scheduleRule: {
          frequencyType: "every_x_days",
          intervalDays: 0,
          injectionTimes: ["any"],
        },
      })),
    }, session.token);
    expect(invalidInterval.response.status).toBe(400);
    expect(invalidInterval.body.error).toContain("interval");

    const invalidWeekCount = await request<{ error: string }>("/api/cycles", {
      method: "POST",
      body: JSON.stringify(cyclePayload({
        scheduleRule: {
          frequencyType: "times_per_week",
          injectionsPerWeek: 2,
          daysOfWeek: ["monday"],
          injectionTimes: ["any"],
        },
      })),
    }, session.token);
    expect(invalidWeekCount.response.status).toBe(400);
    expect(invalidWeekCount.body.error).toContain("one day for each");
  });
});

describe("cycle update journal entries", () => {
  it("cannot be forged, edited, or deleted", async () => {
    const cycle = await createCycle(session.token);

    const forged = await request<{ error: string }>("/api/journal", {
      method: "POST",
      body: JSON.stringify({
        cycleId: cycle.id,
        entryType: "cycle_update",
        entryDate: "2030-01-02T00:00:00.000Z",
        body: "Forged audit record",
      }),
    }, session.token);
    expect(forged.response.status).toBe(403);

    const cycleUpdate = await request(`/api/cycles/${cycle.id}`, {
      method: "PATCH",
      body: JSON.stringify({ desiredDose: 300, applyFrom: "2030-01-06" }),
    }, session.token);
    expect(cycleUpdate.response.status).toBe(200);
    const [auditEntry] = await cycleUpdatesFor(session.token, cycle.id);
    expect(auditEntry).toBeDefined();

    const edit = await request<{ error: string }>(`/api/journal/${auditEntry!.id}`, {
      method: "PATCH",
      body: JSON.stringify({ body: "Attempted rewrite" }),
    }, session.token);
    expect(edit.response.status).toBe(403);

    const deletion = await request<{ error: string }>(`/api/journal/${auditEntry!.id}`, {
      method: "DELETE",
    }, session.token);
    expect(deletion.response.status).toBe(403);
  });

  it("does not allow journal entries to link to another user's cycle", async () => {
    const otherSession = await createSession();
    const otherCycle = await createCycle(otherSession.token);

    const foreignCreate = await request<{ error: string }>("/api/journal", {
      method: "POST",
      body: JSON.stringify({
        cycleId: otherCycle.id,
        entryType: "general_note",
        entryDate: "2030-01-02T00:00:00.000Z",
        body: "Invalid foreign cycle link",
      }),
    }, session.token);
    expect(foreignCreate.response.status).toBe(400);

    const ownEntry = await request<{ entry: JournalEntry }>("/api/journal", {
      method: "POST",
      body: JSON.stringify({
        entryType: "general_note",
        entryDate: "2030-01-02T00:00:00.000Z",
        body: "My note",
      }),
    }, session.token);
    expect(ownEntry.response.status).toBe(201);

    const foreignUpdate = await request<{ error: string }>(`/api/journal/${ownEntry.body.entry.id}`, {
      method: "PATCH",
      body: JSON.stringify({ cycleId: otherCycle.id }),
    }, session.token);
    expect(foreignUpdate.response.status).toBe(400);
  });
});