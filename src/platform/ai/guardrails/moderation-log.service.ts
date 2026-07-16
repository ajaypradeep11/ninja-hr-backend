import { createHash } from 'node:crypto';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';

export type ModerationStage = 'input' | 'provider' | 'output';

export interface ModerationRecord {
  userId: string | null;
  stage: ModerationStage;
  category: string;
  input: string;
}

export function hashInput(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

@Injectable()
export class ModerationLogService {
  private readonly logger = new Logger(ModerationLogService.name);

  constructor(@Optional() private readonly prisma?: TenantPrismaService) {}

  async record(event: ModerationRecord): Promise<void> {
    try {
      if (!this.prisma) {
        this.logger.warn('moderation event write skipped: tenant database unavailable');
        return;
      }
      await this.prisma.moderationEvent.create({
        // The tenant extension injects companyId at runtime; Prisma's generated
        // base-client type cannot express that transformation.
        data: {
          // The current schema requires a user id; persona-fallback requests
          // use a stable sentinel so their moderation events remain auditable.
          userId: event.userId ?? 'anonymous',
          stage: event.stage,
          category: event.category,
          inputHash: hashInput(event.input),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });
    } catch (err) {
      this.logger.warn(
        `moderation event write failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
