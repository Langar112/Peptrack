import { Router } from "express";
import { eq, and, desc, ilike, gte, lte } from "drizzle-orm";
import { db, journalEntriesTable, cyclesTable, injectionEventsTable } from "@workspace/db";
import { requireAuth, AuthRequest } from "../lib/auth.js";

const router = Router();
router.use(requireAuth as any);

// GET /api/journal?type=&cycleId=&search=&from=&to=
router.get("/", async (req: AuthRequest, res) => {
  try {
    const { type, cycleId, search, from, to } = req.query;

    const conditions: any[] = [eq(journalEntriesTable.userId, req.user!.userId)];
    if (type && typeof type === "string") {
      conditions.push(eq(journalEntriesTable.entryType, type));
    }
    if (cycleId && typeof cycleId === "string") {
      conditions.push(eq(journalEntriesTable.cycleId, cycleId));
    }
    if (search && typeof search === "string") {
      conditions.push(ilike(journalEntriesTable.body, `%${search}%`));
    }
    if (from && typeof from === "string") {
      conditions.push(gte(journalEntriesTable.entryDate, new Date(from)));
    }
    if (to && typeof to === "string") {
      conditions.push(lte(journalEntriesTable.entryDate, new Date(to)));
    }

    const entries = await db
      .select({
        entry: journalEntriesTable,
        cycleName: cyclesTable.cycleName,
        customCompoundName: cyclesTable.customCompoundName,
        cycleColor: cyclesTable.color,
      })
      .from(journalEntriesTable)
      .leftJoin(cyclesTable, eq(journalEntriesTable.cycleId, cyclesTable.id))
      .where(and(...conditions))
      .orderBy(desc(journalEntriesTable.entryDate));

    res.json({
      entries: entries.map((e) => ({
        ...e.entry,
        cycleName: e.cycleName,
        customCompoundName: e.customCompoundName,
        cycleColor: e.cycleColor,
      })),
    });
  } catch (err) {
    console.error("List journal error:", err);
    res.status(500).json({ error: "Failed to fetch journal entries" });
  }
});

// POST /api/journal
router.post("/", async (req: AuthRequest, res) => {
  try {
    const {
      cycleId,
      injectionEventId,
      entryType,
      entryDate,
      body,
      previousDose,
      newDose,
      doseUnit,
      previousSyringeUnits,
      newSyringeUnits,
      intensityRating,
      tags,
    } = req.body;

    if (!entryType || !entryDate) {
      res.status(400).json({ error: "entryType and entryDate are required" });
      return;
    }
    if (entryType === "cycle_update") {
      res.status(403).json({ error: "Cycle update entries are created automatically." });
      return;
    }
    if (cycleId) {
      const [cycle] = await db
        .select({ id: cyclesTable.id })
        .from(cyclesTable)
        .where(and(eq(cyclesTable.id, cycleId), eq(cyclesTable.userId, req.user!.userId)))
        .limit(1);
      if (!cycle) {
        res.status(400).json({ error: "The selected cycle was not found." });
        return;
      }
    }
    if (injectionEventId) {
      const [event] = await db
        .select({ id: injectionEventsTable.id })
        .from(injectionEventsTable)
        .where(and(eq(injectionEventsTable.id, injectionEventId), eq(injectionEventsTable.userId, req.user!.userId)))
        .limit(1);
      if (!event) {
        res.status(400).json({ error: "The selected injection event was not found." });
        return;
      }
    }

    const [entry] = await db
      .insert(journalEntriesTable)
      .values({
        userId: req.user!.userId,
        cycleId: cycleId ?? null,
        injectionEventId: injectionEventId ?? null,
        entryType,
        entryDate: new Date(entryDate),
        body: body ?? null,
        previousDose: previousDose ?? null,
        newDose: newDose ?? null,
        doseUnit: doseUnit ?? null,
        previousSyringeUnits: previousSyringeUnits ?? null,
        newSyringeUnits: newSyringeUnits ?? null,
        intensityRating: intensityRating ?? null,
        tags: tags ?? null,
      })
      .returning();

    res.status(201).json({ entry });
  } catch (err) {
    console.error("Create journal error:", err);
    res.status(500).json({ error: "Failed to create journal entry" });
  }
});

// GET /api/journal/:id
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const [entry] = await db
      .select()
      .from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, req.params.id), eq(journalEntriesTable.userId, req.user!.userId)))
      .limit(1);

    if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }
    res.json({ entry });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch entry" });
  }
});

// PATCH /api/journal/:id
router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const [existing] = await db
      .select({ id: journalEntriesTable.id, entryType: journalEntriesTable.entryType })
      .from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, req.params.id), eq(journalEntriesTable.userId, req.user!.userId)))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Entry not found" }); return; }
    if (existing.entryType === "cycle_update") {
      res.status(403).json({ error: "Cycle update entries cannot be edited." });
      return;
    }

    if (req.body.cycleId !== undefined && req.body.cycleId !== null) {
      const [cycle] = await db
        .select({ id: cyclesTable.id })
        .from(cyclesTable)
        .where(and(eq(cyclesTable.id, req.body.cycleId), eq(cyclesTable.userId, req.user!.userId)))
        .limit(1);
      if (!cycle) {
        res.status(400).json({ error: "The selected cycle was not found." });
        return;
      }
    }
    if (req.body.injectionEventId !== undefined && req.body.injectionEventId !== null) {
      const [event] = await db
        .select({ id: injectionEventsTable.id })
        .from(injectionEventsTable)
        .where(and(eq(injectionEventsTable.id, req.body.injectionEventId), eq(injectionEventsTable.userId, req.user!.userId)))
        .limit(1);
      if (!event) {
        res.status(400).json({ error: "The selected injection event was not found." });
        return;
      }
    }

    const allowedFields = ["body", "entryDate", "cycleId", "previousDose", "newDose", "doseUnit", "previousSyringeUnits", "newSyringeUnits", "intensityRating", "tags"];
    const updates: Record<string, any> = { updatedAt: new Date() };
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) {
        updates[f] = f === "entryDate" ? new Date(req.body[f]) : req.body[f];
      }
    }

    const [updated] = await db
      .update(journalEntriesTable)
      .set(updates)
      .where(eq(journalEntriesTable.id, req.params.id))
      .returning();

    res.json({ entry: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update entry" });
  }
});

// DELETE /api/journal/:id
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const [existing] = await db
      .select({ id: journalEntriesTable.id, entryType: journalEntriesTable.entryType })
      .from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, req.params.id), eq(journalEntriesTable.userId, req.user!.userId)))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Entry not found" }); return; }
    if (existing.entryType === "cycle_update") {
      res.status(403).json({ error: "Cycle update entries cannot be deleted." });
      return;
    }

    await db.delete(journalEntriesTable).where(eq(journalEntriesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

export default router;
