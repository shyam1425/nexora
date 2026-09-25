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
docker build -t workfox-tech:release .
docker run --rm -p 3000:3000 --env-file .env.production workfox-tech:release
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

Status: **deployed and building on Vercel; not a functional production release
yet** (no production database or production environment variables are available).

| Item | Actual value |
|---|---|
| Vercel account | `shyam1425`, team/scope `shyam-9374` (Hobby), CLI 60.0.1 |
| Vercel project | `nexora` (`prj_AKKa0YciwOQOBeBeHsmrfsagHdUF`) |
| Project settings | framework preset **Next.js**, root directory `./`, Node.js 24.x, region `iad1` (default install/build commands, not overridden) |
| Deployment | `dpl_5dBtnpU5GHrciiiA3qXPsnHfjgFw`, target `production`, status **Ready** |
| Public production URL | `https://nexora-three-woad.vercel.app` — the only host that serves the application to anonymous visitors (verified 200 with the server-rendered landing page) |
| Immutable deployment URL | `https://nexora-e95zn2v6q-shyam-9374.vercel.app` — resolves with 200 but anonymous requests get Vercel's own sign-in page (`<title>Login – Vercel</title>`), so it is Vercel Authentication-protected and must not be used as the production URL |
| Other alias from `vercel inspect` | `https://nexora-shyam-9374.vercel.app` — likewise returns Vercel's sign-in page, not the application |
| Remote Linux build | PASS — `Build Completed in /vercel/output`, build duration 1m 7s, all serverless functions created |
| Deployment-scoped configuration | built with synthetic probe environment values passed per deployment (`--env`); **no values are persisted in the project** |
| Production environment variables | **none** — `npx vercel env ls production` → `No Environment Variables found for shyam-9374/nexora` |
| Deployed smoke | **5/7** — `SMOKE_BASE_URL=https://nexora-three-woad.vercel.app npm run smoke` |
| GitHub → Vercel auto-deploy | **BLOCKED** — `npx vercel git connect https://github.com/shyam1425/nexora.git` → `Error: Failed to connect shyam1425/nexora to project. Make sure there aren't any typos and that you have access to the repository if it's private.` The Vercel GitHub App is not installed/authorized for this account yet; installation is a browser step |

Verified against the deployed origin (real HTTPS):

- `GET /` → 200 with real server-rendered output
  (`<title>360 WorkFox Tech | Workforce. Recruitment. HR solutions.</title>`,
  navigation rendered).
- Security headers present: `Content-Security-Policy` set, `X-Frame-Options: DENY`.
- `GET /api/v1/auth/me` → 200 `authenticated: false`; `GET /api/v1/documents/<id>` → 401.
- A protected route (`/candidate`) redirects an anonymous browser session to the
  sign-in page (verified in a real browser, not only via HTTP status).
- `GET /careers` → the Next.js error shell ("This page couldn't load") because the
  page queries the database. Confirmed to be a consequence of the missing
  database, not a code defect: the same route returns 200
  (`Careers | 360 WorkFox Tech`) against a reachable database locally, and the
  local `/` payload is byte-identical to the deployed `/` payload.
- `POST /api/v1/auth/login` with a cross-site `Origin` → 403 `CSRF_ORIGIN_MISMATCH`.

Known gaps on that deployment — all configuration, no code defect:

1. `GET /api/v1/health` → **503** `SERVICE_UNAVAILABLE`. No managed MySQL 8 is
   reachable from Vercel and no `DATABASE_URL` is configured for production, so
   every database-backed route fails. The deployment's runtime log shows the
   exact cause: `prisma.$queryRaw()` → `Raw query failed. Code: 45028.
   Message: pool timeout: failed to retrieve a connection from pool after
   10000ms (pool connections: active=0 idle=0 limit=10)`. Database-backed public
   pages behave the same way: `GET /careers` fails with
   `prisma.job.findMany()` → `P2028 Transaction API error: Unable to start a
   transaction in the given time`, and because that rejection is not caught the
   visitor sees Next.js's generic error shell rather than an outage message.
   Optional hardening (not applied, to keep the verified baseline unchanged):
   catch database failures on public pages such as `/careers` and render a
   graceful empty/outage state.
2. `POST /api/v1/auth/login` from the deployment's own origin → 403
   `CSRF_ORIGIN_MISMATCH`. `assertSameOrigin` (`src/lib/api.ts`) compares the
   request `Origin` against `APP_URL`, which was not set to this deployment's
   origin. `APP_URL` must be the exact production origin.
3. Document upload cannot work while `STORAGE_DRIVER=local` (see "Vercel
   specifics": the filesystem is read-only apart from `/tmp`).

To turn this into a verified production release:

1. Provision a managed MySQL 8 database with a least-privilege user, run
   `npm run db:deploy` once against it, and set `DATABASE_URL` for Production.
2. Set `SESSION_SECRET` (≥ 32 random bytes) and `APP_URL` (exact production
   origin) for Production, then run `npx vercel --prod`. Keep `TRUST_PROXY`
   unset — Vercel terminates TLS at its edge but does not append a validated
   client-address hop; see "Client address and proxies".
3. Install/authorize the Vercel GitHub App for `shyam1425/nexora` and connect
   the project (`npx vercel git connect`, or Project → Settings → Git) so pushes
   to `main` deploy automatically.
4. Re-run the post-deploy acceptance checklist below, including
   `SMOKE_BASE_URL=https://<domain> npm run smoke` (expect 7/7).

Required environment variables in the Vercel project:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `mysql://<least-privilege-user>:<password>@<managed-host>:3306/<database>?ssl=true&connectionLimit=5&connectTimeout=8000&socketTimeout=30000` — see "Managed MySQL compatibility" for why these parameters matter |
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
  public CA set, so a provider with a publicly-trusted certificate works without
  code changes. A provider that requires its **own** CA bundle (for example a
  default Aiven instance) needs the adapter to be constructed with
  `{ ssl: { ca } }` in `src/lib/prisma.ts`, since a CA cannot be expressed in the
  connection URL.
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
