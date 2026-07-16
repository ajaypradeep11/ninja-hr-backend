// prisma/seed.ts — idempotent demo seed (safe to re-run against a live DB).
// Run: npm run db:seed
import 'dotenv/config';
import '../src/platform/database/resolve-db-env'; // rewrites DATABASE_URL from DB_LIVE before the client below
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/platform/database/generated/prisma/client';
import { tenantExtension } from '../src/platform/database/tenant.extension';
import type { TenantContext } from '../src/platform/database/tenant-context';

// The demo seed populates a single tenant. Fixed id + slug so it is idempotent
// and so the e2e harness can address this company explicitly (x-company-id).
const SEED_COMPANY_ID = 'seed-company';
const SEED_COMPANY_SLUG = 'acme';
const SEED_COMPANY_NAME = 'Acme Inc.';

const base = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Every seeded row belongs to the seed company. Rather than stamp companyId on
// ~20 models by hand, run the whole seed through the same tenant extension the
// app uses: it auto-scopes reads and stamps companyId on all writes. (The seed
// has no nested relation writes, which the extension would not stamp.)
const prisma = base.$extends(tenantExtension({ companyId: SEED_COMPANY_ID } as unknown as TenantContext));

async function seedCompany(): Promise<void> {
  await base.company.upsert({
    where: { id: SEED_COMPANY_ID },
    update: { name: SEED_COMPANY_NAME, slug: SEED_COMPANY_SLUG },
    create: { id: SEED_COMPANY_ID, name: SEED_COMPANY_NAME, slug: SEED_COMPANY_SLUG },
  });
  console.log(`company: ${SEED_COMPANY_NAME} (${SEED_COMPANY_SLUG})`);
}

/* ------------------------------ Identity ------------------------------ */

interface SeedUser {
  email: string;
  role: 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';
  // Employee fields used only if the employee doesn't exist yet.
  name: string;
  title: string;
  department: string;
  province: 'ON' | 'BC' | 'AB' | 'QC' | 'SK' | 'MB' | 'NS' | 'NB';
  salary: number;
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'sarah.mitchell@company.ca',
    role: 'HR_ADMIN',
    name: 'Sarah Mitchell',
    title: 'Director of People Operations',
    department: 'People',
    province: 'ON',
    salary: 145000,
  },
  {
    email: 'michael.s@company.ca',
    role: 'MANAGER',
    name: 'Michael Scott',
    title: 'Regional Sales Manager',
    department: 'Sales',
    province: 'ON',
    salary: 120000,
  },
  {
    email: 'angela.m@company.ca',
    role: 'MANAGER',
    name: 'Angela Martin',
    title: 'Senior Accountant',
    department: 'Finance',
    province: 'ON',
    salary: 98000,
  },
  {
    email: 'david.wallace@company.ca',
    role: 'MANAGER',
    name: 'David Wallace',
    title: 'Engineering Manager',
    department: 'Engineering',
    province: 'ON',
    salary: 155000,
  },
  {
    email: 'jim.scott@company.ca',
    role: 'EMPLOYEE',
    name: 'Jim Scott',
    title: 'Account Executive',
    department: 'Sales',
    province: 'BC',
    salary: 85000,
  },
];

async function seedUsers(): Promise<void> {
  for (const u of SEED_USERS) {
    // Match an existing employee by exact name first (demo rows predate these
    // emails), then by email; create only when neither exists.
    let employee = await prisma.employee.findFirst({ where: { name: u.name } });
    if (!employee) {
      employee = await prisma.employee.upsert({
        where: { email: u.email },
        update: {},
        create: {
          name: u.name,
          title: u.title,
          department: u.department,
          province: u.province,
          email: u.email,
          hireDate: new Date('2021-03-01'),
          birthDate: new Date('1985-06-15'),
          status: 'ACTIVE',
          salary: u.salary,
        },
      });
    }
    await prisma.user.upsert({
      where: { employeeId: employee.id },
      update: { role: u.role },
      create: { employeeId: employee.id, role: u.role },
    });
    console.log(`user: ${u.name} → ${u.role}`);
  }
}

/* --------------------------- Communication templates ------------------ */

