---
name: DB schema push required on first run
description: Nexora DB tables must be created via drizzle-kit push before the API server can serve requests
---

The API server will throw `relation "sessions" does not exist` (and similar) on first run if the DB schema hasn't been pushed.

**Why:** drizzle-orm does not auto-migrate; the schema must be pushed explicitly.

**How to apply:** Run `pnpm --filter @workspace/db run push` once after a fresh environment or schema changes. Also needed when deploying to a new production DB.
