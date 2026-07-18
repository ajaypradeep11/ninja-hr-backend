// src/contexts/workplace/domain/workplace.types.ts

export type DocAccess = 'Employee' | 'Manager' | 'HR Admin' | 'Super Admin';

export interface VaultDocument {
  id: string;
  name: string;
  folder: string;
  type: string;
  uploaded: string; // ISO-10 date YYYY-MM-DD
  access: DocAccess;
  /** True when the row carries a stored file (streams via /documents/:id/file). */
  hasFile: boolean;
  size?: number | null;
}

export interface VaultDocumentFile {
  name: string;
  mimeType: string;
  data: Buffer;
}

/** Manual vault upload (Documents module dropzone). Metadata only — the
 *  VaultDocument row carries no file bytes; binaries live on preboarding
 *  CaseDocuments, which stream through their own endpoint. */
export interface UploadVaultDocumentInput {
  name: string;
  type: string;
  folder: string;
  access: DocAccess;
  /** Optional owner — links the document to an employee's personal vault. */
  employeeName?: string;
  /** Optional stored file — base64 payload + its MIME type (both or neither). */
  mimeType?: string;
  dataBase64?: string;
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
  /** True when the course carries an uploaded material file (streams via
   *  /training-courses/:id/material). Bytes never ride the list read. */
  hasMaterial?: boolean;
  /** True when a cover image is stored (streams via :id/cover). */
  hasCover?: boolean;
  materialFileName?: string;
}

/** The stored course material for streaming (PDF/slides). */
export interface TrainingCourseMaterial {
  fileName: string;
  mimeType: string;
  data: Buffer;
}

/** The stored course cover image for streaming. */
export interface TrainingCourseCover {
  mimeType: string;
  data: Buffer;
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
  /** Optional uploaded material — base64 payload + its MIME type and original
   *  file name (all three together, or none). */
  materialFileName?: string;
  materialMimeType?: string;
  materialDataBase64?: string;
  /** Optional cover image — base64 payload + its image MIME type (both or none). */
  coverImageMimeType?: string;
  coverImageDataBase64?: string;
}

export interface AssignTrainingInput {
  courseId: string;
  employeeIds: string[];
  dueDate?: string;
}

/* ----------------------- Letter Lab (HR letters) -------------------- */

/** HR document template with {{variable}} placeholders. */
export interface LetterTemplate {
  id: string;
  name: string;
  category: string;
  body: string;
  updatedAt: string; // ISO datetime
}

export interface LetterTemplateInput {
  name: string;
  category: string;
  body: string;
}

/** File a generated letter into the employee's document vault. */
export interface IssueLetterInput {
  employeeId: string;
  name: string;
  mode: 'save' | 'signature';
  content?: string;
}

export type LetterKind =
  | 'cover'
  | 'employment_verification'
  | 'promotion'
  | 'probation'
  | 'custom';

export interface LetterMergeEmployee {
  id: string;
  name: string;
  title: string;
  department: string;
  province: string;
  hireDate: Date;
  salary: number;
  manager: string | null;
  employeeNumber: string | null;
}

export interface DraftLetterInput {
  employeeId: string;
  instructions: string;
  kind?: LetterKind;
  templateId?: string;
}

export interface DraftLetterResult {
  text: string;
  live: boolean;
  blockedCategory?: string;
}

export type MassCohort =
  | { type: 'all' }
  | { type: 'department'; value: string }
  | { type: 'province'; value: string }
  | { type: 'manual'; employeeIds: string[] };

export interface MassLetterInput {
  templateId: string;
  cohort: MassCohort;
  mode: 'save' | 'signature';
  personalizeWithAi?: boolean;
  instructions?: string;
}

export interface MassLetterPayload {
  employeeName: string;
  documentName: string;
  body: string;
  mode: 'save' | 'signature';
  aiPersonalized: boolean;
  error?: string;
  vaultDocumentId?: string;
}

export interface MassLetterResult {
  runId: string;
  affected: number;
}