const SEED_TEMPLATES = [
  {
    name: 'Application Received',
    trigger: 'APPLICATION_RECEIVED' as const,
    isDefault: true,
    subject: 'We received your application for {{job_title}}',
    body: `Hi {{candidate_name}},

Thank you for applying to the {{job_title}} role at {{company}}. Our team is reviewing your application and will be in touch about next steps.

You can follow the status of your application any time using your personal tracking link.

Warm regards,
The {{company}} Talent Team`,
  },
  {
    name: 'Interview Invitation',
    trigger: 'INTERVIEW_SCHEDULED' as const,
    isDefault: true,
    subject: 'Interview invitation — {{job_title}} at {{company}}',
    body: `Hi {{candidate_name}},

Great news — we'd like to invite you to interview for the {{job_title}} role. Our coordinator will follow up shortly to schedule a time that works for you.

Talk soon,
The {{company}} Talent Team`,
  },
  {
    name: 'Application Update',
    trigger: 'REJECTED' as const,
    isDefault: true,
    subject: 'Update on your application for {{job_title}}',
    body: `Hi {{candidate_name}},

Thank you for the time you invested in applying for the {{job_title}} role at {{company}}. After careful consideration, we've decided to move forward with other candidates for this position.

We'd love to stay in touch about future opportunities that match your experience.

Best wishes,
The {{company}} Talent Team`,
  },
  {
    name: 'Follow-up',
    trigger: 'MANUAL' as const,
    isDefault: false,
    subject: 'Following up on your application — {{job_title}}',
    body: `Hi {{candidate_name}},

Just a quick note from the {{company}} team about your application for {{job_title}} — we appreciate your patience while our review continues.

Best,
The {{company}} Talent Team`,
  },
];

async function seedTemplates(): Promise<void> {
  for (const t of SEED_TEMPLATES) {
    await prisma.communicationTemplate.upsert({
      where: { name: t.name },
      update: {},
      create: { name: t.name, trigger: t.trigger, isDefault: t.isDefault, subject: t.subject, body: t.body },
    });
    console.log(`template: ${t.name}`);
  }
}

/* ----------------------------- HRIS enrichment ------------------------ */

// Fills the new HRIS fields for existing employees so the Employees module
// isn't empty. Idempotent: only sets fields when they're still blank, and
// gives each employee a stable EMP-#### number + a primary emergency contact.
async function seedHris(): Promise<void> {
  const employees = await prisma.employee.findMany({ orderBy: { createdAt: 'asc' } });
  let n = 1;
  for (const e of employees) {
    const num = `EMP-${String(n).padStart(4, '0')}`;
    n += 1;
    await prisma.employee.update({
      where: { id: e.id },
      data: {
        employeeNumber: e.employeeNumber ?? num,
        phone: e.phone ?? '(416) 555-0' + String(100 + n).slice(-3),
        personalEmail: e.personalEmail ?? e.email.replace('@', '.personal@'),
        addressStreet: e.addressStreet ?? `${100 + n} Bloor St W`,
        addressCity: e.addressCity ?? 'Toronto',
        addressProvince: e.addressProvince ?? e.province,
        addressPostal: e.addressPostal ?? 'M5S 1M2',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        employmentType: e.employmentType ?? ('FULL_TIME' as any),
        workLocation: e.workLocation ?? 'Toronto HQ (Hybrid)',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payFrequency: e.payFrequency ?? ('BIWEEKLY' as any),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        workEligibility: e.workEligibility ?? ('CITIZEN' as any),
        td1FederalOnFile: true,
        td1ProvincialOnFile: true,
        // Demo-only sensitive values — always returned masked by the API.
        sin: e.sin ?? '4' + String(600000000 + n * 137).slice(-8),
        bankInstitution: e.bankInstitution ?? '003 (RBC)',
        bankTransit: e.bankTransit ?? '00552',
        bankAccount: e.bankAccount ?? String(7000000 + n * 991).slice(-7),
      },
    });
    // Give each employee a primary emergency contact if they have none.
    const existing = await prisma.emergencyContact.count({ where: { employeeId: e.id } });
    if (existing === 0) {
      await prisma.emergencyContact.create({
        data: {
          employeeId: e.id,
          name: `${e.name.split(' ')[0]}'s Contact`,
          relationship: n % 2 === 0 ? 'Spouse' : 'Parent',
          phone: '(416) 555-0' + String(200 + n).slice(-3),
          isPrimary: true,
        },
      });
    }
    console.log(`hris: ${e.name} → ${num}`);
  }
}

/* ---------------------------- Company training ------------------------ */

