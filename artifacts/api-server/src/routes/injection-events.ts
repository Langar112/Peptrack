import { Router } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db, injectionEventsTable, cyclesTable } from "@workspace/db";
import { requireAuth, AuthRequest } from "../lib/auth.js";

const router = Router();
router.use(requireAuth as any);

// GET /api/injection-events?cycleId=&from=&to=
router.get("/", async (req: AuthRequest, res) => {
  try {
    const { cycleId, from, to } = req.query;

    let query = db
      .select()
      .from(injectionEventsTable)
      .where(eq(injectionEventsTable.userId, req.user!.userId));

    const conditions = [eq(injectionEventsTable.userId, req.user!.userId)];
    if (cycleId && typeof cycleId === "string") {
      conditions.push(eq(injectionEventsTable.cycleId, cycleId));
    }
    if (from && typeof from === "string") {
      conditions.push(gte(injectionEventsTable.scheduledAt, new Date(from)));
    }
    if (to && typeof to === "string") {
      conditions.push(lte(injectionEventsTable.scheduledAt, new Date(to)));
    }

    const events = await db
      .select({
        event: injectionEventsTable,
        cycleName: cyclesTable.cycleName,
        customCompoundName: cyclesTable.customCompoundName,
        cycleColor: cyclesTable.color,
        peptideCatalogId: cyclesTable.peptideCatalogId,
        cycleStartDate: cyclesTable.startDate,
      })
      .from(injectionEventsTable)
      .innerJoin(cyclesTable, eq(injectionEventsTable.cycleId, cyclesTable.id))
      .where(and(...conditions))
      .orderBy(injectionEventsTable.scheduledAt);

    // Auto-mark missed events (scheduled events whose scheduledAt has passed)
    const now = new Date();
    const toMarkMissed = events
      .filter(
        (e) =>
          e.event.status === "scheduled" &&
          new Date(e.event.scheduledAt) < now
      )
      .map((e) => e.event.id);

    if (toMarkMissed.length > 0) {
      for (const id of toMarkMissed) {
        await db
          .update(injectionEventsTable)
          .set({ status: "missed", updatedAt: new Date() })
          .where(eq(injectionEventsTable.id, id));
      }
    }

    res.json({ events: events.map((e) => ({ ...e.event, cycleName: e.cycleName, customCompoundName: e.customCompoundName, cycleColor: e.cycleColor, cycleStartDate: e.cycleStartDate })) });
  } catch (err) {
    console.error("List injection events error:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// PATCH /api/injection-events/:id/complete
router.patch("/:id/complete", async (req: AuthRequest, res) => {
  try {
    const { actualDose, actualDoseUnit, actualVolumeMl, actualSyringeUnits, injectionSite, note, completedAt } = req.body;

    const [event] = await db
      .select()
      .from(injectionEventsTable)
      .where(and(eq(injectionEventsTable.id, req.params.id), eq(injectionEventsTable.userId, req.user!.userId)))
      .limit(1);

    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    const [updated] = await db
      .update(injectionEventsTable)
      .set({
        status: "completed",
        actualDose: actualDose !== undefined ? String(actualDose) : event.plannedDose,
        actualDoseUnit: actualDoseUnit ?? event.plannedDoseUnit,
        actualVolumeMl: actualVolumeMl !== undefined ? String(actualVolumeMl) : event.plannedVolumeMl,
        actualSyringeUnits: actualSyringeUnits !== undefined ? String(actualSyringeUnits) : event.plannedSyringeUnits,
        injectionSite: injectionSite ?? null,
        note: note ?? null,
        completedAt: completedAt ? new Date(completedAt) : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(injectionEventsTable.id, req.params.id))
      .returning();

    res.json({ event: updated });
  } catch (err) {
    console.error("Complete event error:", err);
    res.status(500).json({ error: "Failed to complete event" });
  }
});

// PATCH /api/injection-events/:id/skip
router.patch("/:id/skip", async (req: AuthRequest, res) => {
  try {
    const [event] = await db
      .select({ id: injectionEventsTable.id })
      .from(injectionEventsTable)
      .where(and(eq(injectionEventsTable.id, req.params.id), eq(injectionEventsTable.userId, req.user!.userId)))
      .limit(1);

    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    const { note } = req.body;
    const [updated] = await db
      .update(injectionEventsTable)
      .set({ status: "skipped", note: note ?? null, updatedAt: new Date() })
      .where(eq(injectionEventsTable.id, req.params.id))
      .returning();

    res.json({ event: updated });
  } catch (err) {
    console.error("Skip event error:", err);
    res.status(500).json({ error: "Failed to skip event" });
  }
});

// PATCH /api/injection-events/:id — generic update (for editing individual records)
router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const [event] = await db
      .select({ id: injectionEventsTable.id })
      .from(injectionEventsTable)
      .where(and(eq(injectionEventsTable.id, req.params.id), eq(injectionEventsTable.userId, req.user!.userId)))
      .limit(1);

    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    const { note, injectionSite, status } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (note !== undefined) updates.note = note;
    if (injectionSite !== undefined) updates.injectionSite = injectionSite;
    if (status !== undefined) updates.status = status;

    const [updated] = await db
      .update(injectionEventsTable)
      .set(updates)
      .where(eq(injectionEventsTable.id, req.params.id))
      .returning();

    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update event" });
  }
});

export default router;
