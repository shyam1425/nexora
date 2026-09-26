# NEXORA — Project Status

**Last updated:** 2026-09-26
**Current phase:** Production MVP — core recruitment workflow implementation
**Overall status:** Production MVP live at `https://nexora-three-woad.vercel.app` with automatic GitHub→Vercel deployment from `main`; remaining gaps are operator-credential features (SMTP delivery, live S3-compatible bucket) and, since 2026-09-26, an unavailable production database: the Aiven MySQL service hostname no longer resolves, so `/api/v1/health` reports 503 and database-backed pages render an explicit "temporarily unavailable" state instead of an unexplained 500

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
- Managed-MySQL TLS beyond `?ssl=true`: a provider that signs with its own certificate authority (for example a default Aiven service) is supported through an optional `DATABASE_SSL_CA` (PEM text, PEM with escaped `\n`, or the base64 encoding of either). The connection URL is then unpacked into driver options with `ssl: { ca }`, so certificate verification stays enabled, while a plain `?ssl=true` URL is still passed to the adapter untouched. Covered by 9 unit tests plus an end-to-end check proving the CA reaches the driver: with it the pool requests TLS and fails against a non-TLS server, without it the same configuration connects and answers `SELECT 1`.
- Security response headers and a real standalone production-runtime smoke check against the persistent MySQL database.
- Repository baseline: the tree is now under version control on `main` (initial commit `577f6d8`, now 217 tracked files). The staged index was audited before committing: no `.env`/`.env.local`/`.env.production`, no `node_modules`, `.next`, `storage/`, or `devdb/` content, no private keys, and no cloud/SMTP/database credentials. The only committed literal is the bootstrap password of the loopback-only development database in `scripts/dev-db.ps1` (that instance listens on `127.0.0.1:3307` only, is started by that script, and is unrelated to any production credential).
- Publication re-audit of the pushed repository: `git log --all --name-only` lists `.env.example` as the only environment-like path ever committed, and no `.env`, `.env.local`, `.vercel/`, `devdb/`, `storage/`, `*.pem`, `*.key`, or `*.log` file exists in the tree or the history. `.env*`, `.vercel/`, `devdb/`, `storage/`, `*.pem`, and `node_modules/` are ignored while `.env.example` stays committable (an empty `.env.probe-backup` was created and confirmed absent from `git status`).
- Ignore-rule safety fix: the `vercel link` step appended duplicate `.vercel` / `.env*` lines to `.gitignore`; that trailing `.env*` pattern wins over the earlier `!.env.example` negation and would have silently ignored the environment template, so the working copy was reverted to the committed rules.
- Certificate and credential exclusion: `/certs/` is ignored explicitly (in addition to the existing `*.pem`), and all `.env*` files including `.env.production.local` are ignored. Verified with `git check-ignore` for `certs/aiven-ca.pem`, `certs/anything.key`, a nested path under `certs/`, `.env.production.local`, `.env`, and `.env.local`, while `.env.example` remains committable.

## Verification status

