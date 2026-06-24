---
name: replit-auth-web composite lib setup
description: Rules for using lib/replit-auth-web as a composite TypeScript lib in the workspace.
---

`lib/replit-auth-web` must be set up as a composite lib:
- `tsconfig.json` needs `composite: true`, `declarationMap: true`, `emitDeclarationOnly: true`
- Must be listed in root `tsconfig.json` references array
- Must be listed in any consuming artifact's `tsconfig.json` references array (e.g. `artifacts/syncpoll`)
- `package.json` of consuming artifact must declare `"@workspace/replit-auth-web": "workspace:*"` as a devDependency

**Why:** Without `composite: true` the lib won't emit declaration files, breaking cross-package type resolution.

**How to apply:** `import.meta.env` must NOT be used in lib code — the lib tsconfig doesn't include `vite/client` types. Use `window.location.href` directly or accept the base URL as a parameter instead.
