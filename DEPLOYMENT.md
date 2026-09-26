# Deployment

## Required production environment

Set these through the hosting platform's secret manager:

- `NODE_ENV=production`
- `APP_URL=https://<production-domain>`
- `DATABASE_URL=mysql://<least-privilege-user>:<password>@<host>:3306/<database>`
- `SESSION_SECRET` (at least 32 random bytes)
- `SESSION_TTL_HOURS`, rate-limit values, and currency defaults
- `TRUST_PROXY` — `true` when exactly one reverse proxy/load balancer is in front, unset when clients reach the app directly
- `EMAIL_DRIVER=smtp` plus SMTP host/port/credentials, or deliberately use console only for a non-production environment
- `STORAGE_DRIVER=local` with a persistent private volume, or `STORAGE_DRIVER=s3` with the object-storage settings below

Never use `.env` from development in production. The example file is `D:\project\.env.example`.

## Release sequence

```text
install locked dependencies
→ run Prisma migrate deploy
→ build with npm run build
→ start the standalone server
→ check /api/v1/health
→ run smoke checks
→ run deployed-browser acceptance workflow
```

Example container build:

```bash
docker build -t nexora:release .
docker run --rm -p 3000:3000 --env-file .env.production nexora:release
```

The included `Dockerfile` produces a Next standalone runtime. Run migrations as a release/init task using the build image or a controlled CI job; the runtime container does not automatically mutate the database.

## Local production-runtime check

```powershell
cd D:\project
npm run build
npm start
npm run smoke
```

`npm start` copies the generated public/static assets into the standalone output and starts `.next/standalone/server.js`. The health endpoint is:

```text
GET /api/v1/health
```

A healthy response has HTTP 200 and `data.database === "up"`.

## Vercel deployment

Status: **DEPLOYED and VERIFIED in Production on Vercel**. Automatic GitHub → Vercel deployment from `main` is working. **Known production issue (2026-09-26):** the Aiven MySQL service backing the deployment no longer exists in DNS, so `/api/v1/health` currently returns 503 and database-backed pages render an explicit "temporarily unavailable" state — see "Known production issue: database service unavailable".

| Item | Actual value |
|---|---|
| Vercel account | `shyam1425`, team/scope `shyam-9374` (Hobby), CLI 60.0.1 |
| Vercel project | `nexora` (`prj_AKKa0YciwOQOBeBeHsmrfsagHdUF`) |
| Project settings | framework preset **Next.js**, root directory `./`, Node.js 24.x, region `iad1` (default install/build commands, not overridden) |
| Active deployment | created automatically from the newest commit on `main` (`source=git`, target `production`); inspect with `npx vercel ls nexora` |
| Public production URL | `https://nexora-three-woad.vercel.app` (verified 200, landing page, careers, candidate dashboard) |
| Automatic deployment evidence | `dpl_EtSkwDYUJPhH36brPNLUeoRcRwkv` — commit `2b1ee83`, `target=production`, `source=git`, **● Ready** in 42.6s, aliased to the production URL; produced by `git push origin main` with no `vercel --prod` |
| Remote Linux build | PASS — `Build Completed in /vercel/output`, all serverless functions created |
| Production environment variables | **Configured & Verified** (`DATABASE_URL` [Secret], `DATABASE_SSL_CA` [Secret], `SESSION_SECRET` [Secret], `APP_URL` [Config]) |
| Production database | **UNAVAILABLE since 2026-09-26** — was Aiven MySQL 8.4.8 over TLS (`nexora-mysql-shyam-1209.k.aivencloud.com:18737`) with the Project CA verified and migration `20260924081941_init` up-to-date as of 2026-09-25. The service hostname now returns NXDOMAIN on the Windows resolver, Google DNS (`dns.google` status 3) and Cloudflare (`one.one.one.one`), while the `aivencloud.com` apex resolves, so the database is gone rather than misconfigured locally. Recreate it in Aiven and update `DATABASE_URL`/`DATABASE_SSL_CA` to restore |
| Deployed smoke | **7/7 checks passed** — `SMOKE_BASE_URL=https://nexora-three-woad.vercel.app npm run smoke` |
| Browser E2E suite | **8/8 checks passed** — headless browser tested against `https://nexora-three-woad.vercel.app` (registration, DB persistence, login, role redirection, RBAC boundary, mobile layout, logout, session revocation) |
| GitHub → Vercel auto-deploy | **CONNECTED** — Vercel GitHub App installed and project `nexora` linked to `shyam1425/nexora` with production branch `main` (read back from the Vercel API: `link.type=github`, `link.repo=nexora`, `link.org=shyam1425`, `link.productionBranch=main`). Pushes to `main` create production deployments automatically; the deployment carrying this commit was produced by that pipeline, with no CLI upload |
| Commit signature requirement | **ENFORCED** — project Git setting `requireVerifiedCommits=true`. Vercel cancels deployments from commits it cannot verify (`readyState=CANCELED`, reason *"the commit signature couldn't be verified"*). Releases must therefore be pushed as signed commits: an ed25519 key is registered on GitHub as a signing key (fingerprint `SHA256:RfFFoSt0ksLn4i81szvMGHNmvr04/we1PYga/NrCwQs`) and `commit.gpgsign=true` is set in this clone |

