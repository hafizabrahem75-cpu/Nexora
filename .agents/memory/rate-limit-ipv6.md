---
name: express-rate-limit IPv6 keyGenerator validation
description: express-rate-limit v8 throws ERR_ERL_KEY_GEN_IPV6 if keyGenerator touches req.ip without the ipKeyGenerator helper
---

express-rate-limit v8 validates keyGenerator functions at startup. If the function references `req.ip` directly (even as a fallback), it throws `ERR_ERL_KEY_GEN_IPV6`.

**Why:** IPv6 addresses include the port which makes them unsuitable as raw rate-limit keys without normalization. The library requires using its own `ipKeyGenerator` helper or avoiding req.ip entirely.

**How to apply:** On authenticated routes (after requireAuth), userId is always present — use it as the sole key with a static string fallback:
```ts
keyGenerator: (req) => (req as AuthRequest).userId ?? "anonymous"
```
Never use `?? req.ip` as a fallback in keyGenerators on auth-protected routes.
