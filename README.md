# NEXORA

**Workforce. Recruitment. Payroll. HR solutions.**

NEXORA is a connected workforce platform for clients, recruiters, candidates, employees, and administrators. The current Production MVP focuses on the real recruitment path:

```text
client requirement → job → candidate application → recruiter screening
→ submission → interview → offer → joining → employee record
```

The application uses real MySQL persistence, server-side authorization, private document authorization, notifications, and audit records. Production is live at https://nexora-three-woad.vercel.app and releases deploy automatically from `main` through the Vercel GitHub integration (`source=git`). Real SMTP delivery and S3-compatible object storage still require operator credentials.

## Stack

- Next.js 16 App Router and React 19
- TypeScript in strict mode
- Tailwind CSS 4 and reusable UI primitives
- Prisma 7 with the MySQL/MariaDB driver adapter
- Zod validation
- Vitest with MySQL-backed integration tests
- Node.js standalone output and a multi-stage `Dockerfile`

## Local development

Requirements: Node.js `>=22.12.0`, npm `>=11`, and a MySQL-compatible database.

```powershell
cd D:\project
Copy-Item .env.example .env
npm ci
npm run db:generate
npm run db:migrate       # local development only
npm run dev
```

Open `http://localhost:3000`.

The repository includes `D:\project\scripts\dev-db.ps1` for a dedicated local MySQL instance on port `3307`. It is isolated from the machine's normal MySQL service. Do not use its reset action against any shared or production database.

`npm test` runs unit suites plus MySQL-backed integration suites, so the development database must be running. `tests/setup.ts` warns when `DATABASE_URL` is unreachable. Start it with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 -Action start
```

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Generate Prisma Client and build standalone production output |
| `npm start` | Start the generated standalone server |
| `npm run lint` | Run ESLint with warnings treated as errors |
| `npm run typecheck` | Run strict TypeScript checking |
| `npm test` | Run unit and MySQL integration tests |
| `npm run validate` | Run lint, typecheck, tests, and production build |
| `npm run db:status` | Check migration status |
| `npm run db:deploy` | Apply committed migrations in a release environment |
| `npm run smoke` | Check a running server over HTTP |
| `npm run db:seed` | Explicitly seed reference/bootstrap data |

## Main routes

- `/` — public corporate website
- `/careers` — searchable published jobs
- `/login`, `/register/candidate`, `/register/client` — identity flows
- `/candidate` — candidate applications, interviews, offers, and profile
- `/recruiter` — assigned jobs, applicants, submissions, and workflow actions
- `/client` — requirements and candidate submission review
- `/employee` — employee record, documents, attendance, leave, and payslips
- `/admin` — operational metrics and recent audit activity

## Configuration and deployment

Copy `D:\project\.env.example` to a local `.env` only for development. Production secrets must come from the hosting platform's secret manager. Releases are triggered by pushing to `main`; project `nexora` requires cryptographically verified commits, so commits must be **signed** (`commit.gpgsign=true`) or Vercel cancels the deployment. See:

- `D:\project\DEPLOYMENT.md` — release, HTTPS, Docker, rollback, and acceptance steps
- `D:\project\SECURITY.md` — controls and known limitations
- `D:\project\DATABASE.md` — schema ownership and migration safety
- `D:\project\ARCHITECTURE.md` — runtime boundaries
- `D:\project\PROJECT_STATUS.md` — verified status and next work

Never commit `.env`, private storage, database backups, tokens, or real candidate/employee documents.

