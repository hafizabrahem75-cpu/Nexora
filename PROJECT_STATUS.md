# Nexora — Project Status & Roadmap

> Living handoff document. Update this file after each verified development milestone.
> Last reviewed: 2026-11-17
> Repository: https://github.com/hafizabrahem75-cpu/Nexora
> Branch: main
> Reviewed source commit: f6847213b813e61f2b9a4996dd6c993403c3ad17
> Commit message: Community V4 - Image Support Phase 1
> Important: This review inspects committed source and repository structure. It does NOT prove runtime behavior, production security, or successful device/build tests.

## 1. Project architecture observed

- Mobile app: Expo 54 / React Native 0.81 / TypeScript under `artifacts/mobile`.
- API: Express 5 / TypeScript under `artifacts/api-server`.
- Database: PostgreSQL with Drizzle ORM under `lib/db`.
- Real-time layer: WebSocket manager in `artifacts/api-server/src/lib/wsManager.ts`.
- Workspace: pnpm monorepo with root workspace configuration.
- Mobile routes observed: login, signup, email verification, forgot password, home, profile, community, search, friends, followers/following, conversations/chat, goals, tasks, notes, notifications, settings, admin, Nexora AI and video import.
- API route modules observed: auth, users, friends, follows, community, conversations, goals, tasks, notes, notifications, support, admin and health.

## 2. Implemented foundations found in source

### Accounts and profiles
- Registration/login/logout/current-user flows exist.
- Password hashing uses bcrypt in the authentication route.
- Username and profile-related fields exist.
- Email verification and password-reset token tables and route/UI paths exist.
- Session records and authentication middleware exist.

### Social graph
- Friend request and friendship schema/routes exist.
- Follow schema/routes exist.
- User search and profile routes exist.
- Followers/following screens exist in the mobile app.

### Community
- Post, comment and like schema/routes exist.
- Community feed and following feed functionality was previously implemented.
- Save-post and report-post tables/routes exist.
- Likes list endpoint/UI sheet exists.
- Image upload support exists through a post_images table and community image endpoints.
- Image upload implementation was reported in the Phase 1 checkpoint to validate file signatures/types, enforce a 5 MB decoded-size limit, apply per-user rate limiting, and link uploaded images to posts. Runtime verification is still required.

### Messaging and notifications
- One-to-one conversations, participants and messages have database schemas and API routes.
- WebSocket manager exists for real-time events.
- Notifications schema, routes and mobile context/screen exist.

### Productivity
- Goals, tasks and notes have database schemas, API routes and mobile screens.
- Reminder picker and notification utilities exist.
- App-lock context and lock-screen component exist.

### Administration and support
- Admin API and mobile screen exist.
- Support submission schema, route and screen integration exist.

## 3. Security and production blockers observed or requiring immediate verification

These findings are based on inspected source at the reviewed commit, not a penetration test.

1. Session token storage: the session implementation was observed storing a raw token value in the database. Recommended remediation: generate high-entropy tokens, store only a cryptographic hash, compare hashes on requests, rotate/revoke sessions safely, and migrate existing sessions.
2. Email verification: registration currently assigns `emailVerified: true` rather than requiring successful verification. Email verification must be enforced before production account activation.
3. Email delivery: `artifacts/api-server/src/lib/email.ts` is a development/logging implementation, not a verified production email provider integration.
4. Profile and messaging privacy: privacy preference fields exist, but inspected user/conversation route paths did not demonstrate comprehensive enforcement. Add centralized authorization checks and negative tests for private profiles and messaging restrictions.
5. Account deletion: inspected delete-account route did not require current-password reauthentication. Add reauthentication and consider a confirmation/retention policy.
6. Admin access: `requireAdmin.ts` relies on a shared `DEVELOPER_SECRET` header. Replace with an owner-only admin identity/role, strong reauthentication, least privilege, audit logs, rate limits and secret rotation. Never embed admin secrets in the mobile app.
7. Reset and verification tokens: verify hashing at rest, expiry, one-time use, attempt limits, invalidation and non-enumerating responses.
8. Mobile token storage: verify whether the app uses platform secure storage for authentication tokens; do not assume AsyncStorage is suitable for secrets.
9. Authorization: systematically test ownership checks for posts, images, messages, goals, tasks, notes, reports and admin endpoints.
10. Upload safety: validate actual file bytes, size, ownership, storage isolation, access controls and image processing. Do not trust client-provided MIME types or filenames.
11. Operational security: production HTTPS, secure headers, strict CORS origins, rate limiting, structured redacted logs, secret management, backups and dependency updates remain to be verified.

