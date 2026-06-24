import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sessionsTable, attendeesTable, pollsTable, votesTable } from "@workspace/db";
import { eq, count, and } from "drizzle-orm";

const router = Router();

// GET /dashboard/stats — admin only, scoped to logged-in admin
router.get("/stats", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const adminId = req.user.id;

  const [sessionCount] = await db
    .select({ cnt: count() })
    .from(sessionsTable)
    .where(eq(sessionsTable.adminId, adminId));

  const allSessions = await db
    .select({ id: sessionsTable.id, status: sessionsTable.status, expiresAt: sessionsTable.expiresAt })
    .from(sessionsTable)
    .where(eq(sessionsTable.adminId, adminId));

  const sessionIds = allSessions.map((s) => s.id);

  let attendeeCount = { cnt: 0 };
  if (sessionIds.length > 0) {
    const [row] = await db
      .select({ cnt: count() })
      .from(attendeesTable)
      .where(eq(attendeesTable.sessionId, sessionIds[0]));
    if (sessionIds.length === 1) {
      attendeeCount = row;
    } else {
      const rows = await db.select({ cnt: count() }).from(attendeesTable);
      attendeeCount = rows[0];
    }
  }

  const [pollCount] = await db
    .select({ cnt: count() })
    .from(pollsTable)
    .where(eq(pollsTable.adminId, adminId));

  const allPolls = await db
    .select({ id: pollsTable.id, status: pollsTable.status })
    .from(pollsTable)
    .where(eq(pollsTable.adminId, adminId));

  const pollIds = allPolls.map((p) => p.id);
  let voteCount = { cnt: 0 };

  const now = new Date();
  const activeSessions = allSessions.filter(
    (s) => s.status === "active" && new Date(s.expiresAt) > now
  ).length;
  const activePolls = allPolls.filter((p) => p.status === "active").length;

  if (pollIds.length > 0) {
    const rows = await db.select({ cnt: count() }).from(votesTable);
    voteCount = rows[0];
  }

  res.json({
    totalSessions: sessionCount.cnt,
    totalAttendees: attendeeCount.cnt,
    totalPolls: pollCount.cnt,
    totalVotes: voteCount.cnt,
    activeSessions,
    activePolls,
  });
});

export default router;
