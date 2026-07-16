import type { LlmClassifier, LlmProvider } from '../llm-provider';
import type { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import { GuardedAgentService } from './guarded-agent.service';
import { InputGuard } from './input-guard';
import { hashInput, ModerationLogService } from './moderation-log.service';
import { OutputGuard } from './output-guard';
import { SlidingWindowRateLimiter } from './rate-limiter';
import { RED_TEAM_FIXTURES } from './red-team.fixtures';
import { REFUSALS } from './refusals';

describe('red-team fixtures', () => {
  it.each(RED_TEAM_FIXTURES)('refuses and audits $category', async (fixture) => {
    const classify = jest.fn().mockResolvedValue(JSON.stringify({ category: fixture.category }));
    const complete = jest.fn().mockResolvedValue({ text: 'unsafe generated answer' });
    const created: Array<{ data: Record<string, unknown> }> = [];
    const prisma = {
      moderationEvent: {
        create: jest.fn(async (event: { data: Record<string, unknown> }) => created.push(event)),
      },
    } as unknown as TenantPrismaService;
    const service = new GuardedAgentService(
      { complete, embed: jest.fn(), isLive: () => true } as LlmProvider,
      new InputGuard({ classify } as LlmClassifier, new SlidingWindowRateLimiter()),
      new OutputGuard(),
      new ModerationLogService(prisma),
    );

    const result = await service.ask({
      system: 'HR assistant',
      messages: [{ role: 'user', content: fixture.prompt }],
      persona: 'employee',
      userId: 'u1',
    });

    expect(result.text).toBe(REFUSALS[fixture.category]);
    expect(complete).not.toHaveBeenCalled();
    expect(classify).toHaveBeenCalledTimes(fixture.deterministic ? 0 : 1);
    expect(created[0].data).toMatchObject({
      stage: 'input',
      category: fixture.category,
      inputHash: hashInput(fixture.prompt),
    });
    expect(JSON.stringify(created)).not.toContain(fixture.prompt);
  });
});