## 4. Functionality to complete or verify

### Community
- Multi-image posts and video upload/playback.
- Hashtags, mentions, post search and discovery/trending.
- Cursor pagination for feeds and engagement lists.
- Moderation queue and admin report review.
- Block/mute controls and visibility enforcement.
- Verify comment editing/deletion and complete moderation behavior.

### Messaging
- Read receipts and typing indicators.
- Group conversations.
- Message edit/delete and search.
- Media/file attachments.
- Push notifications and robust reconnect/offline behavior.
- Verify WebSocket authentication, authorization and multi-instance scaling.

### Productivity
- Verify subtasks, recurring tasks, recurring goals, calendar views and collaboration.
- Improve notes formatting, organization, search and sharing.
- Verify reminder delivery when app is backgrounded or terminated.

### AI
- Replace mock/template behavior with a real server-side AI integration.
- Implement goal analysis and actionable plans.
- Implement actual video content analysis/transcription and extraction of goals/tasks.
- Keep provider API keys on the server; add quotas, abuse controls, privacy disclosures and cost limits.
- Verify in-chat assistant and smart-reply behavior is not mock-only.

### Notifications
- Configure real push delivery (Android and iOS as applicable).
- Add notification preferences, deep links, delivery/retry handling and device-token lifecycle.

### Design and accessibility
- Review every screen for visual consistency, Arabic-first RTL correctness, responsive layouts, loading/empty/error states and accessibility.
- User's target is a polished premium interface; code presence alone does not establish design completion.

## 5. Replit independence / deployment work

Repository still contains Replit-specific artifacts/configuration such as `.replit`, `replit.nix`, `replit.md`, and artifact metadata. The mobile build script and API configuration must be inspected and refactored to use explicit environment configuration rather than Replit-only host assumptions.

Required work:
- Define separate development, staging and production environment variables.
- Set a configurable API base URL and WebSocket URL; remove hardcoded Replit assumptions.
- Choose a hosting provider for the API and managed PostgreSQL, with a free-tier/cost review before adoption.
- Choose object storage for user uploads.
- Configure migrations, backups, health checks, logs and monitoring.
- Configure Expo/EAS or another supported Android build path and signing credentials.
- Test a release APK on a physical Android device against the production-like API.
- GitHub stores source and history; GitHub alone does not run the API/database or build/test an APK.

## 6. Repository hygiene

The reviewed tree contains generated build output, source maps, TypeScript build metadata and a zip archive. Review what should be tracked; normally keep source/config/lockfiles and exclude reproducible build output, temporary artifacts, local secrets and large generated archives where appropriate. Before deleting anything, verify whether deployment or release workflows depend on it.

## 7. Recommended order of work

1. Create a clean reproducible local development workflow independent of Replit, without changing app behavior.
2. Add automated tests around authentication, authorization, privacy and core API behavior.
3. Harden authentication/session lifecycle and secure mobile token storage.
4. Enforce email verification and implement production email delivery.
5. Enforce profile, messaging and resource ownership/privacy rules; require reauthentication for sensitive actions.
6. Replace shared-secret admin access with owner-only role-based access and audit logging.
7. Complete community media, moderation, pagination and discovery.
8. Complete messaging features and push notifications.
9. Complete goals/tasks/notes and reliable reminders.
10. Implement real AI workflows with server-side secrets and cost controls.
11. Polish all mobile screens and RTL behavior.
12. Deploy backend/database/storage, run security and functional tests, then build/sign/release the APK.

## 8. Verification status and limits

- Confirmed from repository: branch `main` points to commit `f6847213b813e61f2b9a4996dd6c993403c3ad17`.
- Confirmed from source tree: the app, API, DB schema, route modules and screens listed above exist.
- Not verified by this static review: successful clean install/build, database migration on a fresh database, live API behavior, device UX, push delivery, production hosting, penetration test, or release APK.
- Historical audit: `AUDIT.md` contains an earlier review dated 2026-06-17 and must be treated as historical context, not current test evidence.
- Do not assign a single completion percentage until a repeatable test matrix has been run.

