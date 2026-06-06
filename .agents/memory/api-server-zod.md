---
name: No zod in api-server routes
description: zod is not bundled in api-server — use manual validation
---

The api-server's esbuild bundle cannot resolve `zod` or `zod/v4` — neither is in the api-server's `package.json` dependencies. Importing either causes a build failure.

**Why:** The api-server uses `@workspace/api-zod` (the generated Zod schemas from Orval codegen) for validation, but that package is separate. Route handlers don't directly import zod.

**How to apply:** In any new `artifacts/api-server/src/routes/*.ts` file, do manual validation:
```ts
const symbol = (typeof rawSymbol === "string" && rawSymbol.trim()) ? rawSymbol.trim().toUpperCase() : null;
if (!symbol) { res.status(400).json({ error: "symbol is required" }); return; }
```
Do NOT `import { z } from "zod"` or `import { z } from "zod/v4"` in any api-server route.
