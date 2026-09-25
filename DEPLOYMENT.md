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
