// src/contexts/people/application/commands/emergency-contact.commands.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PeopleRepository } from '../../infrastructure/people.repository';
import type { EmployeeDetail, EmergencyContactInput } from '../../domain/people.types';

export class AddEmergencyContactCommand {
  constructor(public readonly employeeId: string, public readonly input: EmergencyContactInput) {}
}

@CommandHandler(AddEmergencyContactCommand)
export class AddEmergencyContactHandler
  implements ICommandHandler<AddEmergencyContactCommand, EmployeeDetail>
{
  constructor(private readonly repo: PeopleRepository) {}
  execute({ employeeId, input }: AddEmergencyContactCommand): Promise<EmployeeDetail> {
    return this.repo.addEmergencyContact(employeeId, input);
  }
}

export class DeleteEmergencyContactCommand {
  constructor(public readonly employeeId: string, public readonly contactId: string) {}
}

@CommandHandler(DeleteEmergencyContactCommand)
export class DeleteEmergencyContactHandler
  implements ICommandHandler<DeleteEmergencyContactCommand, EmployeeDetail>
{
  constructor(private readonly repo: PeopleRepository) {}
  execute({ employeeId, contactId }: DeleteEmergencyContactCommand): Promise<EmployeeDetail> {
    return this.repo.deleteEmergencyContact(employeeId, contactId);
  }
}