const SEED_COURSES = [
  {
    title: 'Workplace Health & Safety Orientation',
    category: 'Health & Safety',
    description: 'Company safety practices, hazard reporting and emergency procedures.',
    durationMins: 45,
    passMark: 80,
  },
  {
    title: 'Respectful Workplace & Anti-Harassment',
    category: 'Culture',
    description: 'Our code of conduct and how we keep the workplace respectful and inclusive.',
    durationMins: 30,
    passMark: 80,
  },
  {
    title: 'Information Security Essentials',
    category: 'Security',
    description: 'Password hygiene, phishing awareness and handling confidential data.',
    durationMins: 40,
    passMark: 90,
  },
  {
    title: 'Customer Success Fundamentals',
    category: 'Professional Development',
    description: 'How we delight customers and handle escalations.',
    durationMins: 60,
  },
];

// Legacy province-mandated courses from before the company-training pivot.
const LEGACY_COURSE_TITLES = [
  'EDI & Workplace Belonging',
  'Cybersecurity Essentials',
  'AODA Awareness Training',
  'WHMIS 2015',
  'Bullying & Harassment (WorkSafeBC)',
];

async function seedTraining(): Promise<void> {
  // Remove legacy province-mandated catalog rows — training is company-only now.
  await prisma.trainingCourse.deleteMany({ where: { title: { in: LEGACY_COURSE_TITLES } } });
  for (const c of SEED_COURSES) {
    const existing = await prisma.trainingCourse.findFirst({ where: { title: c.title } });
    if (!existing) {
      await prisma.trainingCourse.create({ data: c });
      console.log(`course: ${c.title}`);
    }
  }
  // Assign the two mandatory-style company courses to every active employee.
  const core = await prisma.trainingCourse.findMany({
    where: { title: { in: [SEED_COURSES[0].title, SEED_COURSES[1].title] } },
  });
  const employees = await prisma.employee.findMany({ where: { status: 'ACTIVE' } });
  for (const course of core) {
    for (const e of employees) {
      await prisma.trainingAssignment.upsert({
        where: { courseId_employeeId: { courseId: course.id, employeeId: e.id } },
        update: {},
        create: {
          courseId: course.id,
          employeeId: e.id,
          dueDate: new Date('2026-08-31'),
        },
      });
    }
  }
  console.log(`training assigned: ${core.length} core course(s) → ${employees.length} employees`);
}

/* ------------------- Continuous performance (growth) ------------------- */

async function seedGrowth(): Promise<void> {
  const byName = async (name: string) =>
    prisma.employee.findFirst({ where: { name } });

  const jim = await byName('Jim Scott');
  const michael = await byName('Michael Scott');
  const peer = await byName('Angela Martin');
  if (!jim) return;

  // Goals (aligned to company strategy) — the former hardcoded UI mock, now real.
  if ((await prisma.goal.count({ where: { employeeId: jim.id } })) === 0) {
    const goals = [
      {
        title: 'Close $1.2M in net-new pipeline (Q2)',
        alignment: 'Q2 Global Revenue Target',
        progress: 72,
        due: new Date('2026-06-30'),
      },
      {
        title: 'Complete Solution Selling certification',
        alignment: 'Sales Excellence Program',
        progress: 40,
        due: new Date('2026-07-31'),
      },
      {
        title: 'Mentor one new SDR through ramp',
        alignment: 'Talent Development Initiative',
        progress: 90,
        due: new Date('2026-06-20'),
      },
    ];
    for (const g of goals) {
      const goal = await prisma.goal.create({ data: { ...g, employeeId: jim.id } });
      await prisma.goalUpdate.create({
        data: { goalId: goal.id, progress: g.progress, note: 'Carried over from Q2 check-in.' },
      });
    }
    console.log('growth: goals seeded for Jim');
  }

  // Next 1-on-1 with the department manager, agenda started from both sides.
  if ((await prisma.oneOnOne.count({ where: { employeeId: jim.id } })) === 0 && michael) {
    const next = new Date();
    next.setDate(next.getDate() + 6);
    next.setHours(14, 30, 0, 0);
    await prisma.oneOnOne.create({
      data: {
        employeeId: jim.id,
        managerName: michael.name,
        scheduledAt: next,
        talkingPoints: [
          { id: 'tp-1', author: jim.name, text: 'Pipeline coverage for July — where I need air cover' },
          { id: 'tp-2', author: michael.name, text: 'Q3 territory planning kickoff' },
        ],
        actionItems: [
          { id: 'ai-1', text: 'Send Michael the updated Acme Corp proposal', done: true },
          { id: 'ai-2', text: 'Book shadowing session with the new SDR', done: false },
        ],
      },
    });
    console.log('growth: 1-on-1 seeded for Jim');
  }

  // Recognition feed + a pending feedback request so both flows have data.
  if ((await prisma.kudos.count({ where: { toId: jim.id } })) === 0) {
    if (peer) {
      await prisma.kudos.create({
        data: {
          fromId: peer.id,
          toId: jim.id,
          emoji: '🎉',
          message: 'Huge thanks for jumping on the Dunmore High demo with zero notice — client loved it!',
        },
      });
    }
    if (michael) {
      await prisma.kudos.create({
        data: {
          fromId: michael.id,
          toId: jim.id,
          emoji: '🏆',
          message: 'Top pipeline creation in the region this month. That’s how it’s done.',
        },
      });
    }
    console.log('growth: kudos seeded for Jim');
  }
  if (peer && (await prisma.feedbackRequest.count({ where: { requesterId: jim.id } })) === 0) {
    await prisma.feedbackRequest.create({
      data: {
        requesterId: jim.id,
        colleagueId: peer.id,
        topic: 'Acme Corp renewal presentation',
        message: 'Would love your take on how the deck landed — anything I should tighten up?',
      },
    });
    console.log('growth: feedback request seeded for Jim');
  }
}

