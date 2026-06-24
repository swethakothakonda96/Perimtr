import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { devicesTable, sessionsTable, pollsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { GetOrCreateDeviceTokenBody, VerifyNetworkBody } from "@workspace/api-zod";

const router = Router();

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket.remoteAddress ?? "127.0.0.1";
}

function getNetworkKey(ip: string): string {
  const parts = ip.replace("::ffff:", "").split(".");
  if (parts.length === 4) return parts.slice(0, 3).join(".");
  return ip;
}

// POST /device/token
router.post("/token", async (req: Request, res: Response) => {
  const parsed = GetOrCreateDeviceTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { fingerprint, userAgent, platform, screenResolution, timezone, hardwareConcurrency, deviceMemory } = parsed.data;

  const [existing] = await db
    .select()
    .from(devicesTable)
    .where(eq(devicesTable.fingerprint, fingerprint));

  if (existing) {
    res.json({ token: existing.token, isNew: false });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(devicesTable).values({
    token,
    fingerprint,
    userAgent: userAgent ?? null,
    platform: platform ?? null,
    screenResolution: screenResolution ?? null,
    timezone: timezone ?? null,
    hardwareConcurrency: hardwareConcurrency ?? null,
    deviceMemory: deviceMemory ?? null,
  });
  res.json({ token, isNew: true });
});

// POST /network/verify
router.post("/verify", async (req: Request, res: Response) => {
  const parsed = VerifyNetworkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { sessionId, pollId } = parsed.data;
  const clientIp = getClientIp(req);
  const clientSubnet = getNetworkKey(clientIp);

  if (sessionId != null) {
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId));
    if (!session) {
      res.json({ allowed: false, reason: "Session not found" });
      return;
    }
    // In development (loopback), always allow
    if (session.networkKey === "127.0" || clientSubnet === "127.0" || clientSubnet === session.networkKey) {
      res.json({ allowed: true, reason: "Network verified" });
    } else {
      res.json({ allowed: false, reason: "Not on the same network as the session host" });
    }
    return;
  }

  if (pollId != null) {
    const [poll] = await db
      .select()
      .from(pollsTable)
      .where(eq(pollsTable.id, pollId));
    if (!poll) {
      res.json({ allowed: false, reason: "Poll not found" });
      return;
    }
    if (poll.networkKey === "127.0" || clientSubnet === "127.0" || clientSubnet === poll.networkKey) {
      res.json({ allowed: true, reason: "Network verified" });
    } else {
      res.json({ allowed: false, reason: "Not on the same network as the poll host" });
    }
    return;
  }

  res.json({ allowed: false, reason: "No session or poll specified" });
});

export default router;