## 9. Working rules

- GitHub `main` is the canonical source of truth.
- Make one scoped change at a time; use a feature branch for risky work.
- Inspect current code before editing; do not assume old audit findings are still current.
- Add tests with each security-sensitive change.
- Review diffs before merging to `main`.
- Update this file only with verified outcomes, and record commit hashes for completed milestones.
- Never commit secrets, production credentials, private keys, signing files or real user data.


## 10. Work started on branch `development/no-replit-setup` (2026-11-17)

The following configuration-only changes have been committed to the development branch; they have NOT yet been runtime-tested or merged into `main`:

- Mobile dev script now runs the standard `expo start` command instead of injecting Replit-specific environment variables.
- Mobile API client accepts `EXPO_PUBLIC_API_URL`; legacy `EXPO_PUBLIC_DOMAIN` remains as temporary fallback.
- WebSocket client accepts `EXPO_PUBLIC_WS_URL`; legacy preview URL fallback remains temporarily.
- API CORS accepts comma-separated `CORS_ALLOWED_ORIGINS`; localhost is allowed for development and old Replit variables remain only as a compatibility bridge.
- Static Expo build script accepts `PUBLIC_BASE_URL` (or `EXPO_PUBLIC_WEB_URL`) before checking legacy Replit variables.
- Removed the hardcoded `https://replit.com/` Expo Router plugin origin.
- Added root `.gitignore` rules for environment files, build output, caches and signing/private-key files.
- Added root `.env.example` with placeholders only. It contains no real credentials; `EXPO_PUBLIC_*` values are public client configuration and must never contain secrets.

### Still pending in Replit independence phase

- Inspect and decide whether to retire legacy `.replit`, `replit.nix`, `replit.md` and artifact metadata; do not delete them until all references are understood.
- Review every remaining Replit-specific variable and script, including static build and workspace scripts.
- Add a reproducible install/start/build guide for the intended Linux/Android development setup.
- Run pnpm install, DB migration, API typecheck/build, mobile typecheck and Expo export in a real development environment.
- Configure and test a real API and WebSocket deployment origin before building a release APK.

### Important security follow-up

- WebSocket authentication still places the session token in the URL query string. This is not fixed by the configurable URL work. Replace it with a safer authentication handshake and test that tokens are not written to logs.
- Mobile session storage and server-side raw session-token storage remain separate high-priority security tasks described above.
- No provider API keys, email passwords, storage credentials or production database secrets were added.


### Security incident response added during Replit independence review (2026-11-17)

- The tracked `.replit` file contained literal shared admin-secret values. Those values have been removed from the development branch file. Because the values existed in repository history, treat them as compromised and do not reuse them.
- The mobile admin screen previously compiled `EXPO_PUBLIC_ADMIN_SECRET` into the client and sent it as `x-admin-secret`. This is not a safe authorization design because client-bundled secrets can be extracted.
- Development branch replaces shared-secret admin authorization with a bearer-authenticated session and a server-side `users.isDeveloper` authorization check. The auth middleware now includes the server-controlled role flag in the authenticated user object.
- Admin API calls from the mobile screen now use the signed-in session token; no admin secret is embedded in the app.
- This is source-reviewed only. It still requires API/mobile typecheck, login/admin positive and negative authorization tests, and confirmation that only the intended owner account has `isDeveloper=true`.
- Do not deploy or merge until those checks pass. The old `main` branch still has the prior shared-secret implementation until this pull request is reviewed and merged.


### Session-token hardening and WebSocket authentication (2026-11-17)

Changes committed to the development branch; not yet runtime-tested:

- Added `hashSessionToken` using SHA-256 for high-entropy session tokens.
- Registration and login now persist only the token digest in the existing sessions.token column; the raw token is returned to the client once.
- REST authentication checks the digest and temporarily accepts legacy raw-token rows; a successful legacy authentication upgrades that row to a digest.
- Logout deletes the digest rather than searching for the raw token.
- WebSocket authentication now sends the session token in the first encrypted WebSocket frame instead of the URL query string. This avoids placing bearer tokens in URL paths that may be logged by proxies.
- The WebSocket server limits payload size to 1 KB and allows only one initial authentication attempt before registering the connection.
- Existing WebSocket and REST sessions are intended to remain compatible during the transition through legacy raw-token lookup and in-place digest upgrade.