/* --------------------- Letter Lab & Calculator Engine ------------------ */

const SEED_LETTERS = [
  {
    name: 'Standard Offer Letter',
    category: 'Offer',
    body: `Dear {{employee_name}},

We are delighted to offer you the position of {{title}} in our {{department}} department, starting {{start_date}}.

Your annual salary will be {{salary}}, and you will report to {{manager_name}}. This offer is contingent on the terms outlined in your employment agreement, governed by the Ontario Employment Standards Act, 2000.

We look forward to welcoming you to the team.

Sincerely,
{{company}} People Operations`,
  },
  {
    name: '90-Day Probation Pass',
    category: 'Probation',
    body: `Dear {{employee_name}},

Congratulations! We are pleased to confirm that you have successfully completed your 90-day probationary period as {{title}} effective {{today}}.

Your manager, {{manager_name}}, and the People team have been impressed with your contributions to {{department}}. Your employment now continues under the full terms of your agreement.

Warm regards,
{{company}} People Operations`,
  },
  {
    name: 'Promotion Letter',
    category: 'Promotion',
    body: `Dear {{employee_name}},

We are thrilled to confirm your promotion to {{title}}, effective {{today}}.

This promotion reflects your outstanding performance in {{department}}. Your updated compensation is {{salary}} per annum. {{manager_name}} will review your new responsibilities with you this week.

Congratulations on this well-deserved step.

Sincerely,
{{company}} People Operations`,
  },
  {
    name: 'Termination Notice',
    category: 'Termination',
    body: `Dear {{employee_name}},

This letter confirms that your employment with {{company}} as {{title}} will end effective {{today}}.

You will receive all statutory entitlements under the Ontario Employment Standards Act, 2000, including any owed wages, vacation pay, and notice or pay in lieu. Please contact People Operations regarding the return of company property and your Record of Employment.

We thank you for your contributions and wish you well.

Sincerely,
{{company}} People Operations`,
  },
];

async function seedLetterLab(): Promise<void> {
  for (const t of SEED_LETTERS) {
    const existing = await prisma.letterTemplate.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.letterTemplate.create({ data: t });
      console.log(`letter template: ${t.name}`);
    }
  }
}

async function seedCalcRules(): Promise<void> {
  if ((await prisma.calcRule.count()) > 0) return;
  await prisma.calcRule.createMany({
    data: [
      // Ontario ESA: overtime after 44 hours/week at 1.5x.
      {
        category: 'TIMESHEET',
        field: 'Total Weekly Hours',
        operator: '>',
        threshold: 44,
        action: 'Multiply Base Rate',
        value: 1.5,
      },
      {
        category: 'ACCRUAL',
        field: 'Hours Worked',
        operator: '>=',
        threshold: 1,
        action: 'Accrue Vacation %',
        value: 4,
      },
      {
        category: 'BONUS',
        field: 'Total Weekly Hours',
        operator: '>=',
        threshold: 50,
        action: 'Add Flat Bonus $',
        value: 100,
      },
    ],
  });
  console.log('calc rules: 3 defaults seeded');
}

/* -------------------------------- Main -------------------------------- */

async function main(): Promise<void> {
  await seedCompany();
  await seedUsers();
  await seedTemplates();
  await seedHris();
  await seedTraining();
  await seedGrowth();
  await seedLetterLab();
  await seedCalcRules();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => base.$disconnect());
