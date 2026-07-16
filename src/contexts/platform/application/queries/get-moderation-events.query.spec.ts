import type { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import { PlatformRepository } from '../../infrastructure/platform.repository';
import { GetModerationEventsHandler, GetModerationEventsQuery } from './get-moderation-events.query';

describe('moderation events query', () => {
  it('returns newest-first views', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'm1', userId: 'u1', stage: 'input', category: 'sexual', inputHash: 'hash', createdAt: new Date('2026-07-15T12:00:00Z') }]);
    const repo = new PlatformRepository({ moderationEvent: { findMany } } as unknown as TenantPrismaService);
    expect(await repo.getModerationEvents()).toEqual([{ id: 'm1', userId: 'u1', stage: 'input', category: 'sexual', inputHash: 'hash', createdAt: '2026-07-15T12:00:00.000Z' }]);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' }, take: 200 });
  });

  it('handler delegates the limit', async () => {
    const getModerationEvents = jest.fn().mockResolvedValue([]);
    const handler = new GetModerationEventsHandler({ getModerationEvents } as unknown as PlatformRepository);
    await handler.execute(new GetModerationEventsQuery(25));
    expect(getModerationEvents).toHaveBeenCalledWith(25);
  });
});
