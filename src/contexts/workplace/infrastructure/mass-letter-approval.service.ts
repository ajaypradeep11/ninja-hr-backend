import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import { TenantContext } from 'src/platform/database/tenant-context';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import type { MassLetterPayload } from '../domain/workplace.types';

function payload(value: unknown): MassLetterPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Partial<MassLetterPayload>;
  if (typeof p.employeeName !== 'string' || typeof p.documentName !== 'string' ||
      typeof p.body !== 'string' || (p.mode !== 'save' && p.mode !== 'signature')) return null;
  return { employeeName: p.employeeName, documentName: p.documentName, body: p.body,
    mode: p.mode, aiPersonalized: p.aiPersonalized === true,
    ...(typeof p.error === 'string' ? { error: p.error } : {}),
    ...(typeof p.vaultDocumentId === 'string' ? { vaultDocumentId: p.vaultDocumentId } : {}) };
}

@Injectable()
export class MassLetterApprovalService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly raw: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  async tryApprove(id: string): Promise<true | null> {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new Error('Tenant context required for mass-letter approval');
    const run = await this.raw.agentRun.findFirst({ where: { id, companyId }, include: { items: { orderBy: { id: 'asc' } } } });
    if (!run) throw new NotFoundException('Agent run not found');
    if (!run.items.length) return null;
    if (run.status === 'COMPLETED') return true;
    if (run.status !== 'AWAITING_APPROVAL') throw new ConflictException('Agent run is already being processed');
    const claim = await this.prisma.agentRun.updateMany({ where: { id, status: 'AWAITING_APPROVAL' }, data: { status: 'RUNNING' } });
    if (!claim.count) throw new ConflictException('Agent run is already being processed');

    let issued = run.items.filter((item) => item.status === 'Issued').length;
    let failed = run.items.filter((item) => item.status === 'Failed').length;
    for (const item of run.items) {
      if (item.status !== 'Pending') continue;
      const parsed = payload(item.payload);
      if (!parsed) {
        failed++;
        await this.markFailed(id, item.id, item.payload, 'Invalid letter payload.');
        continue;
      }
      try {
        await this.raw.$transaction(async (tx) => {
          const current = await tx.agentRunItem.findUnique({ where: { id: item.id }, include: { run: { select: { companyId: true } } } });
          if (!current || current.status !== 'Pending' || current.run.companyId !== companyId) throw new Error('Letter item is unavailable');
          const employee = await tx.employee.findFirst({ where: { id: current.employeeId, companyId }, select: { id: true, companyId: true } });
          if (!employee || employee.companyId !== companyId) throw new Error('Employee is unavailable');
          const data = Buffer.from(parsed.body, 'utf8');
          const document = await tx.vaultDocument.create({ data: {
            companyId, employeeId: employee.id, name: parsed.documentName,
            type: parsed.mode === 'signature' ? 'Letter — Awaiting Signature' : 'Letter',
            folder: '05_HR_Letters', access: 'EMPLOYEE', uploaded: new Date(),
            data, mimeType: 'text/plain', size: data.byteLength,
          } });
          await tx.agentRunItem.update({ where: { id: current.id }, data: {
            status: 'Issued', payload: { ...parsed, vaultDocumentId: document.id } as never,
          } });
        });
        issued++;
      } catch {
        failed++;
        await this.markFailed(id, item.id, parsed, 'Letter could not be filed.');
      }
    }
    await this.prisma.agentRun.update({ where: { id }, data: {
      status: 'COMPLETED', progress: 100, affected: issued,
      summary: `${issued} issued; ${failed} failed`,
    } });
    return true;
  }

  private async markFailed(runId: string, itemId: string, original: unknown, error: string) {
    const parsed = payload(original);
    const safe = parsed ?? { employeeName: 'Unknown employee', documentName: 'Letter.txt', body: '', mode: 'save' as const, aiPersonalized: false };
    await this.prisma.agentRun.update({ where: { id: runId }, data: {
      items: { update: { where: { id: itemId }, data: { status: 'Failed', payload: { ...safe, error } as never } } },
    } });
  }
}
