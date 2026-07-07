// src/contexts/workplace/domain/workplace.types.ts

export type DocAccess = 'Employee' | 'Manager' | 'HR Admin' | 'Super Admin';

export interface VaultDocument {
  id: string;
  name: string;
  folder: string;
  type: string;
  uploaded: string; // ISO-10 date YYYY-MM-DD
  access: DocAccess;
}

export type TrainingStatus = 'Assigned' | 'In-Progress' | 'Completed';

export type CourseStatus = 'Draft' | 'Pending HR Approval' | 'Published' | 'Rejected';

/** Training course — HR catalog entries are born Published; peer-created
 *  courses flow Draft → Pending HR Approval → Published/Rejected. */
export interface TrainingCourse {
  id: string;
  title: string;
  category: string;
  description?: string;
  contentUrl?: string;
  durationMins?: number;
  passMark?: number;
  active: boolean;
  status: CourseStatus;
  createdById?: string;
  creatorName?: string;
  assignedCount?: number;
  completedCount?: number;
}

/** What an employee may set on their own peer-created course. */
export interface PeerCourseInput {
  title: string;
  category: string;
  description?: string;
  contentUrl?: string;
  durationMins?: number;
}

export interface TrainingAssignment {
  id: string;
  courseId: string;
  courseTitle: string;
  courseCategory: string;
  contentUrl?: string;
  employeeId: string;
  employeeName: string;
  status: TrainingStatus;
  progress: number;
  assignedAt: string;
  dueDate?: string;
  completedAt?: string;
}

export interface CreateCourseInput {
  title: string;
  category: string;
  description?: string;
  contentUrl?: string;
  durationMins?: number;
  passMark?: number;
}

export interface AssignTrainingInput {
  courseId: string;
  employeeIds: string[];
  dueDate?: string;
}
