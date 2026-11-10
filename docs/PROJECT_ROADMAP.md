# Nexora — Product Roadmap and Engineering Audit

Last reviewed: 2026-11-11
Baseline: `main` at `f6847213b813e61f2b9a4996dd6c993403c3ad17`
Working branch: `fix/ci-and-runtime`

## Product direction

Nexora is an Arabic-first social, messaging, productivity, and AI platform:
"حيث يلتقي التواصل بالذكاء". The product should combine a trusted community,
private communication, useful personal organization, and genuinely functional AI.
Security, privacy, reliability, and a polished Arabic-first experience are release
requirements, not optional later improvements.

## Release policy

Do not publish, distribute, or ask the user to install an APK until the agreed
product scope is implemented, the security review is complete, and the release
acceptance checklist has passed. Internal CI and automated checks may run during
development; Android release builds remain manual and opt-in.

## Confirmed existing functionality (source inspection)

- Account registration/login, password hashing with bcrypt, logout, profile update,
  change password, forgot/reset password endpoints, and email verification endpoint.
- Unique username checking/update and user search.
- Friend requests/friendships, follows/followers, public profiles.
- Direct conversations, message history, send message, WebSocket events, unread counts.
- Community posts, edit/delete, likes, comments, following feed, reports, saved posts,
  image upload and image delivery.
- Goals, tasks, notes, in-app notifications, support submissions, basic admin endpoints.
- Expo mobile screens exist for the main social, messaging, goals, tasks, notes,
  notification, profile, settings, AI, and video-import areas.

Presence of an endpoint or screen does not mean its complete end-to-end flow has been
verified on a running service/device.

## Verified gaps and risks

### P0 — security and account integrity
- Registration currently writes `emailVerified: true` immediately; it does not create
  or send a verification token. The login gate therefore does not provide real
  verification yet.
- Email delivery is still a development logger only; link construction now uses
  provider-neutral `PUBLIC_APP_URL` / `PUBLIC_WEB_URL` settings and the `nexora://`
  scheme. Configure a real email provider before production.
- Session tokens are stored in plaintext in the database. Store only a cryptographic
  hash and compare hashes during authentication/logout.
- Password reset tokens are currently stored as plaintext; hash them at rest.
- Review token single-use/expiry, rate limits, session revocation, password-change
  invalidation, account deletion, and concurrent registration uniqueness.
- Admin routes now validate the authenticated session and server-side `isDeveloper`
  role; the client no longer ships or sends a shared admin secret. Add audit logging,
  explicit role provisioning, and destructive-action safeguards before production.
- Public image delivery and profile visibility need privacy-aware authorization rules.
- Rotate all credentials ever committed; removing them from the latest tree does not
  erase them from Git history.

### P1 — core communication and social
- Direct-message history has cursor-style `before` pagination, but conversation list
  queries recent messages with a fixed 500-row cap.
- Read state is a conversation-level `lastReadAt`; explicit per-message delivery/read
  receipts are not present in the inspected flow.
- No typing indicator or group conversation implementation was found in the inspected
  routes/schema. Confirm before implementation.
- WebSocket manager stores connections in a process-local Map; multi-instance delivery
  needs a shared pub/sub or managed realtime layer.
- Community feed endpoints currently cap at 100; comments cap at 200. Add cursor
  pagination and robust moderation/report review.
- Add block/mute, abuse controls, and enforce messaging/profile privacy settings in
  every relevant endpoint.

### P1 — AI and video workflows
- Nexora AI goal analyzer is a local category/keyword template function
  (`runMockAI`), not a real model-backed service.
- Video import uses `runMockVideoAnalysis`; it does not upload/transcribe/analyze the
  video using a real AI pipeline.
- AI task saving currently uses local AsyncStorage rather than a canonical server-backed
  task/goal flow. Make generated results reviewable and save them to the user's account.
- Add provider abstraction, quotas, privacy consent, cost limits, retry/error handling,
  prompt safety, and Arabic evaluation before enabling model-backed AI.

### P1 — notifications, media, and support
- In-app notifications are stored and delivered over current WebSocket connections.
  Native push delivery (FCM/APNs) is not implemented/verified.
- Community images are stored as Base64 in PostgreSQL. Move binary media to object
  storage; verify ownership, upload cleanup, size limits, and private-media access.
- Support submissions can be created and read in admin routes, but moderation workflow,
  statuses, replies, and audit trail need completion.

### P2 — product experience and platform
- Review the app navigation, Arabic RTL behavior, dark/light themes, accessibility,
  loading/empty/error states, and consistent premium design.
- Complete account privacy controls, avatar upload, contacts discovery (opt-in), and
  profile customization.
- Add translation, message-to-task actions, app lock/biometric unlock, and later
  two-factor authentication.
- Build an admin dashboard with role-based permissions, audit logs, report queues,
  and safe destructive-action confirmation.
- Add product analytics with privacy-respecting opt-in and crash/error monitoring.

## Development sequence

1. Stabilize repository CI, dependency lockfile, TypeScript checks, API build, and Expo
   SDK compatibility. Keep release APK workflow manual and disabled from routine pushes.
2. Establish provider-neutral infrastructure: API hosting, PostgreSQL, migrations,
   object storage, secrets, domain/TLS, backups, health checks, and deployment rollback.
3. Close P0 security issues: verification, email provider, hashed session/reset tokens,
   session management, admin RBAC, rate limits, privacy enforcement, and security tests.
4. Complete core social/messaging: block/mute, message receipts, typing indicators,
   group chats, pagination, moderation and push notifications.
5. Replace mock AI and video analysis with real, provider-abstracted AI workflows;
   persist user-approved results in the backend.
6. Finish productivity integration, recommendations, translation, account protection,
   support/admin workflows, and privacy controls.
7. Redesign and polish all screens; accessibility, localization, performance, and
   low-bandwidth behavior.
8. Full QA: unit, integration, API security, migration/backup restore, Android device
   testing, offline/reconnect, and regression tests.
9. Only after the user-approved scope and release checklist are complete, prepare a
   signed release APK/AAB and install/test it on the user's device.

## Current branch work

- Provider-neutral mobile API URL configuration via `EXPO_PUBLIC_API_URL`.
- Removed Replit-specific Expo Router origin and mobile Replit build scripts.
- API CORS and email-link configuration no longer depend on Replit environment variables.
  Admin authorization uses the authenticated developer role. Rotate any previously
  exposed credentials separately.
- Added GitHub Actions checks and a manual-only Android release workflow.
- Expo SDK 54 module declarations corrected to SDK 54-compatible ranges:
  `expo-contacts ~15.0.8`, `expo-crypto ~15.0.7`,
  `expo-local-authentication ~17.0.7`, `expo-notifications ~0.32.11`,
  `expo-secure-store ~15.0.7`.
- pnpm lockfile regeneration and CI validation are pending final confirmation.

## Release acceptance checklist

- [ ] All agreed features are implemented and documented.
- [ ] No mock AI/video path remains in production flows.
- [ ] No secrets committed; exposed credentials rotated.
- [ ] Email verification and password reset tested end-to-end.
- [ ] Session and admin security review passed.
- [ ] Database migration, backup, and restore verified.
- [ ] API, mobile, realtime, and media integration tests pass.
- [ ] Arabic RTL, accessibility, themes, and low-bandwidth QA passed.
- [ ] Android build succeeds and signed artifact is reproducible.
- [ ] User explicitly approves the release/install stage.
