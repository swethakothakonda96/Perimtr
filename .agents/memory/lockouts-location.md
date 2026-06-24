---
name: lockoutsTable location
description: lockoutsTable is in devices.ts, NOT a separate lockouts.ts.
---

`lockoutsTable`, `insertLockoutSchema`, and `Lockout` type are all defined inside `lib/db/src/schema/devices.ts`.

**Why:** They were colocated there from the start. Creating a separate `lockouts.ts` causes TS2308 duplicate export errors via the barrel `index.ts`.

**How to apply:** Never create `lib/db/src/schema/lockouts.ts`. Import lockouts from `@workspace/db` directly.
