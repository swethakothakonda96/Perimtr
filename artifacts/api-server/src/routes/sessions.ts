import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  sessionsTable,
  attendeesTable,
  lockoutsTable,
  devicesTable,
} from "@workspace/db";
import { eq, and, count, desc, inArray } from "drizzle-orm";
import {
  CreateSessionBody,
  UpdateSessionBody,
  UpdateSessionParams,
  GetSessionParams,
  ListAttendeesParams,
  CheckInBody,
  CheckInParams,
  ExportAttendeesParams,
  GetSessionStatsParams,
} from "@workspace/api-zod";

const router = Router();

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function getNetworkKey(ip: string): string {
  const parts = ip.replace("::ffff:", "").split(".");
  if (parts.length === 4) return parts.slice(0, 3).join(".");
  return ip;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket.remoteAddress ?? "127.0.0.1";
}

// GET /sessions — admin only, scoped to logged-in admin
router.get("/", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const adminId = req.user.id;
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.adminId, adminId))
    .orderBy(desc(sessionsTable.createdAt));

  const now = new Date();
  const withStatus = sessions.map((s) => ({
    ...s,
    status: s.status === "active" && new Date(s.expiresAt) < now ? "expired" : s.status,
  }));

  const counts = await db
    .select({ sessionId: attendeesTable.sessionId, cnt: count() })
    .from(attendeesTable)
    .groupBy(attendeesTable.sessionId);
  const countMap = Object.fromEntries(counts.map((c) => [c.sessionId, c.cnt]));

  res.json(withStatus.map((s) => ({ ...s, attendeeCount: countMap[s.id] ?? 0 })));
});

// POST /sessions — admin only
router.post("/", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { title, durationSeconds } = parsed.data;
  const pin = generatePin();
  const clientIp = getClientIp(req);
  const networkKey = getNetworkKey(clientIp);
  const expiresAt = new Date(Date.now() + durationSeconds * 1000);

  const [session] = await db
    .insert(sessionsTable)
    .values({ adminId: req.user.id, title, pin, durationSeconds, networkKey, expiresAt, status: "active" })
    .returning();

  res.status(201).json({ ...session, attendeeCount: 0 });
});

// GET /sessions/:id — public (needed by participant join page)
router.get("/:id", async (req: Request, res: Response) => {
  const parsed = GetSessionParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, parsed.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const now = new Date();
  const status = session.status === "active" && new Date(session.expiresAt) < now ? "expired" : session.status;

  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(attendeesTable)
    .where(eq(attendeesTable.sessionId, session.id));

  res.json({ ...session, status, attendeeCount: cnt });
});

