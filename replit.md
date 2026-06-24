# Perimtr

A secure, fraud-proof attendance tracking and live polling platform for university lectures and corporate training sessions.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/syncpoll run dev` — run the frontend (port 20299)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session signing key

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Wouter, TanStack Query, Recharts, shadcn/ui
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for all endpoints)
- `lib/db/src/schema/` — Drizzle table definitions (sessions, attendees, polls, votes, devices, lockouts)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/syncpoll/src/` — React frontend

## Architecture decisions

- **Device tokenization over accounts**: Participants are identified by a stable fingerprint-derived token stored in the `devices` table. No login required.
- **LAN matching via IP subnet**: The admin's IP subnet (first 3 octets) is stored as `network_key` when creating a session/poll. Participant check-ins are rejected if their subnet differs.
- **3-strikes lockout tracked in DB**: The `lockouts` table stores attempt counts per (device_token, session_id). Lockout is permanent for the session once 3 wrong PINs are entered.
- **PIN stored plaintext (short-lived)**: Session PINs are 4-digit random numbers with a short TTL (controlled by `duration_seconds`). They expire naturally and are not security credentials.
- **Auto-expiry via status field**: Sessions check `expiresAt` on every read and return `status: "expired"` if past. No background job needed.

## Product

- **Admin dashboard**: Live overview of active sessions, polls, attendees, and vote counts
- **Attendance module**: Create sessions with custom timers → generate QR+PIN → participants scan and check in → export CSV
- **Polling module**: Create polls with 2–6 options → toggle PIN requirement → participants vote once → live bar chart results
- **Participant flows**: `/join/:sessionId` for check-in, `/vote/:pollId` for voting — frictionless, no account needed
- **Security**: LAN matching blocks remote participants; 3-strikes locks brute-force PIN attempts; device tokens prevent double voting across browsers

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- In local development, all requests come from `127.0.0.1` so LAN matching is always allowed (subnet `127.0` matches itself). In production on a real LAN, it enforces subnet matching.
- `network_key` is set from the admin's IP at session/poll creation time. If the admin is behind a proxy, the `x-forwarded-for` header is used.
- After any OpenAPI spec change, always run codegen before using the updated types.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