| Gate | Status |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 18 files, 78 tests at last run |
| `npm run build` | PASS — standalone production build completed |
| `npm run smoke` | PASS — 7/7 checks against an isolated standalone server and live MySQL |
| Local verification prerequisites | `npm test`, `npm run smoke`, and `npm start` need the dedicated development MySQL running (`powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 -Action start`, loopback port 3307) **and** a clean shell environment: `dotenv` never overrides an existing process variable, so a stale `DATABASE_URL` exported in the shell silently redirects the suite to another database (observed: `db:status` reporting `probe_db` at `127.0.0.1:3306` and Prisma `pool timeout` on every integration test until the variable was removed). `tests/setup.ts` now probes the `DATABASE_URL` host/port before the suites run and prints the exact `dev-db.ps1 -Action start` command when it is unreachable |
| Clean `npm ci` | PASS — temporary clean install reproduced the declared dependency tree |
| `npm audit` | PASS — 0 vulnerabilities (full dependency tree) |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities (production dependency tree) |
| Production deployment | PASS — live on Vercel as project `nexora` (`shyam-9374/nexora`) at `https://nexora-three-woad.vercel.app`. Releases are created automatically from pushes to `main` (`source=git`, verified commits only); the deployment carrying the newest `main` commit is the active production deployment. Fully connected to live Aiven MySQL with TLS and custom CA; `/api/v1/health` returns HTTP 200 `database: "up"` and the deployed smoke suite passes 7/7 |
| Local Git baseline | PASS — `main` advanced to the current tip, 217 tracked files, clean working tree, no secrets in the index or anywhere in the history |
| GitHub push | PASS — `main` is published at https://github.com/shyam1425/nexora (public), local `HEAD` == `origin/main`, 217 tracked files; the credential on this machine authenticates as `shyam1425` (`repo` scope) and matches the commit identity |
| Vercel access | PASS — CLI 60.0.1 authenticated as `shyam1425` on team `shyam-9374` (Hobby); project `nexora` linked via `.vercel/project.json` (gitignored) with framework preset Next.js, root directory `./`, Node.js 24.x, region `iad1` |
| Vercel remote build | PASS — Vercel's remote Linux builder ran `next build` for this repository end to end (`Build Completed in /vercel/output`, 40s, every serverless function created) |
| Vercel build requirements | VERIFIED — `DATABASE_URL`, `DATABASE_SSL_CA`, `SESSION_SECRET`, and `APP_URL` configured as Production environment variables |
| Production database (Aiven MySQL) | PASS — Aiven for MySQL 8.4.8 service is provisioned, authenticated, TLS verified, and migrated (`nexora-mysql-shyam-1209.k.aivencloud.com:18737`, database `defaultdb`, user `avnadmin`, CA at `certs/aiven-ca.pem`). Applied migration `20260924081941_init`, schema is up-to-date, verified by live query and transactional read/write from production serverless functions |
| Production database outage (2026-09-26) | **BLOCKED (external)** — the Aiven service hostname `nexora-mysql-shyam-1209.k.aivencloud.com` returns NXDOMAIN from the Windows resolver, from Google DNS (`dns.google` → status 3) and from Cloudflare (`one.one.one.one`), while the `aivencloud.com` apex resolves normally: the service is gone, not a local DNS fault. Observed production impact before hardening: `/api/v1/health` → 503 `SERVICE_UNAVAILABLE` and `/careers` + `/careers/*` → 500. Restoring service needs Aiven account access (recreate the service, then update Vercel `DATABASE_URL`/`DATABASE_SSL_CA`); no application change can restore connectivity. |
| Public-page dependency-outage handling | FIXED (2026-09-26), locally verified — public database-backed routes no longer surface an unexplained 500 when the database is unreachable: `/careers` and `/careers/[slug]` render an explicit "temporarily unavailable" alert through `queryOrUnavailable` (`src/lib/query-fallback.ts`), the failure is logged as structured JSON (`careers_listing_unavailable`, `job_detail_unavailable`), and `/api/v1/health` still returns 503 so monitoring keeps working. A branded `src/app/error.tsx` boundary and `src/app/not-found.tsx` page replace Next.js's default error/404 screens. Verified on the built standalone app with a clean environment: unreachable database → `/careers` 200 with the unavailable alert, `/careers/does-not-exist` 200 with the alert, `/api/v1/health` 503, 0 credential leaks in the logs; healthy database → `/careers` 200 with the normal listing, 0 error lines, and `/careers/<unknown-slug>` still 404 with the branded page (the fallback does not mask real 404s). |
| Live S3/MinIO bucket | NOT VERIFIED — adapter covered by unit and socket-level tests; needs real credentials |
| Client address trust | PASS — forged `X-Forwarded-For`/`X-Real-IP` neither widens rate-limit buckets nor reaches `AuditLog.ipAddress` (verified against the standalone server); trusted-proxy mode verified with `TRUST_PROXY=true` |
| End-to-end browser acceptance | PASS — 8/8 checks automated with headless browser against `https://nexora-three-woad.vercel.app`: anonymous redirect, candidate registration, DB persistence in Aiven MySQL, active login, role dashboard, RBAC boundary enforcement, mobile responsiveness (375x667), and logout session revocation |
| Deployed smoke (Vercel) | PASS — 7/7: `SMOKE_BASE_URL=https://nexora-three-woad.vercel.app npm run smoke` passes homepage, security headers, anonymous identity, health (200), anonymous denial, login validation, and cross-site rejection |
| Vercel production environment variables | CONFIGURED — `DATABASE_URL` (Secret), `DATABASE_SSL_CA` (Secret), `SESSION_SECRET` (Secret), `APP_URL` (Config) registered for Production environment |
| GitHub → Vercel continuous deployment | CONNECTED — Vercel GitHub App installed for `shyam1425`; project `nexora` linked to repository `shyam1425/nexora` with production branch `main` (`link.type=github`, `link.repo=nexora`, `link.org=shyam1425`, `link.productionBranch=main`, read back from the Vercel API after authorization). Pushes to `main` produce production deployments automatically, aliased to `https://nexora-three-woad.vercel.app`; the deployment carrying this commit is the first one produced by the GitHub integration, with no `vercel --prod` upload |
| Commit signature policy | ENFORCED — `requireVerifiedCommits=true` on project `nexora`. The first push after connecting (`cbd442a`, unsigned) produced a `source=git` deployment (`dpl_61mSj257Y3bwsBGPzfsc3tXFHEgz`, commit `cbd442a`) that Vercel canceled with *"the deployment was canceled because the commit signature couldn't be verified"*. A dedicated ed25519 signing key (`SHA256:RfFFoSt0ksLn4i81szvMGHNmvr04/we1PYga/NrCwQs`) is now registered on GitHub as a signing key and `commit.gpgsign=true` is configured for this clone, so releases are pushed as signed commits |

