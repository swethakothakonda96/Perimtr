---
name: Auth naming collision
description: SyncPoll already has sessionsTable for attendance; OIDC session table must use a different name.
---

SyncPoll uses `sessionsTable` for attendance sessions. The Replit Auth OIDC session storage table must be named `authSessionsTable` (DB table: `auth_sessions`) to avoid a namespace clash.

**Why:** `export * from "./sessions"` and the auth schema both export a symbol called `sessionsTable`, causing TS2308 ambiguous re-export errors.

**How to apply:** Any future auth lib work must import/export `authSessionsTable` (not `sessionsTable`) from `lib/db/src/schema/auth.ts`. The `usersTable` lives in the same file.
