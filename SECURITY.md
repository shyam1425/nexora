# Security Notes

## Implemented controls

- Passwords are hashed with bcrypt cost 12; plaintext passwords and tokens are never persisted or logged.
- Session tokens are random opaque values; only SHA-256 hashes are stored. Cookies are HTTP-only, SameSite=Lax, scoped to `/`, and Secure when `APP_URL` is HTTPS.
- Login, registration, recovery, verification, document, and application operations have rate limits where applicable.
- Client addresses are never taken from client-supplied forwarding headers: `x-forwarded-for` and `x-real-ip` are read only when `TRUST_PROXY` explicitly declares the reverse proxy in front, and the right-most validated hop is used so a caller cannot prepend a forged address. Values are accepted only as literal IPv4/IPv6, so a hostile header can neither widen rate-limit buckets nor forge the `ipAddress` stored on audit rows.
- Password reset and email verification tokens are single-use, purpose-bound, expiring, and hashed at rest.
- State-changing API requests enforce same-origin checks; middleware is only a coarse anonymous redirect gate.
- RBAC is enforced in server-side route handlers and domain services, with record ownership/assignment checks for recruiters, clients, candidates, employees, and documents.
- Application, submission, interview, offer, and joining transitions are allow-listed and concurrency-checked.
- Candidate-visible interview meeting links must use HTTP or HTTPS; unsafe schemes are rejected at scheduling time and filtered again at render time.
- Uploads are private, size-limited, extension/MIME/signature checked, assigned safe random storage keys, and never served from the public web root.
- Private object storage accepts only the canonical document types; the accepted MIME type/extension pairs and the file-signature check are shared by the API and the storage layer, and the persisted key is always derived from a random UUID plus a validated extension, never from user-supplied file names.
- Submission creation requires a published job, a real application for that exact job, recruiter assignment, and client ownership; duplicates are database-protected.
- Document downloads require authorization, generate an access log, audit the access, and disable caching.
- Audit records avoid secrets and sensitive document contents. The console email adapter logs metadata and length only, never message bodies or verification links.
- Security headers include CSP, frame denial, MIME sniffing protection, referrer policy, permissions policy, and HSTS.

## Deployment requirements

- Terminate TLS before the application and set `APP_URL=https://...`.
- Set `TRUST_PROXY=true` when exactly one reverse proxy or load balancer sits in front and it controls `x-forwarded-for`/`x-real-ip`; leave it unset when clients reach the application directly. See DEPLOYMENT.md "Client address and proxies".
- Use a dedicated least-privilege MySQL user; never use root in production.
- Set a random `SESSION_SECRET` (32+ bytes) through the platform secret manager.
- Configure SMTP and private object storage through secrets; do not put them in Git or client-side variables.
- Keep `.env`, `storage/`, database backups, and seed credentials out of source control and images.
- Restrict database/network access to the application and migration runner.

## Known limitations to resolve before launch

- S3-compatible object storage is implemented (`STORAGE_DRIVER=s3`) with SigV4-signed requests, private objects only, and fail-fast configuration errors; local storage remains single-instance only and is not a multi-instance production store.
- CSP currently allows inline styles/scripts required by the framework; a nonce-based CSP is tracked as hardening work.
- Rate limiting is process-local in the current implementation; use a shared store for multi-instance deployments.
- With `TRUST_PROXY` unset the per-IP rate-limit buckets collapse into one stricter global bucket, because client-supplied forwarding headers are not trusted. Set `TRUST_PROXY=true` behind the documented proxy to restore per-IP granularity.
- Deployed HTTPS browser acceptance is still pending a real domain and external credentials.

Report suspected vulnerabilities privately to the project owner. Do not include real tokens, passwords, document contents, or customer data in issue reports.
