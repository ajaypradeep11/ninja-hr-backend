// src/contexts/workplace/application/queries/get-benefits-carriers.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WorkplaceRepository } from '../../infrastructure/workplace.repository';
import type { BenefitsCarrier } from '../../domain/workplace.types';

export class GetBenefitsCarriersQuery {}

@QueryHandler(GetBenefitsCarriersQuery)
export class GetBenefitsCarriersHandler implements IQueryHandler<GetBenefitsCarriersQuery, BenefitsCarrier[]> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute(): Promise<BenefitsCarrier[]> {
    return this.repo.getBenefitsCarriers();
  }
}
