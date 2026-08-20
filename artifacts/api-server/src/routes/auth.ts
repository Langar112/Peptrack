import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { signToken, requireAuth, AuthRequest } from "../lib/auth.js";

const router = Router();

const publicUserFields = {
  id: usersTable.id,
  timezone: usersTable.timezone,
  theme: usersTable.theme,
  firstDayOfWeek: usersTable.firstDayOfWeek,
  defaultSyringeSize: usersTable.defaultSyringeSize,
  disclaimerAccepted: usersTable.disclaimerAccepted,
  createdAt: usersTable.createdAt,
};

// POST /api/auth/anonymous
// Creates a private, device-held session without collecting personal information.
router.post("/anonymous", async (_req, res) => {
  try {
    const [user] = await db
      .insert(usersTable)
      .values({})
      .returning(publicUserFields);

    const token = signToken({ userId: user.id });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error("Anonymous session error:", err);
    res.status(500).json({ error: "Could not start a private session" });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select(publicUserFields)
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // Refresh legacy email-account tokens into the anonymous-session format.
    res.json({ user, token: signToken({ userId: user.id }) });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// PATCH /api/auth/settings
router.patch("/settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { timezone, theme, firstDayOfWeek, defaultSyringeSize, disclaimerAccepted } = req.body;
    const updates: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };
    if (timezone !== undefined) updates.timezone = timezone;
    if (theme !== undefined) updates.theme = theme;
    if (firstDayOfWeek !== undefined) updates.firstDayOfWeek = firstDayOfWeek;
    if (defaultSyringeSize !== undefined) updates.defaultSyringeSize = defaultSyringeSize;
    if (disclaimerAccepted !== undefined) updates.disclaimerAccepted = disclaimerAccepted;

    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, req.user!.userId))
      .returning({
        id: usersTable.id,
        timezone: usersTable.timezone,
        theme: usersTable.theme,
        firstDayOfWeek: usersTable.firstDayOfWeek,
        defaultSyringeSize: usersTable.defaultSyringeSize,
        disclaimerAccepted: usersTable.disclaimerAccepted,
      });

    res.json({ user });
  } catch (err) {
    console.error("Settings error:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// DELETE /api/auth/account
router.delete("/account", requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.delete(usersTable).where(eq(usersTable.id, req.user!.userId));
    res.json({ success: true });
  } catch (err) {
    console.error("Delete private data error:", err);
    res.status(500).json({ error: "Failed to delete private data" });
  }
});

export default router;
