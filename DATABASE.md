# Database

## Provider and migration

- Provider: MySQL 8 through Prisma's MariaDB driver adapter.
- Schema: `D:\project\prisma\schema.prisma`.
- Prisma CLI configuration: `D:\project\prisma.config.ts`.
- Migrations: `D:\project\prisma\migrations`.
- Local dedicated MySQL helper: `D:\project\scripts\dev-db.ps1` (port `3307`; it does not reset the machine's normal MySQL service).

```powershell
cd D:\project
npm run db:generate
npm run db:migrate       # development only
npm run db:deploy        # staging/production release
npm run db:seed          # explicit bootstrap/reference data
```

The current development database has one applied migration and reports an up-to-date schema. Migration drift must be checked in the target environment before release.

## Main ownership relationships

- `User` owns sessions, verification tokens, notifications, candidate/employee/client links, and audit actor references.
- `CandidateProfile` belongs to one user and owns applications, documents, experience, education, submissions, and joining records.
- `Client` owns requirements, jobs, submissions, client users, and employees.
- `Job` belongs to a client and optionally a requirement; applications and submissions reference it.
- `Application` has a composite uniqueness rule on `(jobId, candidateProfileId)` and owns status history, notes, interviews, offer, and joining.
- `Submission` is unique on `(clientId, jobId, candidateProfileId)` and is created only for a candidate with an application to that job.
- `Joining` links an accepted offer/application to the future employee record.
- `Document` stores private metadata and never exposes its storage key as a public URL.

## Integrity and concurrency

The schema uses foreign keys, cascade/restrict behavior, status enums, unique constraints, and indexes for ownership/status/search paths. Domain services use conditional `updateMany` checks to prevent two operators from applying the same transition twice. Submission creation, client review, interview completion, offer response, and joining creation are transaction-backed.

## Backup and environment safety

Never run reset, truncate, or destructive seed operations against production. Take a database backup before applying migrations, use a least-privilege application user, and keep environment URLs out of Git. See `D:\project\DEPLOYMENT.md`.
