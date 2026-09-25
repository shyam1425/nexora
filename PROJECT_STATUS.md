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
- Publication re-audit of the pushed repository: `git log --all --name-only` lists `.env.example` as the only environment-like path ever committed, and no `.env`, `.env.local`, `.vercel/`, `devdb/`, `storage/`, `*.pem`, `*.key`, or `*.log` file exists in the tree or the history. `.env*`, `.vercel/`, `devdb/`, `storage/`, `*.pem`, and `node_modules/` are ignored while `.env.example` stays committable (an empty `.env.probe-backup` was created and confirmed absent from `git status`).
- Ignore-rule safety fix: the `vercel link` step appended duplicate `.vercel` / `.env*` lines to `.gitignore`; that trailing `.env*` pattern wins over the earlier `!.env.example` negation and would have silently ignored the environment template, so the working copy was reverted to the committed rules.

## Verification status

| Gate | Status |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 17 files, 69 tests at last run |
| `npm run build` | PASS — standalone production build completed |
| `npm run smoke` | PASS — 7/7 checks against an isolated standalone server and live MySQL |
| Local verification prerequisites | `npm test`, `npm run smoke`, and `npm start` need the dedicated development MySQL running (`powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 -Action start`, loopback port 3307) **and** a clean shell environment: `dotenv` never overrides an existing process variable, so a stale `DATABASE_URL` exported in the shell silently redirects the suite to another database (observed: `db:status` reporting `probe_db` at `127.0.0.1:3306` and Prisma `pool timeout` on every integration test until the variable was removed) |
| Clean `npm ci` | PASS — temporary clean install reproduced the declared dependency tree |
| `npm audit` | PASS — 0 vulnerabilities (full dependency tree) |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities (production dependency tree) |
| Production deployment | PARTIAL — live on Vercel as project `nexora` (`shyam-9374/nexora`, deployment `dpl_5dBtnpU5GHrciiiA3qXPsnHfjgFw`, target `production`, status Ready) at `https://nexora-three-woad.vercel.app`, built by Vercel's remote Linux builder (`Build Completed in /vercel/output`, 1m 7s). **Not a functional production release**: no production environment variables are configured, so `/api/v1/health` returns 503 (no reachable database) and a same-origin login POST returns 403 `CSRF_ORIGIN_MISMATCH` (`APP_URL` unset) |
| Local Git baseline | PASS — `main` at `577f6d8`, 215 tracked files, clean working tree, no secrets in the index |
| GitHub push | PASS — `main` is published at https://github.com/shyam1425/nexora (public) and local `HEAD` == `origin/main` == `edc6c66` with 215 tracked files; the credential on this machine authenticates as `shyam1425` (`repo` scope) and matches the commit identity |
| Vercel access | PASS — CLI 60.0.1 authenticated as `shyam1425` on team `shyam-9374` (Hobby); project `nexora` linked via `.vercel/project.json` (gitignored) with framework preset Next.js, root directory `./`, Node.js 24.x, region `iad1` |
| Vercel remote build | PASS — Vercel's remote Linux builder ran `next build` for this repository end to end (`Build Completed in /vercel/output`, 1m 7s, every serverless function created). The earlier `vercel deploy --temporary` symlink `EPERM` failure is a Windows-only limitation of that local build path and does not affect Vercel's builders |
| Vercel build requirements | VERIFIED — a build with no `.env` present fails at `prebuild` with `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`; with a well-formed but unreachable `DATABASE_URL` the build succeeds (exit 0), so the production build needs the variable present, not a live database |
| Live S3/MinIO bucket | NOT VERIFIED — adapter covered by unit and socket-level tests; needs real credentials |
| Client address trust | PASS — forged `X-Forwarded-For`/`X-Real-IP` neither widens rate-limit buckets nor reaches `AuditLog.ipAddress` (verified against the standalone server); trusted-proxy mode verified with `TRUST_PROXY=true` |
| End-to-end browser acceptance | PARTIAL — against the live deployment, headless Edge rendered the landing page and the sign-in page, and an anonymous request to `/candidate` redirected to sign-in; cross-site rejection (403) and anonymous denial (401) verified over HTTPS. The authenticated workflow (register → login → dashboard → create/read/update → logout) cannot run because no reachable production database exists |
| Deployed smoke (Vercel) | 5/7 — `SMOKE_BASE_URL=https://nexora-three-woad.vercel.app npm run smoke`: homepage, security headers, anonymous identity, anonymous denial, and cross-site rejection pass; `health` (503, no reachable database) and same-origin login validation (403 `CSRF_ORIGIN_MISMATCH`) fail for missing production configuration |
| Vercel production environment variables | NOT CONFIGURED — `npx vercel env ls production` → `No Environment Variables found for shyam-9374/nexora`. The live deployment was built with deployment-scoped synthetic probe values, so it must not be presented as a production release |
| GitHub → Vercel continuous deployment | BLOCKED — `npx vercel git connect https://github.com/shyam1425/nexora.git` → `Error: Failed to connect shyam1425/nexora to project. Make sure there aren't any typos and that you have access to the repository if it's private.` The Vercel GitHub App is not installed for the account, so pushes to `main` do not deploy automatically yet |

