// src/contexts/people/application/commands/update-employee.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PeopleRepository } from '../../infrastructure/people.repository';
import type { EmployeeDetail, UpdateEmployeeInput } from '../../domain/people.types';

export class UpdateEmployeeCommand {
  constructor(public readonly id: string, public readonly input: UpdateEmployeeInput) {}
}

@CommandHandler(UpdateEmployeeCommand)
export class UpdateEmployeeHandler
  implements ICommandHandler<UpdateEmployeeCommand, EmployeeDetail>
{
  constructor(private readonly repo: PeopleRepository) {}
  execute({ id, input }: UpdateEmployeeCommand): Promise<EmployeeDetail> {
    return this.repo.updateEmployee(id, input);
  }
}
