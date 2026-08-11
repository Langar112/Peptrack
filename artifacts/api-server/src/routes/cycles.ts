import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, cyclesTable, scheduleRulesTable, injectionEventsTable, journalEntriesTable, cycleChangeHistoryTable, peptideCatalogTable } from "@workspace/db";
import { requireAuth, AuthRequest } from "../lib/auth.js";
import { generateInjectionEvents } from "../lib/schedule.js";

const router = Router();
router.use(requireAuth as any);

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
              ? eq(scheduleRulesTable.cycleId, cycleIds[0])
              : scheduleRulesTable.cycleId.in(cycleIds)
          )
      : [];

    const rulesByCycleId = Object.fromEntries(rules.map((r) => [r.cycleId, r]));
    const result = cycles.map((c) => ({ ...c, scheduleRule: rulesByCycleId[c.id] ?? null }));
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
    } = req.body;

    const [cycle] = await db
      .insert(cyclesTable)
      .values({
        userId: req.user!.userId,
        peptideCatalogId: peptideCatalogId ?? null,
        customCompoundName: customCompoundName ?? null,
        cycleName: cycleName ?? null,
        vialAmount: String(vialAmount),
        vialUnit,
        bacWaterMl: String(bacWaterMl),
        desiredDose: String(desiredDose),
        doseUnit,
        calculatedVolumeMl: String(calculatedVolumeMl),
        calculatedSyringeUnits: String(calculatedSyringeUnits),
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
      .where(and(eq(cyclesTable.id, req.params.id), eq(cyclesTable.userId, req.user!.userId)))
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

    res.json({ cycle: { ...cycle, scheduleRule: rule ?? null } });
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
      .where(and(eq(cyclesTable.id, req.params.id), eq(cyclesTable.userId, req.user!.userId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Cycle not found" });
      return;
    }

    const { applyFrom, scheduleRule, ...cycleFields } = req.body;
    const updates: Partial<typeof cyclesTable.$inferInsert> = { updatedAt: new Date() };

    const doseFields = ["desiredDose", "doseUnit", "calculatedVolumeMl", "calculatedSyringeUnits"];
    const doseChanged = doseFields.some((f) => cycleFields[f] !== undefined && String(cycleFields[f]) !== String(existing[f as keyof typeof existing]));

    // Apply scalar cycle field updates
    const allowedFields = [
      "cycleName", "vialAmount", "vialUnit", "bacWaterMl", "desiredDose",
      "doseUnit", "calculatedVolumeMl", "calculatedSyringeUnits", "syringeCapacityMl",
      "startDate", "endDate", "durationWeeks", "ongoing", "status", "peptideCatalogId",
      "customCompoundName",
    ];
    for (const field of allowedFields) {
      if (cycleFields[field] !== undefined) {
        (updates as any)[field] = typeof cycleFields[field] === "number"
          ? String(cycleFields[field])
          : cycleFields[field];
      }
    }

    const [updated] = await db
      .update(cyclesTable)
      .set(updates)
      .where(eq(cyclesTable.id, req.params.id))
      .returning();

    // If dose changed, create journal entry and log change history
    if (doseChanged) {
      await db.insert(journalEntriesTable).values({
        userId: req.user!.userId,
        cycleId: updated.id,
        entryType: "dose_change",
        entryDate: new Date(),
        body: `Dose changed from ${existing.desiredDose} ${existing.doseUnit} to ${updated.desiredDose} ${updated.doseUnit}`,
        previousDose: String(existing.desiredDose),
        newDose: String(updated.desiredDose),
        doseUnit: updated.doseUnit,
        previousSyringeUnits: String(existing.calculatedSyringeUnits),
        newSyringeUnits: String(updated.calculatedSyringeUnits),
      });

      await db.insert(cycleChangeHistoryTable).values({
        cycleId: updated.id,
        userId: req.user!.userId,
        fieldChanged: "dose",
        previousValue: `${existing.desiredDose} ${existing.doseUnit}`,
        newValue: `${updated.desiredDose} ${updated.doseUnit}`,
        effectiveDate: applyFrom ?? new Date().toISOString().slice(0, 10),
      });

      // Update future scheduled events from applyFrom forward
      const fromDate = applyFrom ? new Date(applyFrom) : new Date();
      // Delete future scheduled events and regenerate
      await db.delete(injectionEventsTable).where(
        and(
          eq(injectionEventsTable.cycleId, req.params.id),
          eq(injectionEventsTable.status, "scheduled")
        )
      );
    }

    // Update schedule rule if provided
    let rule = null;
    if (scheduleRule) {
      const existing = await db
        .select()
        .from(scheduleRulesTable)
        .where(eq(scheduleRulesTable.cycleId, req.params.id))
        .limit(1);

      if (existing.length > 0) {
        const [r] = await db
          .update(scheduleRulesTable)
          .set({
            frequencyType: scheduleRule.frequencyType,
            injectionsPerWeek: scheduleRule.injectionsPerWeek ?? null,
            daysOfWeek: scheduleRule.daysOfWeek ?? null,
            intervalDays: scheduleRule.intervalDays ?? null,
            injectionTimes: scheduleRule.injectionTimes ?? ["any"],
            timezone: scheduleRule.timezone ?? "UTC",
            updatedAt: new Date(),
          })
          .where(eq(scheduleRulesTable.id, existing[0].id))
          .returning();
        rule = r;
      } else {
        const [r] = await db
          .insert(scheduleRulesTable)
          .values({
            cycleId: req.params.id,
            frequencyType: scheduleRule.frequencyType,
            injectionsPerWeek: scheduleRule.injectionsPerWeek ?? null,
            daysOfWeek: scheduleRule.daysOfWeek ?? null,
            intervalDays: scheduleRule.intervalDays ?? null,
            injectionTimes: scheduleRule.injectionTimes ?? ["any"],
            timezone: scheduleRule.timezone ?? "UTC",
          })
          .returning();
        rule = r;
      }

      // Regenerate future events
      await db.delete(injectionEventsTable).where(
        and(
          eq(injectionEventsTable.cycleId, req.params.id),
          eq(injectionEventsTable.status, "scheduled")
        )
      );

      const events = generateInjectionEvents({
        cycle: updated,
        scheduleRule: rule,
        userId: req.user!.userId,
        fromDate: applyFrom ? new Date(applyFrom) : new Date(),
      });

      if (events.length > 0) {
        await db.insert(injectionEventsTable).values(events);
      }
    }

    res.json({ cycle: { ...updated, scheduleRule: rule } });
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
      .where(and(eq(cyclesTable.id, req.params.id), eq(cyclesTable.userId, req.user!.userId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Cycle not found" });
      return;
    }

    await db.delete(cyclesTable).where(eq(cyclesTable.id, req.params.id));
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
      .where(and(eq(cyclesTable.id, req.params.id), eq(cyclesTable.userId, req.user!.userId)))
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
      .where(and(eq(cyclesTable.id, req.params.id), eq(cyclesTable.userId, req.user!.userId)))
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
      .where(and(eq(cyclesTable.id, req.params.id), eq(cyclesTable.userId, req.user!.userId)))
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