## In progress / incomplete

- Richer candidate application-history views beyond the current recent-application and interview cards.
- Live verification of the S3-compatible storage adapter against a real bucket (operator credentials required); the adapter itself is implemented and tested.
- Real SMTP/email provider verification and production secrets configuration.
- Automated deployed-browser E2E suite.

## Blocked / external configuration

- GitHub: the account named in the deployment brief, `shyam1425i`, does not exist (GitHub API 404 for the user and for the repository). The repository is therefore published on the authenticated account as `https://github.com/shyam1425/nexora` (public, operator-confirmed), with `main` tracking `origin/main`.
- Vercel GitHub integration: `npx vercel git connect https://github.com/shyam1425/nexora.git` fails with `Error: Failed to connect shyam1425/nexora to project. Make sure there aren't any typos and that you have access to the repository if it's private.` Installing and authorizing the Vercel GitHub App for `shyam1425/nexora` is a browser step for the repository owner; until it is done, pushes to `main` do not trigger deployments and every release has to be uploaded with the CLI.
- A managed MySQL 8 reachable from Vercel is the top blocker for a functional deployment. The local development instance on `127.0.0.1:3307` cannot be reached from serverless functions, so the existing Vercel deployment boots and serves pages but returns 503 from `/api/v1/health` and fails every database-backed route. No fabricated or placeholder `DATABASE_URL` was configured.
- Production environment variables are not configured in the Vercel project (`DATABASE_URL`, `SESSION_SECRET`, `APP_URL`). Without `APP_URL` the same-origin CSRF check rejects the deployment's own origin (403 `CSRF_ORIGIN_MISMATCH`), so a correct `APP_URL` is mandatory even for read/write API traffic.
- Production domain, SMTP credentials, and private object-storage credentials are not available in this workspace.
- Payroll processing, tax automation, biometric attendance, WhatsApp/SMS, AI matching, and billing are intentionally post-MVP or pending explicit scope approval.

## Next highest-priority tasks

1. Provision a managed MySQL 8 database with a least-privilege user, run `npm run db:deploy` once against it, and set `DATABASE_URL`, `SESSION_SECRET` (≥ 32 random bytes), and `APP_URL=https://<production-origin>` in the Vercel project for Production; then run `npx vercel --prod`, re-run `SMOKE_BASE_URL=https://<production-origin> npm run smoke` (expect 7/7) and complete the post-deploy acceptance checklist in [DEPLOYMENT.md](./DEPLOYMENT.md).
2. Install and authorize the Vercel GitHub App for `shyam1425/nexora` and connect the project (`npx vercel git connect`) so pushes to `main` deploy automatically.
3. Configure `STORAGE_DRIVER=s3` (uploads, since Vercel's filesystem is read-only apart from `/tmp`) and `EMAIL_DRIVER=smtp` (email) on the deployed environment, then verify document upload/download authorization and real email delivery.
4. Add deployed HTTPS end-to-end browser acceptance automation once a reachable production database and domain exist.

See [ARCHITECTURE.md](./ARCHITECTURE.md), [API.md](./API.md), [SECURITY.md](./SECURITY.md), and [DEPLOYMENT.md](./DEPLOYMENT.md) for the current implementation contract.
