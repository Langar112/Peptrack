import { Router } from "express";
import { eq, and, desc, gte, inArray } from "drizzle-orm";
import { db, cyclesTable, scheduleRulesTable, injectionEventsTable, journalEntriesTable, cycleChangeHistoryTable, peptideCatalogTable } from "@workspace/db";
import { requireAuth, AuthRequest } from "../lib/auth.js";
import { generateInjectionEvents } from "../lib/schedule.js";
import { calculateVialTracking } from "../lib/vial-tracking.js";

const router = Router();
router.use(requireAuth as any);

const VALID_CYCLE_COLORS = new Set(["teal", "violet", "rose", "amber", "emerald", "blue"]);

type CycleAuditChange = {
  field: string;
  label: string;
  previousValue: string;
  newValue: string;
};

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  return String(value);
}

function displaySchedule(rule: {
  frequencyType: string;
  injectionsPerWeek?: number | null;
  daysOfWeek?: string[] | null;
  intervalDays?: number | null;
  injectionTimes?: string[] | null;
} | null): string {
  if (!rule) return "Not provided";
  const time = rule.injectionTimes?.length ? ` at ${rule.injectionTimes.join(", ")}` : "";
  if (rule.frequencyType === "daily") return `Every day${time}`;
  if (rule.frequencyType === "specific_days") return `${(rule.daysOfWeek ?? []).join(", ") || "Specific days"}${time}`;
  if (rule.frequencyType === "times_per_week") {
    const days = rule.daysOfWeek?.length ? ` (${rule.daysOfWeek.join(", ")})` : "";
    return `${rule.injectionsPerWeek ?? 0} times per week${days}${time}`;
  }
  if (rule.frequencyType === "every_x_days") return `Every ${rule.intervalDays ?? 0} days${time}`;
  return `${rule.frequencyType}${time}`;
}

