// src/contexts/platform/application/queries/get-settings.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PlatformRepository } from '../../infrastructure/platform.repository';
import type { CompanySettings } from '../../domain/platform.types';

export class GetSettingsQuery {}

@QueryHandler(GetSettingsQuery)
export class GetSettingsHandler implements IQueryHandler<GetSettingsQuery, CompanySettings> {
  constructor(private readonly repo: PlatformRepository) {}
  execute(): Promise<CompanySettings> {
    return this.repo.getSettings();
  }
}
