---
name: Express v5 params typing
description: Express v5 changed ParamsDictionary to return `string | string[]`; drizzle eq() only accepts `string | SQLWrapper`
---

In Express v5, `req.params.id` is typed as `string | string[]`, but drizzle-orm's `eq()` only accepts `string | SQLWrapper`.

**Why:** Express v5 changed the ParamsDictionary type to be more permissive, breaking code that passes route params directly to drizzle.

**How to apply:** Cast at the point of use: `const id = req.params.id as string;` or inline `eq(table.id, req.params.id as string)`.
