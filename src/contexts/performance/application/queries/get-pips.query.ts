// src/contexts/performance/application/queries/get-pips.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PerformanceRepository } from '../../infrastructure/performance.repository';
import type { Pip } from '../../domain/performance.types';

export class GetPipsQuery {}

@QueryHandler(GetPipsQuery)
export class GetPipsHandler implements IQueryHandler<GetPipsQuery, Pip[]> {
  constructor(private readonly repo: PerformanceRepository) {}

  execute(): Promise<Pip[]> {
    return this.repo.getPips();
  }
}
