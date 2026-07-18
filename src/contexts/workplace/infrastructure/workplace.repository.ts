// src/contexts/workplace/infrastructure/workplace.repository.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type {
  VaultDocument,
  TrainingCourse,
  TrainingAssignment,
  TrainingStatus,
  CreateCourseInput,
  TrainingCourseMaterial,
  AssignTrainingInput,
  PeerCourseInput,
  LetterTemplate,
  LetterTemplateInput,
  IssueLetterInput,
  UploadVaultDocumentInput,
  VaultDocumentFile,
} from '../domain/workplace.types';
import {
  docAccessToDb,
  rowToVaultDocument,
  rowToTrainingCourse,
  rowToTrainingAssignment,
  rowToLetterTemplate,
  trainingStatusToDb,
  courseStatusToDb,
} from './workplace.mapper';
import { BadRequestException, ConflictException } from '@nestjs/common';

const ASSIGNMENT_INCLUDE = { course: true, employee: true } as const;

@Injectable()
export class WorkplaceRepository {
  constructor(private readonly prisma: TenantPrismaService) {}

  async getVaultDocuments(actor?: ActorContext): Promise<VaultDocument[]> {
    // HR sees the whole vault. Everyone else must NOT see another employee's
    // personal documents (e.g. HR letters filed with access:EMPLOYEE +
    // employeeId) or documents above their clearance. Scope at the DB level.
    const isHr = actor?.role === 'HR_ADMIN';
    const clearance: ('EMPLOYEE' | 'MANAGER')[] =
      actor?.role === 'MANAGER' ? ['EMPLOYEE', 'MANAGER'] : ['EMPLOYEE'];
    const where = isHr
      ? {}
      : {
          access: { in: clearance },
          // Company-wide docs (no owner) or the caller's own personal docs only.
          OR: [{ employeeId: null }, ...(actor?.employeeId ? [{ employeeId: actor.employeeId }] : [])],
        };
    const rows = await this.prisma.vaultDocument.findMany({
      where,
      orderBy: { uploaded: 'desc' },
      omit: { data: true }, // never drag file binaries into list reads
    });
    return rows.map(rowToVaultDocument);
  }

  /** Removes a vault document (HR curation of an employee's file cabinet). */
  async removeVaultDocument(id: string): Promise<void> {
    const res = await this.prisma.vaultDocument.deleteMany({ where: { id } });
    if (res.count === 0) throw new NotFoundException('Document not found');
  }

  /** Manual vault upload (Documents dropzone). Metadata row only — see
   *  UploadVaultDocumentInput for why no bytes are stored. */
  async addVaultDocument(input: UploadVaultDocumentInput): Promise<VaultDocument> {
    const emp = input.employeeName
      ? await this.prisma.employee.findFirst({ where: { name: input.employeeName } })
      : null;
    if (input.employeeName && !emp) throw new NotFoundException('Employee not found');
    const file = input.dataBase64 ? Buffer.from(input.dataBase64, 'base64') : null;
    const created = await this.prisma.vaultDocument.create({
      data: {
        name: input.name,
        type: input.type,
        folder: input.folder,
        access: docAccessToDb[input.access] as never,
        uploaded: new Date(),
        ...(emp ? { employeeId: emp.id } : {}),
        ...(file && input.mimeType ? { data: file, mimeType: input.mimeType, size: file.byteLength } : {}),
      },
      omit: { data: true },
    });
    return rowToVaultDocument(created);
  }

  /** The stored file for streaming — HR, or the employee who owns the document. */
  async getVaultDocumentFile(id: string, actor?: { role?: string; employeeId?: string | null }): Promise<VaultDocumentFile> {
    const row = await this.prisma.vaultDocument.findUnique({ where: { id } });
    if (!row || !row.data || !row.mimeType) throw new NotFoundException('No file stored for this document');
    if (actor?.role !== 'HR_ADMIN' && row.employeeId !== actor?.employeeId) {
      throw new NotFoundException('No file stored for this document'); // don't leak existence
    }
    return { name: row.name, mimeType: row.mimeType, data: Buffer.from(row.data) };
  }

  /* ---------------------- Letter Lab (HR letters) -------------------- */

  async getLetterTemplates(): Promise<LetterTemplate[]> {
    const rows = await this.prisma.letterTemplate.findMany({ orderBy: { name: 'asc' } });
    return rows.map(rowToLetterTemplate);
  }

  async createLetterTemplate(input: LetterTemplateInput): Promise<LetterTemplate[]> {
    await this.prisma.letterTemplate.create({ data: input });
    return this.getLetterTemplates();
  }

