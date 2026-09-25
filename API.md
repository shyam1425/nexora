# API Contract

Base path: `/api/v1`. JSON responses use `{ success: true, data }` or `{ success: false, error: { code, message, details? } }`. State-changing requests require a same-origin `Origin`/`Referer` and are protected against CSRF. All protected endpoints enforce authentication and authorization on the server.

## Health and identity

- `GET /health` — public dependency health check.
- `GET /auth/me` — current session identity.
- `POST /auth/register/candidate`
- `POST /auth/register/client`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password`

## Recruitment

- `POST /jobs` — recruiter/admin creates a draft job.
- `POST /jobs/:id/publish` — assigned recruiter/admin publishes a draft.
- `POST /requirements` — client creates a manpower requirement for its own company.
- `POST /submissions` — assigned recruiter submits a candidate who has applied to the exact client/job.
- `PATCH /submissions/:id/review` — owning client reviews a submission and records feedback.
- `POST /applications` — verified candidate applies to a published public job.
- `PATCH /applications/:id/status` — guarded manual application transition; workflow-only states are rejected.
- `POST /interviews` — assigned recruiter schedules a shortlisted application.
- `POST /interviews/:id/feedback` — assigned interviewer/recruiter records feedback.
- `PATCH /candidate/profile` — verified candidate updates only their own candidate profile and recalculates completion.
- `POST /offers` — recruiter/admin creates and releases an offer.
- `POST /offers/:id/respond` — candidate accepts or declines their offer.
- `PATCH /joinings/:id/complete` — HR/recruiter completes joining and creates an employee.

## Documents and notifications

- `POST /documents` — multipart private upload; validates metadata, size, extension, MIME, and file signature.
- `GET /documents/:id` — authorized private download with `Cache-Control: private, no-store`.
- `GET /notifications` — current user's notifications and unread count.
- `PATCH /notifications/:id` — mark one owned notification read.
- `POST /notifications/read-all` — mark all current-user notifications read.

## Error principles

- `401` missing/invalid/expired session.
- `403` authenticated but unauthorized, including role and record ownership failures.
- `404` resource absent or not visible to the caller.
- `409` duplicate or invalid concurrent state transition.
- `422` server-side Zod validation failure.
- `429` rate limit.

Do not treat client-side validation, middleware redirects, or UI visibility as authorization. API handlers and domain services must enforce the rule at the record boundary.
