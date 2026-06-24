import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { pollsTable, votesTable } from "@workspace/db";
import { eq, and, count, desc } from "drizzle-orm";
import {
  CreatePollBody,
  UpdatePollBody,
  UpdatePollParams,
  GetPollParams,
  CastVoteBody,
  CastVoteParams,
  GetPollResultsParams,
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

// GET /polls — admin only, scoped to logged-in admin
router.get("/", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const polls = await db
    .select()
    .from(pollsTable)
    .where(eq(pollsTable.adminId, req.user.id))
    .orderBy(desc(pollsTable.createdAt));

  const voteCounts = await db
    .select({ pollId: votesTable.pollId, cnt: count() })
    .from(votesTable)
    .groupBy(votesTable.pollId);
  const countMap = Object.fromEntries(voteCounts.map((v) => [v.pollId, v.cnt]));

  res.json(polls.map((p) => ({ ...p, totalVotes: countMap[p.id] ?? 0 })));
});

// POST /polls — admin only
router.post("/", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreatePollBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { question, options, pinRequired } = parsed.data;
  const pin = pinRequired ? generatePin() : null;
  const clientIp = getClientIp(req);
  const networkKey = getNetworkKey(clientIp);

  const [poll] = await db
    .insert(pollsTable)
    .values({ adminId: req.user.id, question, options, pin, pinRequired, networkKey, status: "active" })
    .returning();

  res.status(201).json({ ...poll, totalVotes: 0 });
});

// GET /polls/:id — public (needed by participant vote page)
router.get("/:id", async (req: Request, res: Response) => {
  const parsed = GetPollParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [poll] = await db
    .select()
    .from(pollsTable)
    .where(eq(pollsTable.id, parsed.data.id));
  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(votesTable)
    .where(eq(votesTable.pollId, poll.id));

  res.json({ ...poll, totalVotes: cnt });
});

// PATCH /polls/:id — admin only
router.patch("/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const idParsed = UpdatePollParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = UpdatePollBody.safeParse(req.body);
  if (!idParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const updates: Partial<typeof pollsTable.$inferSelect> = {};
  if (bodyParsed.data.status !== undefined) updates.status = bodyParsed.data.status;
  if (bodyParsed.data.pinRequired !== undefined) {
    updates.pinRequired = bodyParsed.data.pinRequired;
    updates.pin = bodyParsed.data.pinRequired ? generatePin() : null;
  }

  const [poll] = await db
    .update(pollsTable)
    .set(updates)
    .where(and(eq(pollsTable.id, idParsed.data.id), eq(pollsTable.adminId, req.user.id)))
    .returning();
  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }
  res.json(poll);
});

// POST /polls/:id/vote — public (participants)
router.post("/:id/vote", async (req: Request, res: Response) => {
  const idParsed = CastVoteParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = CastVoteBody.safeParse(req.body);
  if (!idParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { optionIndex, deviceToken, pin } = bodyParsed.data;
  const pollId = idParsed.data.id;

  const [poll] = await db
    .select()
    .from(pollsTable)
    .where(eq(pollsTable.id, pollId));
  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }
  if (poll.status !== "active") {
    res.status(400).json({ error: "Poll has ended" });
    return;
  }

  const clientIp = getClientIp(req);
  const clientSubnet = getNetworkKey(clientIp);
  const subnetsMatch = clientSubnet === poll.networkKey;
  const isLoopback = (ip: string) => ip.startsWith("127.") || ip === "::1";
  const skipNetworkCheck =
    subnetsMatch ||
    isLoopback(clientIp) ||
    isLoopback(poll.networkKey) ||
    poll.networkKey === "127.0" ||
    poll.networkKey === "::1";
  if (!skipNetworkCheck) {
    res.status(403).json({ error: "Not on the same network as the poll host" });
    return;
  }

  const existingVotes = await db
    .select()
    .from(votesTable)
    .where(eq(votesTable.pollId, pollId));

  const alreadyVotedByToken = existingVotes.some((v) => v.deviceToken === deviceToken);
  if (alreadyVotedByToken) {
    res.status(400).json({ error: "This device has already voted in this poll" });
    return;
  }

  if (poll.pinRequired && pin !== poll.pin) {
    res.status(403).json({ error: "Invalid PIN" });
    return;
  }

  if (optionIndex < 0 || optionIndex >= poll.options.length) {
    res.status(400).json({ error: "Invalid option" });
    return;
  }

  await db.insert(votesTable).values({ pollId, deviceToken, ipAddress: clientIp, optionIndex });
  res.json({ success: true, optionIndex });
});

// GET /polls/:id/results — public (participants can see live results)
router.get("/:id/results", async (req: Request, res: Response) => {
  const parsed = GetPollResultsParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [poll] = await db
    .select()
    .from(pollsTable)
    .where(eq(pollsTable.id, parsed.data.id));
  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }

  const allVotes = await db
    .select()
    .from(votesTable)
    .where(eq(votesTable.pollId, poll.id));

  const totalVotes = allVotes.length;
  const voteCounts = new Array(poll.options.length).fill(0);
  for (const v of allVotes) {
    if (v.optionIndex >= 0 && v.optionIndex < poll.options.length) {
      voteCounts[v.optionIndex]++;
    }
  }

  const options = poll.options.map((label, i) => ({
    label,
    votes: voteCounts[i],
    percentage: totalVotes > 0 ? Math.round((voteCounts[i] / totalVotes) * 100) : 0,
  }));

  res.json({ pollId: poll.id, question: poll.question, options, totalVotes, status: poll.status });
});

// GET /polls/:id/export — admin only, download CSV of vote results
router.get("/:id/export", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [poll] = await db
    .select()
    .from(pollsTable)
    .where(and(eq(pollsTable.id, id), eq(pollsTable.adminId, req.user.id)));
  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }

  const allVotes = await db.select().from(votesTable).where(eq(votesTable.pollId, id));
  const totalVotes = allVotes.length;
  const voteCounts = new Array(poll.options.length).fill(0);
  for (const v of allVotes) {
    if (v.optionIndex >= 0 && v.optionIndex < poll.options.length) {
      voteCounts[v.optionIndex]++;
    }
  }

  const lines = [
    "Option,Votes,Percentage",
    ...poll.options.map((label, i) => {
      const pct = totalVotes > 0 ? ((voteCounts[i] / totalVotes) * 100).toFixed(1) : "0.0";
      return `"${label.replace(/"/g, '""')}",${voteCounts[i]},${pct}%`;
    }),
    `"TOTAL",${totalVotes},100%`,
  ];

  const csv = lines.join("\n");
  const filename = `poll_results_${id}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

// DELETE /polls/:id/delete — admin only
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
  const [poll] = await db
    .select()
    .from(pollsTable)
    .where(and(eq(pollsTable.id, id), eq(pollsTable.adminId, req.user.id)));
  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }
  await db.delete(votesTable).where(eq(votesTable.pollId, id));
  await db.delete(pollsTable).where(eq(pollsTable.id, id));
  res.status(204).send();
});

export default router;
