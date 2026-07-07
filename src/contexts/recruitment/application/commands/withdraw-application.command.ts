// src/contexts/recruitment/application/commands/withdraw-application.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { PortalView } from '../../domain/recruitment.types';

export class WithdrawApplicationCommand {
  constructor(public readonly token: string) {}
}

@CommandHandler(WithdrawApplicationCommand)
export class WithdrawApplicationHandler
  implements ICommandHandler<WithdrawApplicationCommand, PortalView>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ token }: WithdrawApplicationCommand): Promise<PortalView> {
    return this.repo.withdrawByToken(token);
  }
}