### Required validation before merge

- Run API TypeScript check/build and mobile TypeScript check.
- Verify registration/login return a usable raw token while database rows contain only SHA-256 digests.
- Verify legacy raw-token sessions authenticate once and are upgraded.
- Verify logout revokes the hashed session.
- Verify WebSocket authentication succeeds only after the first auth frame; no token appears in the URL, proxy access logs or application logs.
- Verify malformed/oversized WebSocket frames are rejected and unauthenticated sockets cannot receive events.
- Review race handling, connection timeouts, reconnect behavior and logout while WebSocket is connected.
- This source-only review does not constitute a security audit or prove end-to-end encryption of private messages.


### Mobile session restore and WebSocket client follow-up (2026-11-17)

- Fixed AuthContext startup behavior: temporary network failures, timeouts, and API 5xx errors no longer delete the locally saved session token. The app clears the saved token only when the server explicitly rejects the session with 401/403.
- WebSocket client now waits for the server's `authenticated` acknowledgement before forwarding application events to app listeners.
- These changes are source-reviewed only and still require device tests for offline startup, expired sessions, reconnects, and message delivery.

### SecureStore dependency compatibility

- The mobile app currently uses Expo SDK 54, while `expo-secure-store` is declared as `^56.0.4`.
- Expo's SDK 54 versioned documentation recommends `~15.0.8` for SecureStore. Do not import/use SecureStore until the dependency and lockfile are aligned and installation/typecheck passes.
- Next environment task: update the package to the SDK 54-compatible version using `pnpm expo install expo-secure-store` (or equivalent pinned version), regenerate `pnpm-lock.yaml`, then add the SecureStore config plugin and implement a safe one-time migration from AsyncStorage.
- Keep web preview storage behavior separate; SecureStore is for native Android/iOS. Do not silently fall back to plaintext AsyncStorage on native if SecureStore fails.


### Native session token storage migrated to Expo SecureStore (2026-11-17)

Changes committed to `development/no-replit-setup`; runtime validation is still pending:

- Aligned `expo-secure-store` to `~15.0.8`, the Expo SDK 54 compatible line, rather than the previously declared SDK 56 package.
- Updated the pnpm lockfile importer, package resolution and snapshot for SecureStore 15.0.8.
- Added the `expo-secure-store` config plugin to `artifacts/mobile/app.json`.
- Native Android/iOS now read and write the session token through SecureStore (Android Keystore-backed encrypted preferences / iOS Keychain).
- Web retains the existing AsyncStorage storage path because SecureStore is native-only.
- Added one-time native migration: read legacy AsyncStorage token, write to SecureStore, read back and verify equality, then delete the legacy copy. If SecureStore fails or verification does not match, the code throws and does not silently fall back to plaintext storage.
- Sign-in/sign-up writes the token to SecureStore and verifies it before returning; logout/deletion clears SecureStore and the legacy key.

### Required tests before merge

- `pnpm install --frozen-lockfile` from the repository root must succeed; the lockfile was edited based on the published 15.0.8 package metadata but has not yet been regenerated by pnpm in a real environment.
- Run shared/API/mobile TypeScript checks.
- On Android: fresh login stores token in SecureStore; restart restores session; migration moves old AsyncStorage token and removes old copy only after verified write; rejected/expired token clears both stores; network outage preserves secure token.
- On web: ensure existing AsyncStorage login/restore/logout behavior still works.
- Test app reinstall/backup behavior and device lock conditions on a physical Android device.
- Do not claim the entire phone or application is immune to spyware, malware, rooted-device compromise or OS-level interception. SecureStore protects local token storage at rest; transport still relies on HTTPS/WSS and app/device security.


### GitHub Actions validation result for SecureStore migration (2026-11-17)

- Latest run for head commit `246fec181adac2a68f84df388b50616de7b06149` completed successfully.
- `pnpm install --frozen-lockfile`: passed.
- Shared libraries TypeScript check: passed.
- API TypeScript check: passed.
- Mobile TypeScript check: passed.
- This confirms dependency lock consistency and static type checks in GitHub's Linux runner. It does not replace native Android runtime tests, Expo prebuild/doctor, API integration tests, or security tests on a physical device.


### Expo SDK 54 compatibility review (2026-11-17)