// PATCH /sessions/:id — admin only
router.patch("/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const idParsed = UpdateSessionParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = UpdateSessionBody.safeParse(req.body);
  if (!idParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [session] = await db
    .update(sessionsTable)
    .set({ status: bodyParsed.data.status ?? "ended" })
    .where(and(eq(sessionsTable.id, idParsed.data.id), eq(sessionsTable.adminId, req.user.id)))
    .returning();
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

// GET /sessions/:id/attendees — admin only
router.get("/:id/attendees", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = ListAttendeesParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const attendees = await db
    .select()
    .from(attendeesTable)
    .where(eq(attendeesTable.sessionId, parsed.data.id))
    .orderBy(attendeesTable.checkedInAt);

  // Enrich with device info
  const deviceTokens = [...new Set(attendees.map((a) => a.deviceToken))];
  const devices = deviceTokens.length
    ? await db.select().from(devicesTable).where(
        deviceTokens.length === 1
          ? eq(devicesTable.token, deviceTokens[0])
          : inArray(devicesTable.token, deviceTokens)
      )
    : [];
  const deviceMap = Object.fromEntries(devices.map((d) => [d.token, d]));

  res.json(
    attendees.map((a) => {
      const device = deviceMap[a.deviceToken];
      return {
        ...a,
        deviceInfo: device
          ? {
              platform: device.platform,
              screenResolution: device.screenResolution,
              timezone: device.timezone,
              hardwareConcurrency: device.hardwareConcurrency,
              deviceMemory: device.deviceMemory,
              userAgent: device.userAgent,
            }
          : null,
      };
    })
  );
});

// POST /sessions/:id/checkin — public (participants)
router.post("/:id/checkin", async (req: Request, res: Response) => {
  const idParsed = CheckInParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = CheckInBody.safeParse(req.body);
  if (!idParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { name, pin, deviceToken } = bodyParsed.data;
  const sessionId = idParsed.data.id;

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const now = new Date();
  if (session.status !== "active" || new Date(session.expiresAt) < now) {
    res.status(400).json({ error: "Session has expired or ended" });
    return;
  }

  const clientIp = getClientIp(req);
  const clientSubnet = getNetworkKey(clientIp);
  const subnetsMatch = clientSubnet === session.networkKey;
  // Bypass network check when either side is localhost/loopback, or when
  // all traffic is tunnelled (both IPs are external tunnel IPs that match).
  const isLoopback = (ip: string) => ip.startsWith("127.") || ip === "::1";
  const skipNetworkCheck =
    subnetsMatch ||
    isLoopback(clientIp) ||
    isLoopback(session.networkKey) ||
    session.networkKey === "127.0" ||
    session.networkKey === "::1";
  if (!skipNetworkCheck) {
    res.status(403).json({ error: "Not on the same network as the session host" });
    return;
  }

  const existingAttendees = await db
    .select()
    .from(attendeesTable)
    .where(eq(attendeesTable.sessionId, sessionId));

  const alreadyCheckedInByToken = existingAttendees.some((a) => a.deviceToken === deviceToken);
  if (alreadyCheckedInByToken) {
    res.status(403).json({ error: "This device has already checked in to this session" });
    return;
  }

  const MAX_ATTEMPTS = 3;
  let [lockout] = await db
    .select()
    .from(lockoutsTable)
    .where(
      and(
        eq(lockoutsTable.deviceToken, deviceToken),
        eq(lockoutsTable.sessionId, sessionId)
      )
    );

  if (lockout?.lockedAt) {
    res.status(403).json({ error: "Device is locked out for this session", attemptsRemaining: 0 });
    return;
  }

  if (pin !== session.pin) {
    const newAttempts = (lockout?.attempts ?? 0) + 1;
    if (lockout) {
      await db
        .update(lockoutsTable)
        .set({
          attempts: newAttempts,
          lockedAt: newAttempts >= MAX_ATTEMPTS ? now : null,
          updatedAt: now,
        })
        .where(eq(lockoutsTable.id, lockout.id));
    } else {
      await db.insert(lockoutsTable).values({
        deviceToken,
        sessionId,
        attempts: newAttempts,
        lockedAt: newAttempts >= MAX_ATTEMPTS ? now : null,
      });
    }
    const remaining = Math.max(0, MAX_ATTEMPTS - newAttempts);
    if (remaining === 0) {
      res.status(403).json({ error: "Device locked out after too many incorrect attempts", attemptsRemaining: 0 });
    } else {
      res.status(400).json({ error: "Incorrect PIN", attemptsRemaining: remaining });
    }
    return;
  }

  if (lockout) {
    await db
      .update(lockoutsTable)
      .set({ attempts: 0, lockedAt: null, updatedAt: now })
      .where(eq(lockoutsTable.id, lockout.id));
  }

  const [attendee] = await db
    .insert(attendeesTable)
    .values({ sessionId, name, deviceToken, ipAddress: clientIp })
    .returning();

  res.json({ success: true, attendeeId: attendee.id, name: attendee.name });
});

// GET /sessions/:id/export — admin only
router.get("/:id/export", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = ExportAttendeesParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, parsed.data.id), eq(sessionsTable.adminId, req.user.id)));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const attendees = await db
    .select()
    .from(attendeesTable)
    .where(eq(attendeesTable.sessionId, parsed.data.id))
    .orderBy(attendeesTable.checkedInAt);

  const lines = [
    "Name,Device Token,IP Address,Checked In At",
    ...attendees.map((a) =>
      [
        `"${a.name.replace(/"/g, '""')}"`,
        a.deviceToken,
        a.ipAddress ?? "",
        a.checkedInAt.toISOString(),
      ].join(",")
    ),
  ];
  const csv = lines.join("\n");
  const filename = `${session.title.replace(/[^a-z0-9]/gi, "_")}_attendees.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

// GET /sessions/:id/stats — admin only
router.get("/:id/stats", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = GetSessionStatsParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, parsed.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const attendees = await db
    .select()
    .from(attendeesTable)
    .where(eq(attendeesTable.sessionId, parsed.data.id))
    .orderBy(attendeesTable.checkedInAt);

  const now = new Date();
  const status = session.status === "active" && new Date(session.expiresAt) < now ? "expired" : session.status;

  const buckets: Record<string, number> = {};
  for (const a of attendees) {
    const bucket = new Date(a.checkedInAt);
    bucket.setSeconds(0, 0);
    const key = bucket.toISOString();
    buckets[key] = (buckets[key] ?? 0) + 1;
  }
  const checkInsOverTime = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, count]) => ({ time, count }));

  res.json({
    sessionId: session.id,
    title: session.title,
    attendeeCount: attendees.length,
    status,
    expiresAt: session.expiresAt.toISOString(),
    checkInsOverTime,
  });
});

// DELETE /sessions/:id/delete — admin only
router.delete("/:id/delete", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, id), eq(sessionsTable.adminId, req.user.id)));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await db.delete(attendeesTable).where(eq(attendeesTable.sessionId, id));
  await db.delete(lockoutsTable).where(eq(lockoutsTable.sessionId, id));
  await db.delete(sessionsTable).where(eq(sessionsTable.id, id));
  res.status(204).send();
});

export default router;
