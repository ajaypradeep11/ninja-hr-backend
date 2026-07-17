import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { ActorContext } from 'src/platform/auth/actor-context';
import { GuardedAgentService } from 'src/platform/ai/guardrails/guarded-agent.service';
import { renderToolRun, ToolInputError } from '../../domain/prompt-renderer';
import { canRunTool } from '../../domain/tool-access';
import { findToolBySlug } from '../../domain/tool-catalog';
import { ToolLibraryRepository } from '../../infrastructure/tool-library.repository';

export class RunToolCommand {
  constructor(
    public readonly slug: string,
    public readonly inputs: Record<string, string>,
    public readonly actor: ActorContext,
  ) {}
}

export interface ToolRunResult {
  slug: string;
  text: string;
  /** false = deterministic fallback (no LLM key configured). */
  live: boolean;
  /** Set when a guardrail refused the run. */
  blockedCategory: string | null;
}

@CommandHandler(RunToolCommand)
export class RunToolHandler implements ICommandHandler<RunToolCommand> {
  constructor(
    private readonly repo: ToolLibraryRepository,
    private readonly agent: GuardedAgentService,
  ) {}

  async execute(command: RunToolCommand): Promise<ToolRunResult> {
    const { slug, inputs, actor } = command;

    // The code catalog carries the typed prompt/input schema; the DB row
    // carries the id that per-tenant settings and grants hang off.
    const definition = findToolBySlug(slug);
    const row = await this.repo.getToolBySlug(slug);
    if (!definition || !row) throw new NotFoundException(`Unknown tool "${slug}".`);
    if (definition.kind !== 'PROMPT') {
      throw new BadRequestException(`"${definition.name}" opens inside the app and cannot be run here.`);
    }

    const settings = await this.repo.getCompanySettings();
    const enabled = settings.get(row.id) ?? true;
    const granted =
      actor.role !== 'HR_ADMIN' && actor.userId ? await this.repo.hasGrant(row.id, actor.userId) : false;
    if (!canRunTool(actor.role, enabled, granted)) {
      throw new ForbiddenException(
        enabled
          ? 'You do not have access to this tool. Ask your HR admin to grant it to you.'
          : 'This tool is disabled for your company.',
      );
    }

    let rendered;
    try {
      rendered = renderToolRun(definition, inputs);
    } catch (err) {
      if (err instanceof ToolInputError) throw new BadRequestException(err.message);
      throw err;
    }

    const result = await this.agent.ask({
      system: rendered.system,
      messages: [{ role: 'user', content: rendered.userMessage }],
      persona: actor.role === 'HR_ADMIN' ? 'admin' : 'employee',
      userId: actor.userId,
      maxTokens: 3000,
    });

    if (!result.live && result.text === '') {
      return {
        slug,
        text: [
          `**${definition.name}** ran in offline mode — no AI provider key is configured.`,
          '',
          'Your inputs were validated and are ready to process. Once an `ANTHROPIC_API_KEY` (or Gemini key) is set on the backend, this tool will produce a full result.',
        ].join('\n'),
        live: false,
        blockedCategory: null,
      };
    }

    return {
      slug,
      text: result.text,
      live: result.live,
      blockedCategory: result.verdict.allowed ? null : (result.verdict.category ?? null),
    };
  }
}