  async updateLetterTemplate(
    id: string,
    input: Partial<LetterTemplateInput>,
  ): Promise<LetterTemplate[]> {
    await this.prisma.letterTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
      },
    });
    return this.getLetterTemplates();
  }

  async deleteLetterTemplate(id: string): Promise<LetterTemplate[]> {
    await this.prisma.letterTemplate.delete({ where: { id } });
    return this.getLetterTemplates();
  }

  /** File a generated letter into the employee's vault (Documents tab).
   *  `signature` mode marks it as awaiting e-signature. */
  async issueLetter(input: IssueLetterInput, actor?: ActorContext): Promise<VaultDocument> {
    const emp = await this.prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!emp || (actor?.role === 'MANAGER' && emp.managerId !== actor.employeeId)) {
      throw new NotFoundException('Employee not found');
    }
    const content = input.content === undefined ? undefined : Buffer.from(input.content, 'utf8');
    const created = await this.prisma.vaultDocument.create({
      data: {
        name: input.name,
        type: input.mode === 'signature' ? 'Letter — Awaiting Signature' : 'Letter',
        folder: '05_HR_Letters',
        access: 'EMPLOYEE',
        uploaded: new Date(),
        employeeId: emp.id,
        ...(content ? { data: content, mimeType: 'text/plain', size: content.byteLength } : {}),
      },
      omit: { data: true },
    });
    return rowToVaultDocument(created);
  }

  /* ------------------------- Training catalog ------------------------ */

  async getTrainingCourses(): Promise<TrainingCourse[]> {
    const rows = await this.prisma.trainingCourse.findMany({
      orderBy: { title: 'asc' },
      omit: { materialData: true }, // never drag file binaries into list reads
      include: {
        _count: { select: { assignments: true } },
        assignments: { select: { status: true } },
        createdBy: { select: { name: true } },
      },
    });
    return rows.map(rowToTrainingCourse);
  }

  /** The stored material file for streaming (PDF/slides). Company scoping is
   *  enforced by the tenant Prisma extension; missing/absent → 404. */
  async getTrainingCourseMaterial(id: string): Promise<TrainingCourseMaterial> {
    const row = await this.prisma.trainingCourse.findUnique({ where: { id } });
    if (!row || !row.materialData || !row.materialMimeType) {
      throw new NotFoundException('No material file for this course');
    }
    return {
      fileName: row.materialFileName ?? 'course-material',
      mimeType: row.materialMimeType,
      data: Buffer.from(row.materialData),
    };
  }

  /* ---------------------- Peer-created courses ----------------------- */

  /** The actor's own courses (any status) with peer-completion engagement. */
  async getMyCourses(actor: ActorContext): Promise<TrainingCourse[]> {
    if (!actor.employeeId) return [];
    const rows = await this.prisma.trainingCourse.findMany({
      where: { createdById: actor.employeeId },
      orderBy: { createdAt: 'desc' },
      omit: { materialData: true }, // never drag file binaries into list reads
      include: {
        _count: { select: { assignments: true } },
        assignments: { select: { status: true } },
        createdBy: { select: { name: true } },
      },
    });
    return rows.map(rowToTrainingCourse);
  }

  /** Any employee can start a course — it's born a private Draft. */
  async createPeerCourse(input: PeerCourseInput, actor: ActorContext): Promise<TrainingCourse[]> {
    if (!actor.employeeId) throw new ForbiddenException('No employee identity');
    await this.prisma.trainingCourse.create({
      data: {
        title: input.title,
        category: input.category,
        description: input.description ?? null,
        contentUrl: input.contentUrl ?? null,
        durationMins: input.durationMins ?? null,
        status: 'DRAFT',
        active: true,
        createdById: actor.employeeId,
      },
    });
    return this.getMyCourses(actor);
  }

  /**
   * Owner edits their own course while it isn't Published; `submit` moves a
   * Draft/Rejected course into HR's approval queue.
   */
  async updatePeerCourse(
    id: string,
    input: Partial<PeerCourseInput> & { submit?: boolean },
    actor: ActorContext,
  ): Promise<TrainingCourse[]> {
    const row = await this.prisma.trainingCourse.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Course not found');
    if (row.createdById !== actor.employeeId) {
      throw new ForbiddenException('You can only edit courses you created');
    }
    if (row.status === 'PUBLISHED') {
      throw new ConflictException('Published courses are managed by HR — ask them for changes');
    }
    await this.prisma.trainingCourse.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.contentUrl !== undefined ? { contentUrl: input.contentUrl || null } : {}),
        ...(input.durationMins !== undefined ? { durationMins: input.durationMins ?? null } : {}),
        // Re-submitting a Rejected course sends it back for another review.
        ...(input.submit ? { status: 'PENDING_APPROVAL' as const } : {}),
      },
    });
    return this.getMyCourses(actor);
  }

  /** Owner deletes their own unpublished course; HR can remove anything. */
  async deletePeerCourse(id: string, actor: ActorContext): Promise<TrainingCourse[]> {
    const row = await this.prisma.trainingCourse.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Course not found');
    if (actor.role !== 'HR_ADMIN') {
      if (row.createdById !== actor.employeeId) {
        throw new ForbiddenException('You can only delete courses you created');
      }
      if (row.status === 'PUBLISHED') {
        throw new ConflictException('Published courses are managed by HR — ask them to retire it');
      }
    }
    await this.prisma.trainingCourse.delete({ where: { id } });
    return this.getMyCourses(actor);
  }

  async createCourse(input: CreateCourseInput): Promise<TrainingCourse[]> {
    const material =
      input.materialDataBase64 && input.materialMimeType
        ? Buffer.from(input.materialDataBase64, 'base64')
        : null;
    await this.prisma.trainingCourse.create({
      data: {
        title: input.title,
        category: input.category,
        description: input.description ?? null,
        contentUrl: input.contentUrl ?? null,
        durationMins: input.durationMins ?? null,
        passMark: input.passMark ?? null,
        ...(material && input.materialMimeType
          ? {
              materialData: material,
              materialMimeType: input.materialMimeType,
              materialFileName: input.materialFileName ?? 'course-material',
              materialSize: material.byteLength,
            }
          : {}),
      },
      omit: { materialData: true },
    });
    return this.getTrainingCourses();
  }

  async updateCourse(
    id: string,
    input: Partial<CreateCourseInput> & { active?: boolean; status?: TrainingCourse['status'] },
  ): Promise<TrainingCourse[]> {
    await this.prisma.trainingCourse.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.contentUrl !== undefined ? { contentUrl: input.contentUrl || null } : {}),
        ...(input.durationMins !== undefined ? { durationMins: input.durationMins } : {}),
        ...(input.passMark !== undefined ? { passMark: input.passMark } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        // HR moderation of peer submissions: approve (Published) or Reject.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(input.status !== undefined ? { status: courseStatusToDb[input.status] as any } : {}),
      },
    });
    return this.getTrainingCourses();
  }

  async deleteCourse(id: string): Promise<TrainingCourse[]> {
    await this.prisma.trainingCourse.delete({ where: { id } });
    return this.getTrainingCourses();
  }

  /* ------------------------- Assignments ----------------------------- */

  /** HR assigns a course to one or more employees (idempotent per employee). */
  async assignTraining(input: AssignTrainingInput): Promise<TrainingAssignment[]> {
    const course = await this.prisma.trainingCourse.findUnique({ where: { id: input.courseId } });
    if (!course) throw new NotFoundException('Course not found');
    if (course.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published courses can be assigned — approve it first');
    }
    const due = input.dueDate ? new Date(input.dueDate) : null;
    for (const employeeId of input.employeeIds) {
      await this.prisma.trainingAssignment.upsert({
        where: { courseId_employeeId: { courseId: input.courseId, employeeId } },
        update: { dueDate: due },
        create: { courseId: input.courseId, employeeId, dueDate: due },
      });
    }
    return this.getCourseAssignments(input.courseId);
  }

  async getCourseAssignments(courseId: string): Promise<TrainingAssignment[]> {
    const rows = await this.prisma.trainingAssignment.findMany({
      where: { courseId },
      include: ASSIGNMENT_INCLUDE,
      orderBy: { assignedAt: 'desc' },
    });
    return rows.map(rowToTrainingAssignment);
  }

  /** All assignments — for the compliance Tracker (HR). */
  async getAllAssignments(): Promise<TrainingAssignment[]> {
    const rows = await this.prisma.trainingAssignment.findMany({
      include: ASSIGNMENT_INCLUDE,
      orderBy: { assignedAt: 'desc' },
    });
    return rows.map(rowToTrainingAssignment);
  }

  /** The actor's own assigned training. */
  async getMyTraining(actor: ActorContext): Promise<TrainingAssignment[]> {
    if (!actor.employeeId) return [];
    const rows = await this.prisma.trainingAssignment.findMany({
      where: { employeeId: actor.employeeId },
      include: ASSIGNMENT_INCLUDE,
      orderBy: { assignedAt: 'desc' },
    });
    return rows.map(rowToTrainingAssignment);
  }

  /** Update assignment progress/status. Employees own their own; HR any. */
  async updateAssignment(
    id: string,
    input: { status?: TrainingStatus; progress?: number },
    actor: ActorContext,
  ): Promise<TrainingAssignment> {
    const row = await this.prisma.trainingAssignment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Assignment not found');
    if (actor.role !== 'HR_ADMIN' && row.employeeId !== actor.employeeId) {
      throw new ForbiddenException('You can only update your own training');
    }
    const status = input.status;
    const completed = status === 'Completed';
    await this.prisma.trainingAssignment.update({
      where: { id },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(status ? { status: trainingStatusToDb[status] as any } : {}),
        ...(input.progress !== undefined ? { progress: input.progress } : {}),
        ...(completed ? { progress: 100, completedAt: new Date() } : {}),
        ...(status === 'In-Progress' ? { completedAt: null } : {}),
      },
    });
    const updated = await this.prisma.trainingAssignment.findUniqueOrThrow({
      where: { id },
      include: ASSIGNMENT_INCLUDE,
    });
    return rowToTrainingAssignment(updated);
  }
}
