// src/contexts/offboarding/application/commands/finalize-termination.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  OffboardingRepository,
  type FinalizeTerminationInput,
} from '../../infrastructure/offboarding.repository';

export class FinalizeTerminationCommand {
  constructor(public readonly input: FinalizeTerminationInput) {}
}

@CommandHandler(FinalizeTerminationCommand)
export class FinalizeTerminationHandler
  implements ICommandHandler<FinalizeTerminationCommand, void>
{
  constructor(private readonly repo: OffboardingRepository) {}

  execute({ input }: FinalizeTerminationCommand): Promise<void> {
    return this.repo.finalizeTermination(input);
  }
}
