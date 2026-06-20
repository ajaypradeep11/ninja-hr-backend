import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  employees,
  leaveRequests,
  requisitions,
  candidates,
  performanceReviews,
  pips,
  trainingCourses,
  offboardingTasks,
  benefitsCarriers,
  agentRuns,
  vaultDocuments,
  salaryBenchmarks,
} from "../lib/data";
import { seedCases } from "../lib/onboarding";
import {
  empStatusToDb,
  caseStatusToDb,
  ownerToDb,
  taskStatusToDb,
  accessToDb,
  docStatusToDb,
  leaveTypeToDb,
  leaveStatusToDb,
  employmentTypeToDb,
  reqStatusToDb,
  candidateStageToDb,
  reviewStateToDb,
  pipStateToDb,
  offboardingOwnerToDb,
  carrierStatusToDb,
  carrierMethodToDb,
  agentStatusToDb,
  docAccessToDb,
} from "../lib/db-map";

/** Create a PrismaClient pointed at the current DATABASE_URL (pg adapter). */
export function makeSeedClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

/** Wipe and re-seed all tables. Returns the resulting row counts. */
export async function runSeed(prisma: PrismaClient): Promise<Record<string, number>> {
  // Clean slate (children before parents).
  await prisma.auditEntry.deleteMany();
  await prisma.consentEntry.deleteMany();
  await prisma.caseDocument.deleteMany();
  await prisma.checklistTask.deleteMany();
  await prisma.onboardingCase.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.performanceReview.deleteMany();
  await prisma.vaultDocument.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.requisition.deleteMany();
  await prisma.pip.deleteMany();
  await prisma.trainingCourse.deleteMany();
  await prisma.offboardingTask.deleteMany();
  await prisma.benefitsCarrier.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.salaryBenchmark.deleteMany();
  await prisma.employee.deleteMany();

  // Employees (build name -> id map for FK resolution).
  const empId = new Map<string, string>();
  for (const e of employees) {
    const row = await prisma.employee.create({
      data: {
        name: e.name,
        title: e.title,
        department: e.department,
        province: e.province as never,
        email: e.email,
        hireDate: new Date(e.hireDate),
        birthDate: new Date(e.birthDate),
        manager: e.manager ?? null,
        status: empStatusToDb[e.status] as never,
        salary: e.salary,
      },
    });
    empId.set(e.name, row.id);
  }

  // Onboarding cases (nested children).
  for (const c of seedCases()) {
    await prisma.onboardingCase.create({
      data: {
        token: c.token,
        name: c.name,
        title: c.title,
        department: c.department,
        province: c.province as never,
        startDate: new Date(c.startDate),
        personalEmail: c.personalEmail,
        status: caseStatusToDb[c.status] as never,
        forms: c.forms,
        policiesAttached: c.policiesAttached,
        createdAt: new Date(c.createdAt),
        checklist: {
          create: c.checklist.map((t, i) => ({
            label: t.label,
            owner: ownerToDb[t.owner] as never,
            status: taskStatusToDb[t.status] as never,
            blocking: t.blocking,
            dataAccess: accessToDb[t.dataAccess] as never,
            order: i,
          })),
        },
        documents: {
          create: c.documents.map((d) => ({
            name: d.name,
            type: d.type,
            folder: d.folder,
            status: docStatusToDb[d.status] as never,
            signedAt: d.signedAt ? new Date(d.signedAt) : null,
            signedBy: d.signedBy ?? null,
            ip: d.ip ?? null,
          })),
        },
        consent: {
          create: c.consent.map((e) => ({
            policy: e.policy,
            version: e.version,
            timestamp: new Date(e.timestamp),
            ip: e.ip,
          })),
        },
        auditLog: { create: c.auditLog.map((a) => ({ at: new Date(a.at), event: a.event })) },
      },
    });
  }

  // Leave requests (FK -> employee).
  for (const l of leaveRequests) {
    const employeeId = empId.get(l.employee);
    if (!employeeId) continue;
    await prisma.leaveRequest.create({
      data: {
        employeeId,
        type: leaveTypeToDb[l.type] as never,
        start: new Date(l.start),
        end: new Date(l.end),
        status: leaveStatusToDb[l.status] as never,
        days: l.days,
      },
    });
  }

  // Requisitions (build title -> id map) + candidates (FK by role match).
  const reqIdByTitle = new Map<string, string>();
  for (const r of requisitions) {
    const row = await prisma.requisition.create({
      data: {
        title: r.title,
        department: r.department,
        province: r.province as never,
        type: employmentTypeToDb[r.type] as never,
        salaryMin: r.salaryMin,
        salaryMax: r.salaryMax,
        status: reqStatusToDb[r.status] as never,
        applicants: r.applicants,
        openedDate: new Date(r.openedDate),
      },
    });
    reqIdByTitle.set(r.title, row.id);
  }
  for (const c of candidates) {
    await prisma.candidate.create({
      data: {
        requisitionId: reqIdByTitle.get(c.role) ?? null,
        name: c.name,
        role: c.role,
        stage: candidateStageToDb[c.stage] as never,
        matchScore: c.matchScore,
        appliedDate: new Date(c.appliedDate),
        interviewDate: c.interviewDate ? new Date(c.interviewDate) : null,
        strengths: c.strengths,
        gaps: c.gaps,
      },
    });
  }

  // Performance reviews (FK -> employee) + PIPs (employeeId optional).
  for (const p of performanceReviews) {
    const employeeId = empId.get(p.employee);
    if (!employeeId) continue;
    await prisma.performanceReview.create({
      data: {
        employeeId,
        cycle: p.cycle,
        state: reviewStateToDb[p.state] as never,
        score: p.score ?? null,
        due: new Date(p.due),
      },
    });
  }
  for (const p of pips) {
    await prisma.pip.create({
      data: {
        employeeName: p.employee,
        employeeId: empId.get(p.employee) ?? null,
        manager: p.manager,
        durationDays: p.durationDays,
        state: pipStateToDb[p.state] as never,
        signedByManager: p.signedByManager,
        signedByEmployee: p.signedByEmployee,
        startDate: new Date(p.startDate),
      },
    });
  }

  // Standalone catalog / demo tables.
  for (const t of trainingCourses) {
    await prisma.trainingCourse.create({
      data: {
        title: t.title,
        category: t.category,
        progress: t.progress,
        mandatory: t.mandatory,
        province: (t.province ?? null) as never,
        due: t.due ? new Date(t.due) : null,
      },
    });
  }
  for (const t of offboardingTasks) {
    await prisma.offboardingTask.create({
      data: {
        label: t.label,
        owner: offboardingOwnerToDb[t.owner] as never,
        status: taskStatusToDb[t.status] as never,
        blocking: t.blocking,
      },
    });
  }
  for (const b of benefitsCarriers) {
    await prisma.benefitsCarrier.create({
      data: {
        name: b.name,
        status: carrierStatusToDb[b.status] as never,
        enrolled: b.enrolled,
        method: carrierMethodToDb[b.method] as never,
        lastSync: b.lastSync,
      },
    });
  }
  for (const a of agentRuns) {
    await prisma.agentRun.create({
      data: {
        intent: a.intent,
        status: agentStatusToDb[a.status] as never,
        progress: a.progress,
        affected: a.affected,
        summary: a.summary,
        time: a.time,
      },
    });
  }
  for (const d of vaultDocuments) {
    await prisma.vaultDocument.create({
      data: {
        name: d.name,
        type: d.type,
        folder: d.folder,
        access: docAccessToDb[d.access] as never,
        uploaded: new Date(d.uploaded),
      },
    });
  }
  for (const s of salaryBenchmarks) {
    await prisma.salaryBenchmark.create({
      data: { role: s.role, low: s.low, high: s.high, current: s.current },
    });
  }

  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyName: "TestHR Inc.",
      provinces: ["ON", "BC", "QC", "SK"],
      integrations: {
        google: true,
        m365: true,
        slack: true,
        sharepoint: true,
        esign: false,
        wagepoint: false,
        payworks: false,
        quickbooks: true,
      },
      recognitionPublic: true,
    },
  });

  return {
    employees: await prisma.employee.count(),
    cases: await prisma.onboardingCase.count(),
    leave: await prisma.leaveRequest.count(),
    requisitions: await prisma.requisition.count(),
    candidates: await prisma.candidate.count(),
    reviews: await prisma.performanceReview.count(),
    pips: await prisma.pip.count(),
    training: await prisma.trainingCourse.count(),
    offboarding: await prisma.offboardingTask.count(),
    carriers: await prisma.benefitsCarrier.count(),
    agents: await prisma.agentRun.count(),
    documents: await prisma.vaultDocument.count(),
    benchmarks: await prisma.salaryBenchmark.count(),
  };
}