function sameStringList(a: string[] | null | undefined, b: string[] | null | undefined, sort = false): boolean {
  const left = [...(a ?? [])];
  const right = [...(b ?? [])];
  if (sort) {
    left.sort();
    right.sort();
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameNumericValue(a: unknown, b: unknown): boolean {
  const aIsBlank = a === null || a === undefined || a === "";
  const bIsBlank = b === null || b === undefined || b === "";
  if (aIsBlank || bIsBlank) return aIsBlank === bIsBlank;
  return Number(a) === Number(b);
}

function validateScheduleRule(rule: any): string | null {
  const validFrequencyTypes = ["daily", "specific_days", "times_per_week", "every_x_days"];
  const validDays = new Set(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
  if (!rule || !validFrequencyTypes.includes(rule.frequencyType)) {
    return "Select a valid injection frequency before saving this cycle.";
  }

  const times = rule.injectionTimes ?? ["any"];
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!Array.isArray(times) || times.length === 0 || times.some((time) => time !== "any" && !timePattern.test(String(time)))) {
    return "Enter a valid injection time in HH:MM format or use any time.";
  }

  const days = rule.daysOfWeek ?? [];
  const normalizedDays = Array.isArray(days) ? days.map((day) => String(day).toLowerCase()) : [];
  if (
    (rule.frequencyType === "specific_days" || rule.frequencyType === "times_per_week") &&
    (
      normalizedDays.length === 0 ||
      normalizedDays.some((day) => !validDays.has(day)) ||
      new Set(normalizedDays).size !== normalizedDays.length
    )
  ) {
    return "Select at least one valid day of the week for this schedule.";
  }

  if (rule.frequencyType === "times_per_week") {
    const count = Number(rule.injectionsPerWeek);
    if (!Number.isInteger(count) || count < 1 || count > 7) {
      return "Enter between 1 and 7 injections per week.";
    }
    if (normalizedDays.length !== count) {
      return "Select one day for each planned injection per week.";
    }
  }

  if (rule.frequencyType === "every_x_days") {
    const interval = Number(rule.intervalDays);
    if (!Number.isInteger(interval) || interval < 1) {
      return "Enter a whole-number injection interval of at least 1 day.";
    }
  }

  return null;
}

// GET /api/cycles — list user's cycles
router.get("/", async (req: AuthRequest, res) => {
  try {
    const cycles = await db
      .select()
      .from(cyclesTable)
      .where(eq(cyclesTable.userId, req.user!.userId))
      .orderBy(desc(cyclesTable.createdAt));

    // For each cycle, get the schedule rule
    const cycleIds = cycles.map((c) => c.id);
    const rules = cycleIds.length
      ? await db
          .select()
          .from(scheduleRulesTable)
          .where(
            cycleIds.length === 1
              ? eq(scheduleRulesTable.cycleId, cycleIds[0]!)
              : inArray(scheduleRulesTable.cycleId, cycleIds)
          )
      : [];

    const rulesByCycleId = Object.fromEntries(rules.map((r) => [r.cycleId, r]));
    const completedEvents = cycleIds.length
      ? await db
          .select({
            cycleId: injectionEventsTable.cycleId,
            actualDose: injectionEventsTable.actualDose,
            actualDoseUnit: injectionEventsTable.actualDoseUnit,
            plannedDose: injectionEventsTable.plannedDose,
            plannedDoseUnit: injectionEventsTable.plannedDoseUnit,
          })
          .from(injectionEventsTable)
          .where(
            and(
              eq(injectionEventsTable.status, "completed"),
              cycleIds.length === 1
                ? eq(injectionEventsTable.cycleId, cycleIds[0]!)
                : inArray(injectionEventsTable.cycleId, cycleIds),
            ),
          )
      : [];
    const completedByCycleId = completedEvents.reduce<Record<string, typeof completedEvents>>((grouped, event) => {
      (grouped[event.cycleId] ??= []).push(event);
      return grouped;
    }, {});
    const result = cycles.map((c) => ({
      ...c,
      scheduleRule: rulesByCycleId[c.id] ?? null,
      vialTracking: calculateVialTracking(c, completedByCycleId[c.id] ?? []),
    }));
    res.json({ cycles: result });
  } catch (err) {
    console.error("List cycles error:", err);
    res.status(500).json({ error: "Failed to fetch cycles" });
  }
});

// POST /api/cycles — create a cycle + schedule rule + generate events
router.post("/", async (req: AuthRequest, res) => {
  try {
    const {
      peptideCatalogId,
      customCompoundName,
      cycleName,
      color,
      vialAmount,
      vialUnit,
      bacWaterMl,
      desiredDose,
      doseUnit,
      calculatedVolumeMl,
      calculatedSyringeUnits,
      syringeCapacityMl,
      startDate,
      endDate,
      durationWeeks,
      ongoing,
      scheduleRule,
    } = req.body ?? {};

    if (!String(customCompoundName ?? "").trim()) {
      res.status(400).json({ error: "Enter the peptide or compound name before saving this cycle." });
      return;
    }

    const desiredDoseNumber = Number(desiredDose);
    if (!Number.isFinite(desiredDoseNumber) || desiredDoseNumber <= 0) {
      res.status(400).json({ error: "Enter a valid desired dose before saving this cycle." });
      return;
    }

    const scheduleError = validateScheduleRule(scheduleRule);
    if (scheduleError) {
      res.status(400).json({ error: scheduleError });
      return;
    }
    if (color !== undefined && !VALID_CYCLE_COLORS.has(String(color))) {
      res.status(400).json({ error: "Choose a valid cycle color." });
      return;
    }

    const optionalNumbers = [
      ["vial amount", vialAmount],
      ["BAC water amount", bacWaterMl],
      ["calculated volume", calculatedVolumeMl],
      ["calculated syringe units", calculatedSyringeUnits],
    ] as const;
    const normalizedOptionalNumbers = optionalNumbers.map(([label, value]) => {
      if (value === undefined || value === null || value === "") return 0;
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        res.status(400).json({ error: `Enter a valid ${label} before saving this cycle.` });
        return null;
      }
      return numericValue;
    });

    if (normalizedOptionalNumbers.some((value) => value === null)) {
      return;
    }
    const [vialAmountNumber, bacWaterMlNumber, calculatedVolumeMlNumber, calculatedSyringeUnitsNumber] =
      normalizedOptionalNumbers as number[];

    const [cycle] = await db
      .insert(cyclesTable)
      .values({
        userId: req.user!.userId,
        peptideCatalogId: peptideCatalogId ?? null,
        customCompoundName: customCompoundName ?? null,
        cycleName: cycleName ?? null,
        color: color ?? "teal",
        vialAmount: String(vialAmountNumber),
        vialUnit: vialUnit ?? "mg",
        bacWaterMl: String(bacWaterMlNumber),
        desiredDose: String(desiredDoseNumber),
        doseUnit: doseUnit ?? "mcg",
        calculatedVolumeMl: String(calculatedVolumeMlNumber),
        calculatedSyringeUnits: String(calculatedSyringeUnitsNumber),
        syringeCapacityMl: String(syringeCapacityMl ?? "1.0"),
        startDate,
        endDate: endDate ?? null,
        durationWeeks: durationWeeks ?? null,
        ongoing: ongoing ?? false,
        status: "active",
      })
      .returning();

    let rule = null;
    if (scheduleRule) {
      const [r] = await db
        .insert(scheduleRulesTable)
        .values({
          cycleId: cycle.id,
          frequencyType: scheduleRule.frequencyType,
          injectionsPerWeek: scheduleRule.injectionsPerWeek ?? null,
          daysOfWeek: scheduleRule.daysOfWeek ?? null,
          intervalDays: scheduleRule.intervalDays ?? null,
          injectionTimes: scheduleRule.injectionTimes ?? ["any"],
          timezone: scheduleRule.timezone ?? "UTC",
        })
        .returning();
      rule = r;

      // Generate injection events
      const events = generateInjectionEvents({
        cycle,
        scheduleRule: r,
        userId: req.user!.userId,
      });

      if (events.length > 0) {
        await db.insert(injectionEventsTable).values(events);
      }
    }

    res.status(201).json({ cycle: { ...cycle, scheduleRule: rule } });
  } catch (err) {
    console.error("Create cycle error:", err);
    res.status(500).json({ error: "Failed to create cycle" });
  }
});

// GET /api/cycles/:id
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const [cycle] = await db
      .select()
      .from(cyclesTable)
      .where(and(eq(cyclesTable.id, (req.params.id as string)), eq(cyclesTable.userId, req.user!.userId)))
      .limit(1);

    if (!cycle) {
      res.status(404).json({ error: "Cycle not found" });
      return;
    }

    const [rule] = await db
      .select()
      .from(scheduleRulesTable)
      .where(eq(scheduleRulesTable.cycleId, cycle.id))
      .limit(1);

    const [catalogCompound] = cycle.peptideCatalogId
      ? await db
          .select({ name: peptideCatalogTable.name })
          .from(peptideCatalogTable)
          .where(eq(peptideCatalogTable.id, cycle.peptideCatalogId))
          .limit(1)
      : [];

    const completedEvents = await db
      .select({
        actualDose: injectionEventsTable.actualDose,
        actualDoseUnit: injectionEventsTable.actualDoseUnit,
        plannedDose: injectionEventsTable.plannedDose,
        plannedDoseUnit: injectionEventsTable.plannedDoseUnit,
      })
      .from(injectionEventsTable)
      .where(
        and(
          eq(injectionEventsTable.cycleId, cycle.id),
          eq(injectionEventsTable.status, "completed"),
        ),
      );

    res.json({
      cycle: {
        ...cycle,
        catalogName: catalogCompound?.name ?? null,
        scheduleRule: rule ?? null,
        vialTracking: calculateVialTracking(cycle, completedEvents),
      },
    });
  } catch (err) {
    console.error("Get cycle error:", err);
    res.status(500).json({ error: "Failed to fetch cycle" });
  }
});