Reviewed Expo's own SDK 54 `bundledNativeModules.json` from the `expo/expo` repository tag `sdk-54`. It lists these compatible package ranges:

- `expo-secure-store`: `~15.0.8` (already aligned)
- `expo-contacts`: `~15.0.11`
- `expo-crypto`: `~15.0.9`
- `expo-local-authentication`: `~17.0.9`
- `expo-notifications`: `~0.32.17`

The current mobile package manifest still declares the latter four as SDK 56 versions. They have not been changed yet because their exact lockfile resolutions must be regenerated by pnpm; do not hand-edit integrity hashes or guess transitive package snapshots. Added a warning-only `expo install --check` step to GitHub Actions to report SDK compatibility without masking the regular typecheck job.

Source: https://github.com/expo/expo/blob/sdk-54/packages/expo/bundledNativeModules.json

### Additional release security blockers found during source review

- Registration currently writes `emailVerified: true` directly. Email verification is not actually enforced for newly registered accounts. Keep this developer bypass only during controlled testing; remove it and require real verification before public release.
- Admin routes are protected by server-side `requireAuth` plus the account's `isDeveloper` database flag; no shared admin secret is required in the current development branch. Still needs negative authorization tests and confirmation that only the owner's account is granted this flag.
- WebSocket client now waits for server acknowledgement before dispatching application events. Needs integration tests for bad/expired tokens, reconnect, logout, and simultaneous sessions.


### Production email-verification safety gate (2026-11-17)

- Removed the unconditional `emailVerified: true` assignment during account registration.
- New accounts are now unverified by default.
- Temporary verification bypass is allowed only when BOTH conditions hold: `NODE_ENV` is not `production` and `ALLOW_UNVERIFIED_EMAIL=true`.
- Production ignores this bypass even if the environment variable is accidentally set.
- Real email delivery and verification-token lifecycle still need end-to-end implementation/testing before launch. For developer testing, set the explicit bypass only in a non-production environment; do not set it in production.


## Security review update — 2026-11-17

### Newly confirmed findings (server-side code review)
- Profile visibility and messaging privacy fields exist, but the reviewed profile and conversation route handlers do not consistently enforce those preferences.
- Password reset tokens are stored and queried as raw values; they should be stored as one-way digests and consumed atomically.
- Account deletion currently has no current-password re-authentication.
- Password change updates the password hash but does not revoke the user's existing sessions.
- User profile posts and follower/following list endpoints expose data without applying the target user's visibility preference.
- Image retrieval is intentionally unauthenticated for linked public-post images; this must be reconciled with private-account/post visibility before private content is supported.

### Required remediation order
1. Define exact privacy semantics for `everyone`, `friends`, and `nobody`; enforce them consistently on profile, posts, followers/following, search, and messaging endpoints.
2. Hash password-reset and email-verification tokens; enforce one-time use and atomic consumption.
3. Require password re-authentication for account deletion and other sensitive account actions.
4. Revoke other active sessions after password changes; provide a session/device management path.
5. Add authorization regression tests for cross-account IDOR attempts and private-resource access.
6. Review image access/cache policy before introducing private posts or private accounts.

No production secrets, paid-service credentials, or API keys are required for this remediation phase. This is a code-review checkpoint; runtime/security tests are still required before merging.


## Privacy enforcement implementation checkpoint — 2026-11-17

### Code changes made on development branch
- User profile endpoint now checks the target user's `profileVisibility`: `everyone` permits viewing, `friends` requires a friendship, and other values deny access (except self).
- User profile-post endpoint applies the same visibility check.
- Followers and following list endpoints now apply profile visibility using the same everyone/friends/deny policy.
- Conversation creation and message sending now check the recipient's `messagingPrivacy`: `everyone` allows, `friends` requires an existing friendship, and `nobody` or unknown values deny.
- Changes were made in `users.ts`, `follows.ts`, and `conversations.ts`.

### Important limitations — do not call privacy complete
- Search and username lookup still need a privacy policy review.
- Follow creation itself does not yet implement private-account follow requests.
- Community global/following feeds, post detail/comments/likes, saved posts, and image delivery need a consistent visibility/authorization audit.
- Existing conversations may be blocked from sending after a recipient changes messaging privacy; product behavior for existing threads needs a deliberate decision.
- Privacy enum values and mobile settings UI must be verified together before release.
- Automated authorization tests and runtime tests have not yet been run for these changes.