Verified against the deployed origin over real HTTPS on 2026-09-25, before the database service disappeared from DNS (health and careers results below reflect that healthy state; see "Known production issue: database service unavailable" for the current status):

- `GET /` → 200 with real server-rendered output (`<title>NEXORA | Workforce. Recruitment. HR solutions.</title>`).
- Security headers present: `Content-Security-Policy` set, `X-Frame-Options: DENY`.
- `GET /api/v1/health` → **200 OK** (`{"status":"ok","database":"up"}`).
- `GET /careers` → **200 OK** with live database query.
- `GET /api/v1/auth/me` → 200 `authenticated: false`; `GET /api/v1/documents/<id>` → 401.
- A protected route (`/candidate`) redirects an anonymous browser session to `/login?next=/candidate`.
- `POST /api/v1/auth/login` with cross-site `Origin` → 403 `CSRF_ORIGIN_MISMATCH`.
- Live Candidate registration creates user and profile records in Aiven MySQL.
- Authenticated login issues valid session cookie and navigates to candidate portal (`Welcome, Jane`).
- Role-based authorization boundaries prevent candidate from accessing `/recruiter` and `/admin` (redirects back to `/candidate`).
- Sign-out invalidates session and redirects to homepage.
- Mobile viewport (375x667) verifies clean layout without horizontal overflow.

### Known production issue: database service unavailable

Detected 2026-09-26. The Aiven MySQL service behind the production deployment
(`nexora-mysql-shyam-1209.k.aivencloud.com`) no longer resolves: `NXDOMAIN` from
the Windows resolver, from Google DNS (`dns.google` → status 3) and from
Cloudflare (`one.one.one.one`), while the `aivencloud.com` apex resolves
normally and `api.aiven.io` answers. The Aiven status page reported *"minor —
Partial System Degradation"* at detection time. A local `SELECT 1` against the
development database still succeeds, so the failure is specific to that service.

Impact and behaviour:

| Surface | Before hardening | Now |
|---|---|---|
| `GET /api/v1/health` | 503 `SERVICE_UNAVAILABLE` | 503 (intended monitoring signal, unchanged) |
| `GET /careers`, `/careers/*` | 500 with Next.js's default error screen | 200 with an explicit "temporarily unavailable" alert |
| Any other unhandled server error | Next.js default error screen | branded `src/app/error.tsx` boundary with *Try again* |
| Unknown route / unknown job slug | Next.js default 404 | branded `src/app/not-found.tsx` |

Recovery steps (operator):

1. Sign in to Aiven and restore or recreate the MySQL service (a free-plan
   service that has been removed must be created again).
2. Copy the new connection URI and CA certificate.
3. Update the Vercel Production environment variables `DATABASE_URL` and
   `DATABASE_SSL_CA` (`npx vercel env rm`/`env add`, or the dashboard).
4. Run `npm run db:deploy` against the new database, then `npm run db:status`.
5. Confirm `GET /api/v1/health` returns 200 with `data.database === "up"`, then
   re-run `SMOKE_BASE_URL=https://nexora-three-woad.vercel.app npm run smoke`
   (expect 7/7) and the browser acceptance checks.