// PATCH /api/cycles/:id
router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const [existing] = await db
      .select()
      .from(cyclesTable)
      .where(and(eq(cyclesTable.id, (req.params.id as string)), eq(cyclesTable.userId, req.user!.userId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Cycle not found" });
      return;
    }

    const [existingRule] = await db
      .select()
      .from(scheduleRulesTable)
      .where(eq(scheduleRulesTable.cycleId, (req.params.id as string)))
      .limit(1);

    const { applyFrom, scheduleRule, ...cycleFields } = req.body ?? {};
    if (scheduleRule) {
      const scheduleError = validateScheduleRule(scheduleRule);
      if (scheduleError) {
        res.status(400).json({ error: scheduleError });
        return;
      }
    }
    const changes: CycleAuditChange[] = [];
    const updates: Partial<typeof cyclesTable.$inferInsert> = {};
    const allowedFields = [
      "cycleName", "vialAmount", "vialUnit", "bacWaterMl", "desiredDose",
      "doseUnit", "calculatedVolumeMl", "calculatedSyringeUnits", "syringeCapacityMl",
      "startDate", "endDate", "durationWeeks", "ongoing", "status", "peptideCatalogId",
      "customCompoundName", "color",
    ];
    const labels: Record<string, string> = {
      cycleName: "Cycle name",
      vialAmount: "Vial amount",
      vialUnit: "Vial unit",
      bacWaterMl: "BAC water",
      desiredDose: "Desired dose",
      doseUnit: "Dose unit",
      calculatedVolumeMl: "Volume",
      calculatedSyringeUnits: "Syringe units",
      syringeCapacityMl: "Syringe capacity",
      startDate: "Start date",
      endDate: "End date",
      durationWeeks: "Duration (weeks)",
      ongoing: "Ongoing",
      status: "Status",
      peptideCatalogId: "Catalog compound",
      customCompoundName: "Compound",
      color: "Color",
    };
    const numericFields = new Set([
      "vialAmount", "bacWaterMl", "desiredDose", "calculatedVolumeMl",
      "calculatedSyringeUnits", "syringeCapacityMl", "durationWeeks",
    ]);
    if (cycleFields.color !== undefined && !VALID_CYCLE_COLORS.has(String(cycleFields.color))) {
      res.status(400).json({ error: "Choose a valid cycle color." });
      return;
    }
    for (const field of allowedFields) {
      if (cycleFields[field] === undefined) continue;
      const nextValue = typeof cycleFields[field] === "number"
        ? String(cycleFields[field])
        : cycleFields[field];
      const currentValue = existing[field as keyof typeof existing];
      const unchanged = numericFields.has(field)
        ? sameNumericValue(currentValue, nextValue)
        : String(currentValue ?? "") === String(nextValue ?? "");
      if (unchanged) continue;
      (updates as any)[field] = nextValue;
      changes.push({
        field,
        label: labels[field] ?? field,
        previousValue: displayValue(currentValue),
        newValue: displayValue(nextValue),
      });
    }

    const scheduleChanged = Boolean(scheduleRule) && (
      !existingRule ||
      existingRule.frequencyType !== scheduleRule.frequencyType ||
      existingRule.injectionsPerWeek !== (scheduleRule.injectionsPerWeek ?? null) ||
      existingRule.intervalDays !== (scheduleRule.intervalDays ?? null) ||
      existingRule.timezone !== (scheduleRule.timezone ?? "UTC") ||
      !sameStringList(existingRule.daysOfWeek, scheduleRule.daysOfWeek, true) ||
      !sameStringList(existingRule.injectionTimes, scheduleRule.injectionTimes)
    );

    if (scheduleChanged) {
      changes.push({
        field: "schedule",
        label: "Schedule",
        previousValue: displaySchedule(existingRule ?? null),
        newValue: displaySchedule({
          frequencyType: scheduleRule.frequencyType,
          injectionsPerWeek: scheduleRule.injectionsPerWeek ?? null,
          daysOfWeek: scheduleRule.daysOfWeek ?? null,
          intervalDays: scheduleRule.intervalDays ?? null,
          injectionTimes: scheduleRule.injectionTimes ?? ["any"],
        }),
      });
    }

    if (changes.length === 0) {
      res.json({ cycle: { ...existing, scheduleRule: existingRule ?? null } });
      return;
    }

    const effectiveDate = applyFrom ?? new Date().toISOString().slice(0, 10);
    const scheduleSensitiveFields = new Set([
      "desiredDose", "doseUnit", "calculatedVolumeMl", "calculatedSyringeUnits",
      "startDate", "endDate", "durationWeeks", "ongoing",
    ]);
    const shouldRegenerateEvents = scheduleChanged || changes.some((change) => scheduleSensitiveFields.has(change.field));

    const result = await db.transaction(async (tx) => {
      updates.updatedAt = new Date();
      const [updated] = await tx
        .update(cyclesTable)
        .set(updates)
        .where(eq(cyclesTable.id, (req.params.id as string)))
        .returning();

      let rule = existingRule ?? null;
      if (scheduleChanged && scheduleRule) {
        const ruleValues = {
          frequencyType: scheduleRule.frequencyType,
          injectionsPerWeek: scheduleRule.injectionsPerWeek ?? null,
          daysOfWeek: scheduleRule.daysOfWeek ?? null,
          intervalDays: scheduleRule.intervalDays ?? null,
          injectionTimes: scheduleRule.injectionTimes ?? ["any"],
          timezone: scheduleRule.timezone ?? "UTC",
        };
        if (existingRule) {
          const [updatedRule] = await tx
            .update(scheduleRulesTable)
            .set({ ...ruleValues, updatedAt: new Date() })
            .where(eq(scheduleRulesTable.id, existingRule.id))
            .returning();
          rule = updatedRule;
        } else {
          const [createdRule] = await tx
            .insert(scheduleRulesTable)
            .values({ cycleId: (req.params.id as string), ...ruleValues })
            .returning();
          rule = createdRule;
        }
      }

      await tx.insert(journalEntriesTable).values({
        userId: req.user!.userId,
        cycleId: updated.id,
        entryType: "cycle_update",
        entryDate: new Date(),
        body: `Cycle updated:\n${changes.map((change) => `${change.label}: ${change.previousValue} → ${change.newValue}`).join("\n")}`,
        previousDose: String(existing.desiredDose),
        newDose: String(updated.desiredDose),
        doseUnit: updated.doseUnit,
        previousSyringeUnits: String(existing.calculatedSyringeUnits),
        newSyringeUnits: String(updated.calculatedSyringeUnits),
      });

      await tx.insert(cycleChangeHistoryTable).values(
        changes.map((change) => ({
          cycleId: updated.id,
          userId: req.user!.userId,
          fieldChanged: change.field,
          previousValue: change.previousValue,
          newValue: change.newValue,
          effectiveDate,
        }))
      );

      if (shouldRegenerateEvents && rule) {
        const regenerationFrom = applyFrom ? new Date(`${applyFrom}T00:00:00`) : new Date();
        regenerationFrom.setHours(0, 0, 0, 0);
        await tx.delete(injectionEventsTable).where(
          and(
            eq(injectionEventsTable.cycleId, (req.params.id as string)),
            eq(injectionEventsTable.status, "scheduled"),
            gte(injectionEventsTable.scheduledAt, regenerationFrom)
          )
        );

        const events = generateInjectionEvents({
          cycle: updated,
          scheduleRule: rule,
          userId: req.user!.userId,
          fromDate: regenerationFrom,
        });
        if (events.length > 0) {
          await tx.insert(injectionEventsTable).values(events);
        }
      }

      return { updated, rule };
    });

    res.json({ cycle: { ...result.updated, scheduleRule: result.rule } });
  } catch (err) {
    console.error("Update cycle error:", err);
    res.status(500).json({ error: "Failed to update cycle" });
  }
});

