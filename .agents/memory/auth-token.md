---
name: Auth token storage key
description: How the quantedge frontend stores and reads the JWT token
---

The JWT token is stored in localStorage under the key `quantedge_token` (defined in `artifacts/quantedge/src/lib/auth.ts` as `TOKEN_KEY`).

Any direct fetch() calls (not using the generated React Query hooks) must read it as:
```ts
const token = localStorage.getItem("quantedge_token");
```

**Why:** Using `"token"` instead produces silent 401s — the API correctly rejects requests with no Authorization header, but the frontend appears to load normally showing empty data.

**How to apply:** Whenever writing a custom fetch in the quantedge frontend that bypasses the generated api-client-react hooks, always use `quantedge_token` as the localStorage key.
