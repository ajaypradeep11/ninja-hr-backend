// src/contexts/people/application/commands/create-employee.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PeopleRepository } from '../../infrastructure/people.repository';
import type { CreateEmployeeInput, EmployeeDetail } from '../../domain/people.types';

export class CreateEmployeeCommand {
  constructor(public readonly input: CreateEmployeeInput) {}
}

@CommandHandler(CreateEmployeeCommand)
export class CreateEmployeeHandler implements ICommandHandler<CreateEmployeeCommand, EmployeeDetail> {
  constructor(private readonly repo: PeopleRepository) {}
  execute({ input }: CreateEmployeeCommand): Promise<EmployeeDetail> {
    return this.repo.createEmployee(input);
  }
}