## In progress / incomplete

- Richer candidate application-history views beyond the current recent-application and interview cards.
- Live verification of the S3-compatible storage adapter against a real bucket (operator credentials required); the adapter itself is implemented and tested.
- Real SMTP/email provider verification and production secrets configuration.
- Automated deployed-browser E2E suite.

## Blocked / external configuration

- GitHub: the account named in the deployment brief, `shyam1425i`, does not exist (GitHub API 404 for the user and for the repository). The repository is therefore published on the authenticated account as `https://github.com/shyam1425/nexora` (public, operator-confirmed), with `main` tracking `origin/main`.
- **Production database (2026-09-26):** the Aiven MySQL service behind production no longer exists in DNS (NXDOMAIN on three independent resolvers). Operator action required: sign in to Aiven, restore or recreate the MySQL service, then update the Vercel Production variables `DATABASE_URL` and `DATABASE_SSL_CA` from the new connection details, run `npm run db:deploy` against it, and re-run the smoke and browser checks.
- Production custom domain, SMTP credentials, and private object-storage credentials are not configured in this workspace.
- Payroll processing, tax automation, biometric attendance, WhatsApp/SMS, AI matching, and billing are intentionally post-MVP or pending explicit scope approval.

## Next highest-priority tasks

1. **Restore the production database** (Aiven service gone from DNS): recreate the service in the Aiven console, set the new `DATABASE_URL`/`DATABASE_SSL_CA` for the Vercel Production environment, run `npm run db:deploy`, and confirm `/api/v1/health` returns 200 before re-running the deployed smoke suite and browser checks.
2. Configure `STORAGE_DRIVER=s3` (uploads, since Vercel's filesystem is read-only apart from `/tmp`) and `EMAIL_DRIVER=smtp` (email) on the deployed environment, then verify document upload/download authorization and real email delivery.

See [ARCHITECTURE.md](./ARCHITECTURE.md), [API.md](./API.md), [SECURITY.md](./SECURITY.md), and [DEPLOYMENT.md](./DEPLOYMENT.md) for the current implementation contract.
