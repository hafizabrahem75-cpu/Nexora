# Nexora development and verification

## Required environment
The API requires `DATABASE_URL` (PostgreSQL) and uses the hosting platform's `PORT`.
Set secrets only in the hosting provider's private environment/secrets settings.
Never commit real credentials or expose admin credentials in `EXPO_PUBLIC_*` variables;
Expo embeds those values in the client application.

## Run API on Replit
The Run command builds the API from source and starts it:
```sh
pnpm --filter @workspace/api-server run dev
```

## Run mobile app separately
In a second Shell/process:
```sh
pnpm --filter @workspace/mobile run dev
```
The Expo app and API are separate processes. Configure the mobile app's
`EXPO_PUBLIC_DOMAIN` to the public API host expected by
`artifacts/mobile/lib/api.ts`.

## Local checks
```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm --filter @workspace/api-server run build
```

The repository did not previously contain an automated test suite. CI checks install,
TypeScript, and API bundling; it does not claim end-to-end flows or Expo Go have passed.
Only apply Drizzle schema changes to a development database after reviewing the diff.
Never use force schema push against production data.