Verified deployed behaviour (2026-09-26, deployment
`dpl_BMcFRoo2MPJBD3yNBf8a97Ktvv57`, commit `f90209f`, `source=git`, alias
`nexora-three-woad.vercel.app`): `/careers`, `/careers?q=engineer` and
`/careers/does-not-exist` answer **200 with the unavailable alert** (all three
returned 500 before this change), `/api/v1/health` returns 503, `/`, `/login` and
`/register/candidate` return 200, `/candidate` returns 307, and a headless
browser pass succeeded on all four public routes with NEXORA branding, no legacy
branding, and no console or network errors. `npm run smoke` reports **6/7** — the
single failure is the `health endpoint` check (HTTP 503), which is the correct
signal while the database service is gone; the other six checks pass.

1. Provision a managed MySQL 8 database with a least-privilege user, run
   `npm run db:deploy` once against it, and set `DATABASE_URL` for Production.
2. Set `SESSION_SECRET` (≥ 32 random bytes) and `APP_URL` (exact production
   origin) for Production, then run `npx vercel --prod`. Keep `TRUST_PROXY`
   unset — Vercel terminates TLS at its edge but does not append a validated
   client-address hop; see "Client address and proxies".
3. Push to `main` to release: the connected GitHub integration builds the commit
   and promotes it to production automatically (Vercel GitHub App installed,
   project linked to `shyam1425/nexora`, production branch `main`). Reserve
   `npx vercel --prod` for an out-of-band release when no commit is available.
4. Re-run the post-deploy acceptance checklist below, including
   `SMOKE_BASE_URL=https://<domain> npm run smoke` (expect 7/7).

Required environment variables in the Vercel project:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `mysql://<least-privilege-user>:<password>@<managed-host>:3306/<database>?ssl=true&connectionLimit=5&connectTimeout=8000&socketTimeout=30000` — see "Managed MySQL compatibility" for why these parameters matter |
| `DATABASE_SSL_CA` | optional — CA certificate (PEM, PEM with escaped `\n`, or base64) for a provider that signs with its own certificate authority; leave unset when the connection URL already uses `?ssl=true` |
| `SESSION_SECRET` | at least 32 random bytes |
| `APP_URL` | the exact `https://` deployment origin (used for cookie `Secure` and CSRF origin checks) |
| `SESSION_TTL_HOURS`, `AUTH_RATE_LIMIT_*`, `DEFAULT_CURRENCY`, `PAYROLL_WORKING_DAYS` | optional; schema defaults apply |
| `STORAGE_DRIVER=s3` (+ `S3_*`) | required for working document upload — see below |
| `EMAIL_DRIVER=smtp` (+ `SMTP_*`) | required for real email delivery |
| `TRUST_PROXY` | leave unset — see "Client address and proxies" |

Managed MySQL compatibility (verified against the installed driver):

- The database client is `@prisma/adapter-mariadb` ^7.10.0 over `mariadb` 3.4.7,
  not Prisma's native MySQL engine. The adapter rewrites the `mysql://` URL to
  `mariadb://` and passes it to `mariadb.createPool()` **as a string**, so the
  driver's own URL parser decides which parameters take effect.
- Verified behaviour of that parser:
  - `?ssl=true` — honoured (the driver special-cases the string `"true"` into a
    boolean and then verifies certificates, because `rejectUnauthorized` only
    defaults to `false` when explicitly disabled).
  - `?connectionLimit=`, `?connectTimeout=`, `?socketTimeout=` — honoured.
  - `?sslaccept=strict` (mysql2/Knex convention) and `?ssl-mode=REQUIRED`
    (MySQL connector convention) — **silently ignored**. A provider-generated URL
    that uses either spelling connects **without TLS**, so rewrite it to
    `?ssl=true` before setting `DATABASE_URL`.
  - `?allowPublicKeyRetrieval=true` is available for `caching_sha2_password`
    users when connecting without TLS.
