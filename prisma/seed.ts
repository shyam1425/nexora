/**
 * Database seed.
 *
 * Creates the reference data the application requires to operate (leave types)
 * plus bootstrap staff accounts from environment variables.
 *
 * Demo/example records are ONLY created when SEED_DEMO_DATA=true and
 * NODE_ENV !== 'production' (or ALLOW_DEMO_SEED=true explicitly). They are
 * clearly labelled as seed data and never impersonate real customers.
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/auth/password';

type AccountSpec = {
  email: string;
  password: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'RECRUITER';
};

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} must be set to run the seed script`);
  return value;
}

async function seedLeaveTypes(): Promise<void> {
  const types = [
    { code: 'CASUAL', name: 'Casual Leave', annualQuotaDays: 12, isPaid: true },
    { code: 'SICK', name: 'Sick Leave', annualQuotaDays: 8, isPaid: true },
    { code: 'EARNED', name: 'Earned Leave', annualQuotaDays: 15, isPaid: true },
    { code: 'UNPAID', name: 'Leave Without Pay', annualQuotaDays: 0, isPaid: false },
  ];

  for (const type of types) {
    await prisma.leaveType.upsert({
      where: { code: type.code },
      update: {
        name: type.name,
        annualQuotaDays: type.annualQuotaDays,
        isPaid: type.isPaid,
        isActive: true,
      },
      create: type,
    });
  }

  console.log(`[seed] leave types ready (${types.length})`);
}

async function seedSettings(): Promise<void> {
  const settings: Array<{ key: string; value: string }> = [
    { key: 'company.name', value: process.env.APP_NAME ?? '360 WorkFox Tech' },
    { key: 'company.currency', value: process.env.DEFAULT_CURRENCY ?? 'INR' },
    { key: 'payroll.workingDays', value: process.env.PAYROLL_WORKING_DAYS ?? '22' },
    { key: 'jobs.publicListingEnabled', value: 'true' },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log(`[seed] system settings ready (${settings.length})`);
}

async function upsertStaffAccount(spec: AccountSpec): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: spec.email } });
  const passwordHash = await hashPassword(spec.password);

  const user = await prisma.user.upsert({
    where: { email: spec.email },
    update: {
      name: spec.name,
      role: spec.role,
      status: 'ACTIVE',
      // Staff accounts are provisioned out-of-band, so the mailbox is trusted.
      emailVerifiedAt: existing?.emailVerifiedAt ?? new Date(),
    },
    create: {
      email: spec.email,
      passwordHash,
      name: spec.name,
      role: spec.role,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  if (!existing) {
    console.log(`[seed] created ${spec.role} account: ${spec.email}`);
  } else {
    console.log(`[seed] ${spec.role} account already present: ${spec.email}`);
  }

  return user.id;
}

async function seedDemoData(): Promise<void> {
  const demoPassword = 'Demo@12345';
  const stamp = randomBytes(3).toString('hex');
  const passwordHash = await hashPassword(demoPassword);

  const recruiterEmail = `recruiter.seed.${stamp}@workfox.tech`;
  const recruiter = await prisma.user.create({
    data: {
      email: recruiterEmail,
      passwordHash,
      name: 'Priya Nair (seed recruiter)',
      role: 'RECRUITER',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  const clientEmail = `client.seed.${stamp}@workfox.tech`;
  const clientUser = await prisma.user.create({
    data: {
      email: clientEmail,
      passwordHash,
      name: 'Rahul Mehta (seed client)',
      role: 'CLIENT',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  const client = await prisma.client.create({
    data: {
      name: `Seed Corp ${stamp}`,
      code: `seed-corp-${stamp}`,
      industry: 'Information Technology',
      city: 'Bengaluru',
      country: 'India',
      contactName: 'Rahul Mehta',
      contactEmail: clientEmail,
      status: 'ACTIVE',
      createdById: clientUser.id,
      users: { create: { userId: clientUser.id, isPrimary: true } },
    },
  });

  const requirement = await prisma.requirement.create({
    data: {
      clientId: client.id,
      title: 'Senior React Developer',
      description:
        'Seed requirement: build and maintain customer-facing web applications.',
      skills: ['React', 'TypeScript', 'REST APIs'],
      positionsCount: 2,
      location: 'Bengaluru',
      workMode: 'HYBRID',
      employmentType: 'FULL_TIME',
      minExperienceMonths: 48,
      budgetMin: 1200000,
      budgetMax: 1800000,
      currency: 'INR',
      status: 'OPEN',
      priority: 'HIGH',
      createdById: clientUser.id,
    },
  });

  const job = await prisma.job.create({
    data: {
      clientId: client.id,
      requirementId: requirement.id,
      title: 'Senior React Developer (Seed)',
      slug: `senior-react-developer-seed-${stamp}`,
      description:
        'We are hiring a Senior React Developer to join a product engineering team working on large scale web platforms.',
      responsibilities:
        'Design, build and maintain React applications.\nMentor junior engineers.\nOwn code quality.',
      requirements:
        '4+ years of experience with React and TypeScript.\nStrong understanding of REST APIs and testing.',
      skills: ['React', 'TypeScript', 'Next.js'],
      employmentType: 'FULL_TIME',
      workMode: 'HYBRID',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      minExperienceMonths: 48,
      minCtc: 1200000,
      maxCtc: 1800000,
      currency: 'INR',
      positionsCount: 2,
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      publishedAt: new Date(),
      createdById: recruiter.id,
      recruiterId: recruiter.id,
    },
  });

  const candidateEmail = `candidate.seed.${stamp}@workfox.tech`;
  const candidateUser = await prisma.user.create({
    data: {
      email: candidateEmail,
      passwordHash,
      name: 'Ananya Sharma (seed candidate)',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  const candidate = await prisma.candidateProfile.create({
    data: {
      userId: candidateUser.id,
      firstName: 'Ananya',
      lastName: 'Sharma',
      phone: '+91 90000 00000',
      city: 'Bengaluru',
      country: 'India',
      headline: 'Senior React Developer',
      summary: 'Seed candidate profile used for demonstration and testing.',
      totalExperienceMonths: 66,
      currentCtc: 1400000,
      expectedCtc: 1800000,
      noticePeriodDays: 30,
      currentCompany: 'Seed Technologies',
      currentDesignation: 'Senior Software Engineer',
      skills: ['React', 'TypeScript', 'Node.js'],
    },
  });

  const application = await prisma.application.create({
    data: {
      jobId: job.id,
      candidateProfileId: candidate.id,
      status: 'APPLIED',
      coverLetter: 'Seed application: I am interested in this role.',
      source: 'CAREERS_PAGE',
      history: {
        create: { toStatus: 'APPLIED', note: 'Application submitted (seed data)' },
      },
    },
  });

  console.log('[seed] demo data created:');
  console.log(`  recruiter : ${recruiterEmail} / ${demoPassword}`);
  console.log(`  client    : ${clientEmail} / ${demoPassword}`);
  console.log(`  candidate : ${candidateEmail} / ${demoPassword}`);
  console.log(`  job slug  : ${job.slug}`);
  console.log(`  application: ${application.id}`);
}

async function main(): Promise<void> {
  console.log('[seed] starting');

  await seedLeaveTypes();
  await seedSettings();

  const adminEmail = requireEnv('SEED_ADMIN_EMAIL');
  const adminPassword = requireEnv('SEED_ADMIN_PASSWORD');

  const adminId = await upsertStaffAccount({
    email: adminEmail.toLowerCase(),
    password: adminPassword,
    name: 'Platform Administrator',
    role: 'SUPER_ADMIN',
  });
  void adminId;

  const demoRequested = process.env.SEED_DEMO_DATA === 'true';
  const isProduction = process.env.NODE_ENV === 'production';
  const allowInProduction = process.env.ALLOW_DEMO_SEED === 'true';

  if (demoRequested && (!isProduction || allowInProduction)) {
    await seedDemoData();
  } else if (demoRequested) {
    console.log(
      '[seed] SEED_DEMO_DATA=true ignored in production (set ALLOW_DEMO_SEED=true to override)',
    );
  }

  console.log('[seed] completed');
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

