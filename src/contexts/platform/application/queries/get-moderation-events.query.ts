import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { ModerationEventView } from '../../domain/platform.types';
import { PlatformRepository } from '../../infrastructure/platform.repository';

export class GetModerationEventsQuery {
  constructor(public readonly limit?: number) {}
}

@QueryHandler(GetModerationEventsQuery)
export class GetModerationEventsHandler
  implements IQueryHandler<GetModerationEventsQuery, ModerationEventView[]>
{
  constructor(private readonly repo: PlatformRepository) {}

  execute({ limit }: GetModerationEventsQuery): Promise<ModerationEventView[]> {
    return this.repo.getModerationEvents(limit);
  }
}