- Authentication plugin: the user must use `caching_sha2_password` (MySQL 8
  default, works — the project's local MySQL 8.0.45 instance uses it) or
  `mysql_native_password`. `sha256_password` is unsupported and fails with
  `Unknown authentication plugin 'sha256_password'`.
- Certificate trust: `ssl=true` verifies the server certificate against the
  public CA set, so a provider with a publicly-trusted certificate needs no
  further configuration.
- A provider that signs with its **own** certificate authority cannot be trusted
  through the URL, because the driver only accepts a CA bundle as part of an
  options object. This case is supported: set `DATABASE_SSL_CA` (PEM, PEM with
  escaped `\n`, or the base64 encoding of either) and the adapter is constructed
  from unpacked URL options plus `ssl: { ca }`, with certificate verification
  still enabled. Verified end to end against the local MySQL: with the CA
  configured the pool fails (TLS is requested and the non-TLS server cannot
  complete the handshake), without it the same configuration connects and
  answers `SELECT 1`.
- Migrations use a different TLS vocabulary from the runtime driver. Prisma's
  own engine (used by `prisma migrate deploy`) documents the MySQL arguments
  `sslcert` (path to the server certificate) and `sslaccept` (certificate
  validation mode), while the `mariadb` driver ignores both. The two sets can
  coexist in one URL, because each side ignores the parameters it does not know:
  `mysql://user:pass@host:3306/db?ssl=true&sslcert=./certs/provider-ca.pem&sslaccept=strict&connectionLimit=5`.
  The `sslcert` path is only needed for the release job that runs migrations from
  a machine with the file on disk; Vercel never runs migrations at build time.
- Network: Vercel functions have no fixed egress address, so the database must
  accept connections from anywhere (or sit behind the provider's connection
  pooler). Because each serverless instance opens its own pool, a pooled endpoint
  and a modest `connectionLimit` are recommended.

Verified build behaviour:

- `DATABASE_URL` is consumed at build time by `prisma generate` (`prebuild`), so
  a build without it fails with
  `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`
  (reproduced locally by building with no `.env` file present, which is the
  state of a fresh CI checkout because `.env` is ignored).
- The build performs no live database queries: a well-formed but unreachable
  `DATABASE_URL` still builds successfully. The database therefore has to exist
  for **runtime**, not for the build.
- `SESSION_SECRET` and `APP_URL` are validated by `src/lib/env.ts` on first
  import; the application refuses to start without them.

Vercel specifics:

- The filesystem is read-only apart from `/tmp`, so `STORAGE_DRIVER=local`
  cannot persist documents. Configure S3-compatible object storage, or accept
  that document upload is non-functional while it stays on `local`.
- Vercel's Next.js builder runs its own runtime. `output: "standalone"` in
  `next.config.ts`, the `Dockerfile`, and `scripts/start.mjs` (used by
  `npm start`) exist for self-hosted/Docker releases and are not used by Vercel.
- Migrations are never run by the build. Run `npm run db:deploy` against the
  production database from a controlled job before or during release.
- After the first successful deployment, run the post-deploy acceptance
  checklist below against the real `https://` origin, including
  `SMOKE_BASE_URL=https://<domain> npm run smoke`.

Local build path (`vercel deploy --temporary`) and local installs:

- The unauthenticated `--temporary` deployment builds **locally** and uploads the
  result, so it does not exercise Vercel's remote build image. That local build
  writes symlinks into `.vercel/output/functions`, which on Windows requires
  Developer Mode or elevation; without it the run ends with
  `Error: EPERM: operation not permitted, symlink '...\admin.func' -> ...`.
  Vercel's remote Linux builders are not affected by this.
- Everything up to that step passes under the CLI pipeline: dependencies
  install, Next.js is detected, `npm run build` completes, and all serverless
  functions are created — provided `DATABASE_URL` is present in the build
  environment (see the build behaviour above).
- Keep the dependency-script allowlist in `package.json` (`allowScripts`) or a
  project `.npmrc`. A **user-level** `~/.npmrc` entry such as
  `allow-scripts=opencode-ai` is ignored by a normal project install (npm warns
  that the `package.json` field wins) but makes the CLI's install step fail with
  `npm error code EALLOWSCRIPTS: --allow-scripts is not allowed in
  project-scoped installs`, because the CLI passes npm configuration through the
  environment. Remove that user-level entry or scope it to the tool that needs
  it; it has no effect on Vercel's remote builders.

The remote Linux builder is therefore verified working (see the deployment
record above). A **functional** production release still requires the production
environment variables listed below; `vercel deploy --temporary` remains only a
local pipeline probe.

## Production database (Aiven MySQL)

The production database is a managed Aiven for MySQL 8 service. The table records
what is verified; the paragraphs below state precisely what is not.

| Item | Value |
|---|---|
| Host / port | `nexora-mysql-shyam-1209.k.aivencloud.com:18737` (public DNS resolves to `159.89.160.201`) |
| Database / user | `defaultdb` / `avnadmin` |
| TLS | enforced by the service; `DATABASE_URL` must carry `?ssl=true` |
| CA certificate | `certs/aiven-ca.pem` — Aiven Project CA, `CN=7a4b7ba9-5338-4a61-b16d-a2dc958ce8cb Project CA`, self-signed, `CA:TRUE`, valid 2026-09-25 → 2036-09-22, SHA-256 `2F:75:DB:66:43:2E:73:86:27:39:03:7B:95:D3:1B:66:09:48:94:A1:50:50:B8:BC:C4:1F:37:9B:DA:0B:6C:A3` |
| Secret handling | `/certs/` and `.env*` (therefore `.env.production.local`) are gitignored; no credential is committed, echoed, or logged |
| Real-credential connection | **VERIFIED** — authenticated TLS connection, MySQL 8.4.8, `require_secure_transport: ON`, `prisma migrate deploy` PASS, live queries PASS |

Verified at the transport and application level:

- DNS resolves the host to `159.89.160.201` and TCP connection to port 18737 succeeds.
- Negotiated TLS cipher: `TLS_AES_256_GCM_SHA384` over custom Aiven Project CA (`certs/aiven-ca.pem`).
- Authenticated queries executed successfully against MySQL 8.4.8.
- `prisma migrate deploy` successfully applied migration `20260924081941_init`; `prisma migrate status` confirms schema is up to date.
- Vercel production serverless runtime connects to Aiven MySQL using `DATABASE_URL` and base64-encoded `DATABASE_SSL_CA`, verified by deployed `/api/v1/health` (HTTP 200 `database: "up"`), `/careers` query, and live end-to-end browser candidate registration / session persistence.

Diagnostic note: a failed **pool** connection is reported as the generic
`ER_GET_CONNECTION_TIMEOUT (45028) pool timeout: failed to retrieve a connection
from pool…`, which hides the underlying cause and looks like a network timeout.
Use `mariadb.createConnection(...)` rather than the pool when diagnosing
database connectivity, as was done to produce the evidence above.

Steps to complete production database setup:

1. Compose `DATABASE_URL` as
   `mysql://avnadmin:<password>@nexora-mysql-shyam-1209.k.aivencloud.com:18737/defaultdb?ssl=true&connectionLimit=5&connectTimeout=8000&socketTimeout=30000`
   and set `DATABASE_SSL_CA` to `certs/aiven-ca.pem` (PEM or base64) for local runs
   that target the production database.
2. Apply the schema with `npm run db:deploy`, which runs `prisma migrate deploy`
   only. Never use `migrate dev`, `db push`, or `migrate reset` against this
   service, so no existing object is dropped (see "Database safety"). Prisma's own
   engine expects its TLS wording (`sslcert=<path>&sslaccept=strict`) rather than
   the driver's `ssl=true`; both can coexist in one URL because each side ignores
   the parameters it does not recognise.
3. Register `DATABASE_URL` and `DATABASE_SSL_CA` for Production in the Vercel
   project and redeploy, then run the post-deploy acceptance checks below.

## Object storage

Private candidate/employee documents must never be publicly readable. Choose one driver:

| Driver | Use when | Settings |
|---|---|---|
| `local` | Development, or a single instance with a persistent private volume | `STORAGE_LOCAL_DIR` (outside the web root) |
| `s3` | Any horizontally scaled or multi-instance deployment | `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |

S3-specific notes:

- `S3_ENDPOINT` — leave empty for AWS S3; set it for MinIO, Cloudflare R2, Wasabi, Backblaze B2, and similar gateways. It must be an absolute `http(s)` URL, and it must be `https` when `NODE_ENV=production`. Cloudflare R2 also requires `S3_REGION=auto`.
- `S3_FORCE_PATH_STYLE` — unset (or empty) selects automatically: path-style when `S3_ENDPOINT` is set, virtual-hosted otherwise. Set it explicitly to `false` for virtual-hosted R2 or `true` for MinIO behind a path-style proxy.
- `S3_SESSION_TOKEN` — only for temporary STS credentials. The token is signed with the request and never logged.
- Missing or invalid settings fail fast at startup; the application never silently falls back to local storage.

Bucket configuration is the operator's responsibility and is required for production:

- Keep the bucket **private** (no public read, no public list), enable default encryption, and enable versioning or lifecycle rules for retention.
- Grant the runtime user only `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` (and `s3:ListBucket` only if a tool requires it) on the document prefix.
- Downloads always go through the authorised API route; do not add a public CDN/origin rule for the bucket.
- If you cannot give the runtime credentials, keep `STORAGE_DRIVER=local` with a persistent volume — do not switch to `s3` speculatively.

Verify the switch on a staging bucket before launch: upload a resume, download it as its owner, confirm another user receives HTTP 403, and confirm the object appears in the bucket with no public ACL.

## HTTPS and cookies

Set `APP_URL` to the exact HTTPS origin before building/deploying. Session cookies are Secure when the configured app URL is HTTPS. Configure the reverse proxy/load balancer to pass the original host and protocol, enforce HTTPS, and do not cache authenticated HTML/API responses.

## Client address and proxies

`x-forwarded-for` and `x-real-ip` are ordinary request headers, so a client can
send them. The application therefore only reads them when `TRUST_PROXY=true`
states that a reverse proxy is in front, and it then uses the **right-most**
validated hop — the address your proxy appended — never the left-most entry,
which a client can forge.

Expected proxy contract (nginx-style):

```nginx
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
# Append is fine for a single proxy; to also tolerate CDN→LB chains use
# `proxy_set_header X-Forwarded-For $remote_addr;` so the header is overwritten.
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

- `TRUST_PROXY=true` — exactly one trusted proxy in front. Per-IP rate-limit
  buckets and recorded audit addresses use the forwarded client address.
- `TRUST_PROXY` unset/false — the app is reached directly. Forwarding headers are
  ignored, the caller is recorded as `unknown`, and the per-IP buckets collapse
  into one stricter global bucket. Set `TRUST_PROXY=true` behind a proxy so that
  one abusive client cannot consume the shared bucket.
- When several proxies are chained (CDN → load balancer), configure the outermost
  hop to overwrite the header rather than append, so the right-most entry stays
  the true client address.
- Verify after deploy: hit a login endpoint with `X-Forwarded-For: 203.0.113.7`
  from a client that is not behind the proxy and confirm the audit row records
  the real address (or `unknown`), never `203.0.113.7`.


## Database safety

- Use a dedicated database and user for the application.
- Take a backup before migrations.
- Never run `prisma migrate reset` against staging or production.
- Do not run demo seed data in production. `SEED_DEMO_DATA` is ignored in production unless an explicit override is set.
- Run `npm run db:deploy` once per release, before starting new application instances.

## Post-deploy acceptance

1. Open the public homepage and careers page.
2. Verify `/api/v1/health`.
3. Register a candidate and client in a controlled staging environment.
4. Complete the connected requirement → job → application → interview → offer → joining workflow.
5. Confirm private document access is denied across users and allowed only for authorized roles.
6. Confirm audit records, notifications, sessions, and persistence after refresh/logout/login.
7. Run `SMOKE_BASE_URL=https://<domain> npm run smoke` from a trusted runner.
8. Confirm the client-address contract: a forged `X-Forwarded-For` must not appear in the audit log (see "Client address and proxies").

- `npm ci` — reproducible locked install
- `npm run validate` — lint, typecheck, tests, and production build
- `npm run db:status` — verify migrations before release
- `npm run smoke` — HTTP dependency/security smoke checks
- `SMOKE_BASE_URL=https://<domain> npm run smoke` — deployed smoke checks

Production deployment is **not verified** until this checklist passes against the real HTTPS domain and configured external services.
