// src/contexts/platform/application/calc.handlers.ts
// Custom Calculator Engine: CRUD for IF/THEN calculation rules
// (timesheets/payroll, leave accruals, custom bonuses).
import { CommandHandler, ICommandHandler, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { CalcRuleInput } from '../domain/platform.types';
import { PlatformRepository } from '../infrastructure/platform.repository';

export class GetCalcRulesQuery {}

@QueryHandler(GetCalcRulesQuery)
export class GetCalcRulesHandler implements IQueryHandler<GetCalcRulesQuery> {
  constructor(private readonly repo: PlatformRepository) {}
  execute() {
    return this.repo.getCalcRules();
  }
}

export class CreateCalcRuleCommand {
  constructor(public readonly input: CalcRuleInput) {}
}

@CommandHandler(CreateCalcRuleCommand)
export class CreateCalcRuleHandler implements ICommandHandler<CreateCalcRuleCommand> {
  constructor(private readonly repo: PlatformRepository) {}
  execute(c: CreateCalcRuleCommand) {
    return this.repo.createCalcRule(c.input);
  }
}

export class UpdateCalcRuleCommand {
  constructor(
    public readonly id: string,
    public readonly input: Partial<CalcRuleInput>,
  ) {}
}

@CommandHandler(UpdateCalcRuleCommand)
export class UpdateCalcRuleHandler implements ICommandHandler<UpdateCalcRuleCommand> {
  constructor(private readonly repo: PlatformRepository) {}
  execute(c: UpdateCalcRuleCommand) {
    return this.repo.updateCalcRule(c.id, c.input);
  }
}

export class DeleteCalcRuleCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(DeleteCalcRuleCommand)
export class DeleteCalcRuleHandler implements ICommandHandler<DeleteCalcRuleCommand> {
  constructor(private readonly repo: PlatformRepository) {}
  execute(c: DeleteCalcRuleCommand) {
    return this.repo.deleteCalcRule(c.id);
  }
}
