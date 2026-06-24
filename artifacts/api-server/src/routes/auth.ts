import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterAdminBody, LoginAdminBody } from "@workspace/api-zod";
import {
  clearSession,
  createSession,
  getSessionId,
  setSessionCookie,
} from "../lib/auth";

const router: IRouter = Router();

const SALT_ROUNDS = 12;

// GET /auth/user
router.get("/auth/user", (req: Request, res: Response) => {
  res.json({ user: req.isAuthenticated() ? req.user : null });
});

// POST /auth/register
router.post("/auth/register", async (req: Request, res: Response) => {
  const parsed = RegisterAdminBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const { name, email, password } = parsed.data;

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [user] = await db
    .insert(usersTable)
    .values({ name, email: email.toLowerCase(), passwordHash })
    .returning();

  const authUser = { id: user.id, email: user.email, name: user.name };
  const sid = await createSession({ user: authUser });
  setSessionCookie(res, sid);
  res.status(201).json(authUser);
});

// POST /auth/login
router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = LoginAdminBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const authUser = { id: user.id, email: user.email, name: user.name };
  const sid = await createSession({ user: authUser });
  setSessionCookie(res, sid);
  res.json(authUser);
});

// POST /auth/logout
router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

export default router;
