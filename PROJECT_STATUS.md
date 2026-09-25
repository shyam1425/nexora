# 360 WorkFox Tech — Project Status

**Last updated:** 2026-09-25
**Current phase:** Production MVP — core recruitment workflow implementation
**Overall status:** Partially implemented; not yet production-ready

## Completed and verified

- Next.js App Router application with TypeScript, Tailwind CSS, reusable UI primitives, and strict typechecking.
- MySQL 8 schema with Prisma migrations, unique constraints, status history, audit records, notifications, sessions, and private document metadata.
- Prisma 7 architecture-neutral TypeScript client with the MariaDB driver adapter; Windows ARM64 development is supported without an x64 query engine.
- Authentication: registration, verification tokens, login, HTTP-only sessions, logout, password reset, password change, rate limits, CSRF origin checks, and account lockout.
- RBAC and server-side authorization foundations for candidate, client, recruiter, employee, admin, and super-admin roles.
- Public corporate website, branded application metadata, sign-in, candidate/client registration, verification, recovery, public careers search, job detail, and server-rendered role dashboards.
- Candidate applications with duplicate protection, status history, recruiter screening transitions, audit trail, and notification events.
- Recruiter job drafts, draft publishing, client requirements, candidate submissions, interview scheduling/feedback, offer creation/response, and joining completion to an employee record.
- Private local document storage with MIME/extension/signature/size checks, safe storage keys, access authorization, access logs, and resume replacement handling.
- S3-compatible private object storage adapter (`STORAGE_DRIVER=s3`) implemented with dependency-free SigV4 request signing: AWS S3 and MinIO/R2/Wasabi/Backblaze endpoints, path-style or virtual-hosted addressing, session-token support, path-traversal rejection, and no public ACLs. Verified by unit tests against the published AWS SigV4 reference vectors and by socket-level tests against an S3-compatible HTTP endpoint; live bucket verification still needs operator credentials.
- Notification persistence/API foundations and health endpoint.
- Notification bell UI across candidate, recruiter, client, employee, and admin dashboards, with per-user list, unread count, mark-read, and mark-all-read actions.
- Notification ownership isolation: a user cannot mark another user's notification read, and mark-all-read affects only the authenticated user's rows.
- Server-rendered admin audit-log page with `audit.read` authorization, bounded filters/search, database-side pagination, sanitized metadata display, and navigation from the recent-audit dashboard card.
- Candidate interview details on the candidate dashboard, including round, mode, duration, schedule, interviewer, location, and HTTP(S)-only meeting links.
- Candidate profile editing through a validated candidate-only API, ownership-checked service, completion recalculation, user identity sync, and audit trail.
- Client addresses used for rate limiting and audit records are no longer taken from client-supplied headers: forwarding headers are read only when `TRUST_PROXY` explicitly declares the reverse proxy in front, the right-most validated hop is used, and values must be literal IPv4/IPv6. Verified end-to-end against the standalone server: a rotating forged `X-Forwarded-For` chain no longer mints fresh per-IP rate-limit buckets nor reaches `AuditLog.ipAddress`.
- Unit and MySQL integration tests plus browser-oriented smoke checks.
- Generic application status mutations are now restricted to manual screening/selection/rejection/withdrawal transitions; interview, offer, candidate response, and joining states can only be created by their owning transactions.
- Reproducible npm manifest/lockfile, patched database tooling overrides, standard lint/typecheck/test/build/database/smoke scripts, zero full or production audit findings, and verified standalone production output.
- Security response headers and a real standalone production-runtime smoke check against the persistent MySQL database.

## Verification status

| Gate | Status |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 17 files, 69 tests at last run |
| `npm run build` | PASS — standalone production build completed |
| `npm run smoke` | PASS — 7/7 checks against an isolated standalone server and live MySQL |
| Clean `npm ci` | PASS — temporary clean install reproduced the declared dependency tree |
| `npm audit` | PASS — 0 vulnerabilities (full dependency tree) |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities (production dependency tree) |
| Production deployment | NOT VERIFIED — no staging/production domain provided |
| Live S3/MinIO bucket | NOT VERIFIED — adapter covered by unit and socket-level tests; needs real credentials |
| Client address trust | PASS — forged `X-Forwarded-For`/`X-Real-IP` neither widens rate-limit buckets nor reaches `AuditLog.ipAddress` (verified against the standalone server); trusted-proxy mode verified with `TRUST_PROXY=true` |
| End-to-end browser acceptance | PARTIAL — service/API workflow covered; full HTTPS browser run pending deployment configuration |

## In progress / incomplete

- Richer candidate application-history views beyond the current recent-application and interview cards.
- Live verification of the S3-compatible storage adapter against a real bucket (operator credentials required); the adapter itself is implemented and tested.
- Real SMTP/email provider verification and production secrets configuration.
- Automated deployed-browser E2E suite.

## Blocked / external configuration

- Production domain, HTTPS termination, MySQL credentials, SMTP credentials, and private object-storage credentials are not available in this workspace.
- Payroll processing, tax automation, biometric attendance, WhatsApp/SMS, AI matching, and billing are intentionally post-MVP or pending explicit scope approval.

## Next highest-priority tasks

1. Add deployed HTTPS E2E smoke tests and staging deployment configuration.
2. Verify the implemented S3 adapter against the chosen production bucket (credentials, CORS-free private access, lifecycle/encryption policies).
3. Configure and verify production SMTP, database, HTTPS, and object-storage secrets.

See [ARCHITECTURE.md](./ARCHITECTURE.md), [API.md](./API.md), [SECURITY.md](./SECURITY.md), and [DEPLOYMENT.md](./DEPLOYMENT.md) for the current implementation contract.