// DELETE /api/cycles/:id
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const [existing] = await db
      .select({ id: cyclesTable.id })
      .from(cyclesTable)
      .where(and(eq(cyclesTable.id, (req.params.id as string)), eq(cyclesTable.userId, req.user!.userId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Cycle not found" });
      return;
    }

    await db.delete(cyclesTable).where(eq(cyclesTable.id, (req.params.id as string)));
    res.json({ success: true });
  } catch (err) {
    console.error("Delete cycle error:", err);
    res.status(500).json({ error: "Failed to delete cycle" });
  }
});

// POST /api/cycles/:id/archive
router.post("/:id/archive", async (req: AuthRequest, res) => {
  try {
    const [updated] = await db
      .update(cyclesTable)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(cyclesTable.id, (req.params.id as string)), eq(cyclesTable.userId, req.user!.userId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Cycle not found" }); return; }
    res.json({ cycle: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to archive cycle" });
  }
});

// POST /api/cycles/:id/pause
router.post("/:id/pause", async (req: AuthRequest, res) => {
  try {
    const [updated] = await db
      .update(cyclesTable)
      .set({ status: "paused", updatedAt: new Date() })
      .where(and(eq(cyclesTable.id, (req.params.id as string)), eq(cyclesTable.userId, req.user!.userId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Cycle not found" }); return; }
    res.json({ cycle: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to pause cycle" });
  }
});

// POST /api/cycles/:id/resume
router.post("/:id/resume", async (req: AuthRequest, res) => {
  try {
    const [updated] = await db
      .update(cyclesTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(and(eq(cyclesTable.id, (req.params.id as string)), eq(cyclesTable.userId, req.user!.userId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Cycle not found" }); return; }
    res.json({ cycle: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to resume cycle" });
  }
});

// GET /api/catalog — peptide catalog
router.get("/catalog/list", async (_req, res) => {
  try {
    const catalog = await db
      .select()
      .from(peptideCatalogTable)
      .where(eq(peptideCatalogTable.active, true))
      .orderBy(peptideCatalogTable.displayOrder);
    res.json({ catalog });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch catalog" });
  }
});

export default router;
