// src/contexts/offboarding/application/commands/finalize-termination.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OffboardingRepository } from '../../infrastructure/offboarding.repository';

export class FinalizeTerminationCommand {
  constructor(public readonly employeeName: string) {}
}

@CommandHandler(FinalizeTerminationCommand)
export class FinalizeTerminationHandler
  implements ICommandHandler<FinalizeTerminationCommand, void>
{
  constructor(private readonly repo: OffboardingRepository) {}

  execute({ employeeName }: FinalizeTerminationCommand): Promise<void> {
    return this.repo.finalizeTermination(employeeName);
  }
}
