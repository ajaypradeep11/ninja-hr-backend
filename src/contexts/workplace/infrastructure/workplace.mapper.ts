// src/contexts/workplace/infrastructure/workplace.mapper.ts
import type {
  CourseStatus,
  DocAccess,
  VaultDocument,
  TrainingCourse,
  TrainingAssignment,
  TrainingStatus,
} from '../domain/workplace.types';

function invert<K extends string, V extends string>(m: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, K>;
}

/* Document access */
export const docAccessToDb = {
  Employee: 'EMPLOYEE',
  Manager: 'MANAGER',
  'HR Admin': 'HR_ADMIN',
  'Super Admin': 'SUPER_ADMIN',
} satisfies Record<DocAccess, string>;

export const docAccessFromDb = invert(docAccessToDb);

const iso = (d: Date): string => d.toISOString().slice(0, 10);

/* Row mappers */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToVaultDocument(row: any): VaultDocument {
  return {
    id: row.id,
    name: row.name,
    folder: row.folder,
    type: row.type,
    uploaded: iso(row.uploaded),
    access: docAccessFromDb[row.access as keyof typeof docAccessFromDb],
  };
}

export const trainingStatusToDb = {
  Assigned: 'ASSIGNED',
  'In-Progress': 'IN_PROGRESS',
  Completed: 'COMPLETED',
} satisfies Record<TrainingStatus, string>;
export const trainingStatusFromDb = invert(trainingStatusToDb);

export const courseStatusToDb = {
  Draft: 'DRAFT',
  'Pending HR Approval': 'PENDING_APPROVAL',
  Published: 'PUBLISHED',
  Rejected: 'REJECTED',
} satisfies Record<CourseStatus, string>;
export const courseStatusFromDb = invert(courseStatusToDb);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToTrainingCourse(row: any): TrainingCourse {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description ?? undefined,
    contentUrl: row.contentUrl ?? undefined,
    durationMins: row.durationMins ?? undefined,
    passMark: row.passMark ?? undefined,
    active: row.active,
    status: courseStatusFromDb[row.status as keyof typeof courseStatusFromDb] ?? 'Published',
    createdById: row.createdById ?? undefined,
    creatorName: row.createdBy?.name ?? undefined,
    assignedCount: row._count?.assignments,
    completedCount: row.assignments
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        row.assignments.filter((a: any) => a.status === 'COMPLETED').length
      : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToTrainingAssignment(row: any): TrainingAssignment {
  return {
    id: row.id,
    courseId: row.courseId,
    courseTitle: row.course.title,
    courseCategory: row.course.category,
    contentUrl: row.course.contentUrl ?? undefined,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    status: trainingStatusFromDb[row.status as keyof typeof trainingStatusFromDb],
    progress: row.progress,
    assignedAt: iso(row.assignedAt),
    dueDate: row.dueDate ? iso(row.dueDate) : undefined,
    completedAt: row.completedAt ? iso(row.completedAt) : undefined,
  };
}
