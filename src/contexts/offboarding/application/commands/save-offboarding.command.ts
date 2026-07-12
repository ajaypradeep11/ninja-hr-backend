// src/contexts/offboarding/application/commands/save-offboarding.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OffboardingRepository } from '../../infrastructure/offboarding.repository';

/** Persist an initiated offboarding case (employee → OFFBOARDING status). */
export class SaveOffboardingCommand {
  constructor(
    public readonly employeeName: string,
    public readonly template?: string,
  ) {}
}

@CommandHandler(SaveOffboardingCommand)
export class SaveOffboardingHandler implements ICommandHandler<SaveOffboardingCommand, void> {
  constructor(private readonly repo: OffboardingRepository) {}

  execute({ employeeName, template }: SaveOffboardingCommand): Promise<void> {
    return this.repo.saveOffboarding(employeeName, template);
  }
}
