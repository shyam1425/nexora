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
- Repository baseline: the tree is now under version control on `main` (initial commit `577f6d8`, 215 tracked files). The staged index was audited before committing: no `.env`/`.env.local`/`.env.production`, no `node_modules`, `.next`, `storage/`, or `devdb/` content, no private keys, and no cloud/SMTP/database credentials. The only committed literal is the bootstrap password of the loopback-only development database in `scripts/dev-db.ps1` (that instance listens on `127.0.0.1:3307` only, is started by that script, and is unrelated to any production credential).

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
| Local Git baseline | PASS — `main` at `577f6d8`, 215 tracked files, clean working tree, no secrets in the index |
| GitHub push | BLOCKED — the target account `shyam1425i` does not exist (GitHub API and profile return 404); `git push` fails with `remote: Repository not found.` / `fatal: repository 'https://github.com/shyam1425i/nexora.git/' not found`. The only GitHub credential stored on this machine authenticates as `shyam1425` (`repo` scope), which matches the commit identity |
| Vercel CLI / access | BLOCKED — `npx vercel whoami` (CLI 60.0.1) reports `Logged out`; a browser `vercel login` is required before any deployment or remote build can be created |
| Vercel pipeline probe | PARTIAL — with `vercel deploy --temporary` (local build, no login required) the dependency install, Next.js detection, `npm run build`, and serverless-function creation all pass; the run stops at the CLI's local output step with `Error: EPERM: operation not permitted, symlink '.vercel/output/functions/admin.func'`, which is a Windows symlink-privilege limitation of that local path and does not affect Vercel's remote Linux builders |
| Vercel build requirements | VERIFIED — a build with no `.env` present fails at `prebuild` with `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`; with a well-formed but unreachable `DATABASE_URL` the build succeeds (exit 0), so the production build needs the variable present, not a live database |
| Live S3/MinIO bucket | NOT VERIFIED — adapter covered by unit and socket-level tests; needs real credentials |
| Client address trust | PASS — forged `X-Forwarded-For`/`X-Real-IP` neither widens rate-limit buckets nor reaches `AuditLog.ipAddress` (verified against the standalone server); trusted-proxy mode verified with `TRUST_PROXY=true` |
| End-to-end browser acceptance | PARTIAL — service/API workflow covered; full HTTPS browser run pending deployment configuration |

## In progress / incomplete

- Richer candidate application-history views beyond the current recent-application and interview cards.
- Live verification of the S3-compatible storage adapter against a real bucket (operator credentials required); the adapter itself is implemented and tested.
- Real SMTP/email provider verification and production secrets configuration.
- Automated deployed-browser E2E suite.

## Blocked / external configuration

- GitHub: the account named in the deployment brief, `shyam1425i`, does not exist. The repository was therefore published on the authenticated account as `https://github.com/shyam1425/nexora` (public, confirmed by the operator), with `main` tracking `origin/main` at `577f6d8`.
- Local npm configuration: this machine's user-level `~/.npmrc` contains `allow-scripts=opencode-ai`, which npm 11.17 rejects during project-scoped installs with `npm error code EALLOWSCRIPTS` (the `package.json` `allowScripts` field is the supported place for that policy). A normal `npm install` in the project only warns and succeeds, but the Vercel CLI's install step fails until that user-level line is removed or scoped to the tool that needs it.
- Vercel access: the CLI on this machine is logged out (`npx vercel whoami` → `Logged out`). A browser `vercel login` or a deployment token is required.
- A managed MySQL 8 reachable from Vercel is required for a functional deployment. The local development instance on `127.0.0.1:3307` cannot be reached from serverless functions, and a release built against an unreachable database would boot but fail on every database-backed route, so no Vercel release was produced rather than publishing a non-functional one.
- Production domain, HTTPS termination, SMTP credentials, and private object-storage credentials are not available in this workspace.
- Payroll processing, tax automation, biometric attendance, WhatsApp/SMS, AI matching, and billing are intentionally post-MVP or pending explicit scope approval.

## Next highest-priority tasks

1. Run `npx vercel login` (browser flow), connect the GitHub repository to a Vercel project (Next.js preset, root `./`), set `DATABASE_URL`, `SESSION_SECRET`, and `APP_URL` for Production, deploy, and then run the post-deploy acceptance checklist including `SMOKE_BASE_URL=https://<domain> npm run smoke`.
2. Configure `STORAGE_DRIVER=s3` (uploads) and `EMAIL_DRIVER=smtp` (email) on the deployed environment, then verify document upload/download authorization and real email delivery.
3. Add deployed HTTPS end-to-end browser acceptance automation once a real domain exists.

See [ARCHITECTURE.md](./ARCHITECTURE.md), [API.md](./API.md), [SECURITY.md](./SECURITY.md), and [DEPLOYMENT.md](./DEPLOYMENT.md) for the current implementation contract.