### Next security tasks
1. Review all community endpoints and image serving for private-resource access and IDOR.
2. Verify settings UI and allowed privacy enum values against server enforcement.
3. Add automated cross-user authorization tests for profiles, posts, followers/following, and conversations.
4. Fix password reset/email verification token hashing and atomic single-use consumption.
5. Require re-authentication for sensitive account changes and revoke sessions after password change.
6. Continue admin authorization and secrets-history remediation.


## Community image access hardening — 2026-11-17
- Image delivery endpoint now requires an authenticated session.
- Image lookup joins the linked post and owner account, then applies owner profile visibility: self always allowed; `everyone` allowed; `friends` requires a friendship; other/unknown visibility values denied.
- Image responses use private/no-store caching and `X-Content-Type-Options: nosniff`.
- This does not complete community privacy: feed queries, post detail, comments, likes, saves, reports, and follow/search behavior still require a systematic authorization review.
- Runtime tests and mobile image loading regression tests have not yet been run. Public unauthenticated image embedding is no longer supported by this endpoint; verify intended UX before release.


## Community feed visibility checkpoint — 2026-11-17
- Global community feed and following feed now filter post rows against the author's profile visibility before returning post content or image identifiers.
- `everyone` posts are visible; `friends` posts require a friendship; unknown/restricted visibility values are hidden from other users; owners can see their own posts.
- This adds per-row friendship lookups and is a correctness-first implementation. Before production, optimize with a joined/CTE query and add pagination to avoid N+1 query load.
- Still not complete: comments, likes lists, saved posts, post detail, notifications, search, follow requests, and all image/mobile loading paths need authorization review and tests.
- No runtime or automated security regression test has been executed for this change yet.


## Community interaction and realtime privacy hardening — 2026-11-17
- Added a shared server-side post access check and applied it to like/unlike, likes list, comments list/create, save/unsave, and report routes.
- The check permits the owner, permits `everyone`, requires friendship for `friends`, and denies unknown/restricted visibility values.
- Replaced community route WebSocket `broadcastAll` calls for post updates/deletes/likes/unlikes/comments with targeted delivery to the acting user and post owner. This prevents private post IDs, comment text, and interaction events from being pushed to every connected account.
- This is not a full realtime audience implementation: other authorized viewers may not receive live updates until a visibility-aware audience broadcaster is implemented.
- No runtime tests or authorization regression suite has been run yet. Review WebSocket recipient semantics and client expectations before merge.


## Account recovery and sensitive-action hardening — 2026-11-18
- New password-reset tokens are stored as SHA-256 digests; raw tokens are sent only to the email delivery function and are not persisted in the token table.
- New email-verification tokens are stored as SHA-256 digests.
- Password-reset tokens are atomically marked used with a conditional update before password replacement; concurrent reuse is rejected.
- Email-verification tokens are consumed with conditional delete-and-return before marking the account verified, preventing normal concurrent replay.
- Password change revokes all other sessions while retaining the current authenticated session.
- Account deletion now requires the current password.
- Compatibility note: outstanding tokens created before this digest change will no longer validate. This should be acceptable before launch, but must be communicated if there are active test accounts.
- Follow-up required: wrap token consumption + password update + session revocation in a database transaction; add rate limits to login/forgot/reset/verify endpoints; add password-change notification; add session/device management and re-authentication for email changes; run concurrency and end-to-end tests. No runtime tests have been executed for this change.


## Authentication abuse controls and email-secret logging — 2026-11-18
- Added the shared auth rate limiter to `/api/auth/reset-password` and `/api/auth/verify-email` in addition to login/register/forgot-password.
- Hardened the email stub: it is development-only and throws in production rather than logging raw password-reset or verification tokens. No email provider is configured yet; production account registration/recovery must not be enabled until a real provider or another verified delivery mechanism is configured and tested.
- Confirmed `requireAuth` checks session expiry and hashes session tokens, while retaining a temporary legacy raw-token compatibility path that upgrades the token after authentication. Remove that compatibility path after legacy sessions have expired/revoked.
- Confirmed admin middleware requires authenticated `isDeveloper`; still verify that only the intended owner account can ever receive this DB flag and add audited admin actions / re-authentication.
- No build, typecheck, runtime, concurrency, or mobile regression tests were run for these changes.
