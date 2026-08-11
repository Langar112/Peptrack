import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { hashPassword, verifyPassword, signToken, requireAuth, AuthRequest } from "../lib/auth.js";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(usersTable)
      .values({ email: normalizedEmail, passwordHash })
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        timezone: usersTable.timezone,
        theme: usersTable.theme,
        firstDayOfWeek: usersTable.firstDayOfWeek,
        defaultSyringeSize: usersTable.defaultSyringeSize,
        disclaimerAccepted: usersTable.disclaimerAccepted,
        createdAt: usersTable.createdAt,
      });

    const token = signToken({ userId: user.id, email: user.email });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const normalizedEmail = (email as string).toLowerCase().trim();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        timezone: user.timezone,
        theme: user.theme,
        firstDayOfWeek: user.firstDayOfWeek,
        defaultSyringeSize: user.defaultSyringeSize,
        disclaimerAccepted: user.disclaimerAccepted,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        timezone: usersTable.timezone,
        theme: usersTable.theme,
        firstDayOfWeek: usersTable.firstDayOfWeek,
        defaultSyringeSize: usersTable.defaultSyringeSize,
        disclaimerAccepted: usersTable.disclaimerAccepted,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user });
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
        email: usersTable.email,
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
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
