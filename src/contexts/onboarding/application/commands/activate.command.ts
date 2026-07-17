// src/contexts/onboarding/application/commands/activate.command.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { activationGates } from '../../domain/onboarding-status';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class ActivateCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(ActivateCommand)
export class ActivateHandler implements ICommandHandler<ActivateCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ id }: ActivateCommand): Promise<OnboardingCase | null> {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundException(`Onboarding case ${id} not found`);
    if (c.status === 'Active') {
      // Idempotent replay — but self-heal cases activated before activation
      // provisioned employees: create the missing record/vault copies now.
      const healed = await this.repo.provisionEmployee(id);
      if (healed?.created) {
        await this.repo.addAudit(id, 'Employee record created — now listed in the employee directory');
        await this.repo.publishVerifiedDocsToVault(id);
        return this.repo.findById(id);
      }
      // …and self-heal an ACTIVE case whose hire is somehow still PRE_HIRE
      // (accepted the invite, then a failed activation left them out of the
      // directory). Promoting is the whole point of activation.
      if (healed && (await this.repo.activateEmployee(healed.employeeId))) {
        await this.repo.addAudit(id, 'Employee record activated — now listed in the employee directory');
        return this.repo.findById(id);
      }
      return c;
    }
    const failed = activationGates(c).filter((g) => !g.ok);
    if (failed.length > 0) {
      throw new ConflictException(
        `Cannot activate: ${failed.map((g) => g.label).join('; ')}`,
      );
    }
    await this.repo.setStatus(id, 'Active');
    await this.repo.addAudit(id, 'Account activated — payroll set to Active, SSO provisioned');
    // Activation IS the hire: the record usually already exists at PRE_HIRE
    // (created when the hire accepted their invite), so this promotes them into
    // the directory; provisioning covers the hire who never accepted — then
    // file their verified paperwork.
    const provisioned = await this.repo.provisionEmployee(id);
    if (provisioned?.created) {
      await this.repo.addAudit(id, 'Employee record created — now listed in the employee directory');
    } else if (provisioned && (await this.repo.activateEmployee(provisioned.employeeId))) {
      await this.repo.addAudit(id, 'Employee record activated — now listed in the employee directory');
    }
    const published = await this.repo.publishVerifiedDocsToVault(id);
    if (published > 0) {
      await this.repo.addAudit(id, `${published} verified document(s) filed to the employee's vault`);
    }
    return this.repo.findById(id);
  }
}
