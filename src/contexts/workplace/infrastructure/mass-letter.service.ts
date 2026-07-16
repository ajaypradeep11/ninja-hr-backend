import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ActorContext } from 'src/platform/auth/actor-context';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import { renderLetterTemplate } from '../domain/letter-merge';
import type { LetterMergeEmployee, MassLetterInput, MassLetterPayload, MassLetterResult } from '../domain/workplace.types';
import { LetterDraftService } from './letter-draft.service';

const SELECT = { id: true, name: true, title: true, department: true, province: true, hireDate: true, salary: true, manager: true, employeeNumber: true } as const;

export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

@Injectable()
export class MassLetterService {
  constructor(private readonly prisma: TenantPrismaService, private readonly drafts: LetterDraftService) {}

  async queue(input: MassLetterInput, actor: ActorContext): Promise<MassLetterResult> {
    const supplied = input.cohort as MassLetterInput['cohort'] & { value?: string; employeeIds?: string[] };
    if ((supplied.type === 'all' && (supplied.value !== undefined || supplied.employeeIds !== undefined)) ||
        (supplied.type === 'manual' && supplied.value !== undefined) ||
        ((supplied.type === 'department' || supplied.type === 'province') && supplied.employeeIds !== undefined)) {
      throw new BadRequestException('Invalid fields for the selected cohort type');
    }
    if ((input.cohort.type === 'department' || input.cohort.type === 'province') && !input.cohort.value.trim()) {
      throw new BadRequestException('A cohort value is required');
    }
    if (input.cohort.type === 'manual' && !input.cohort.employeeIds.length) {
      throw new BadRequestException('Select at least one employee');
    }
    const template = await this.prisma.letterTemplate.findUnique({ where: { id: input.templateId }, select: { id: true, name: true, body: true } });
    if (!template) throw new NotFoundException('Letter template not found');
    const where: Record<string, unknown> = { status: { not: 'TERMINATED' } };
    if (input.cohort.type === 'department') where.department = input.cohort.value;
    if (input.cohort.type === 'province') where.province = input.cohort.value;
    if (input.cohort.type === 'manual') where.id = { in: [...new Set(input.cohort.employeeIds)] };
    const employees = await this.prisma.employee.findMany({ where, select: SELECT, orderBy: { name: 'asc' } });
    if (!employees.length) throw new BadRequestException('The selected cohort is empty');
    if (employees.length > 500) throw new BadRequestException('Mass letters are limited to 500 employees');
    if (input.personalizeWithAi && employees.length > 100) throw new BadRequestException('AI personalization is limited to 100 employees');
    const company = actor.companyId ? await this.prisma.company.findUnique({ where: { id: actor.companyId }, select: { name: true } }) : null;
    if (!company) throw new NotFoundException('Company not found');

    const items = await mapWithConcurrency(employees, input.personalizeWithAi ? 3 : employees.length, async (employee) => {
      const deterministic = renderLetterTemplate(template.body, employee as unknown as LetterMergeEmployee, company.name, new Date());
      const payload: MassLetterPayload = {
        employeeName: employee.name,
        documentName: `${template.name} — ${employee.name}.txt`, body: deterministic,
        mode: input.mode, aiPersonalized: false,
      };
      if (!input.personalizeWithAi) return { employeeId: employee.id, payload, status: 'Pending' };
      try {
        const draft = await this.drafts.draft({ employeeId: employee.id, templateId: template.id, instructions: input.instructions ?? '' }, actor);
        if (draft.blockedCategory) return { employeeId: employee.id, payload: { ...payload, error: 'Personalization was blocked by safety controls.' }, status: 'Failed' };
        return { employeeId: employee.id, payload: { ...payload, body: draft.text, aiPersonalized: draft.live }, status: 'Pending' };
      } catch {
        return { employeeId: employee.id, payload: { ...payload, error: 'Personalization could not be generated.' }, status: 'Failed' };
      }
    });
    const failed = items.filter((item) => item.status === 'Failed').length;
    const run = await this.prisma.agentRun.create({
      data: {
        intent: `Mass letter: ${template.name} → ${items.length} employees`, status: 'AWAITING_APPROVAL',
        progress: 100, affected: items.length,
        summary: `${items.length - failed} ready for approval${failed ? `; ${failed} failed to generate` : ''}`,
        time: 'just now', items: { create: items.map((item) => ({ ...item, payload: item.payload as never })) },
      }, select: { id: true },
    });
    return { runId: run.id, affected: items.length };
  }
}
