import type { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import { hashInput, ModerationLogService } from './moderation-log.service';

describe('ModerationLogService', () => {
  it('stores only a truncated hash', async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new ModerationLogService({ moderationEvent: { create } } as unknown as TenantPrismaService);
    await service.record({ userId: 'u1', stage: 'input', category: 'sexual', input: 'secret raw input' });
    expect(hashInput('hello')).toBe('2cf24dba5fb0a30e');
    expect(create).toHaveBeenCalledWith({
      data: { userId: 'u1', stage: 'input', category: 'sexual', inputHash: hashInput('secret raw input') },
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain('secret raw input');
  });

  it('swallows persistence errors', async () => {
    const prisma = { moderationEvent: { create: jest.fn().mockRejectedValue(new Error('down')) } };
    const service = new ModerationLogService(prisma as unknown as TenantPrismaService);
    await expect(service.record({ userId: null, stage: 'output', category: 'pii_leak', input: 'x' })).resolves.toBeUndefined();
  });
});
