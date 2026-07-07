// src/contexts/people/interface/people.controller.ts
import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ActorCtx, type ActorContext } from 'src/platform/auth/actor-context';
import { GetEmployeesQuery } from '../application/queries/get-employees.query';
import { GetEmployeeByNameQuery } from '../application/queries/get-employee-by-name.query';
import { GetEmployeeDetailQuery } from '../application/queries/get-employee-detail.query';
import { GetHeadcountQuery } from '../application/queries/get-headcount.query';
import { GetSalaryBenchmarksQuery } from '../application/queries/get-salary-benchmarks.query';
import { UpdateEmployeeCommand } from '../application/commands/update-employee.command';
import {
  AddEmergencyContactCommand,
  DeleteEmergencyContactCommand,
} from '../application/commands/emergency-contact.commands';
import { EmergencyContactDto, UpdateEmployeeDto } from './dto/people.dto';

/** Fields an employee may change on their OWN record (My Profile self-service).
 *  Everything else — compensation, SIN, banking, eligibility, employment — is HR-only. */
const SELF_EDITABLE = new Set([
  'preferredName',
  'pronouns',
  'personalEmail',
  'phone',
  'addressStreet',
  'addressCity',
  'addressPostal',
]);

function assertSelfOrHr(actor: ActorContext, employeeId: string): void {
  if (actor.role === 'HR_ADMIN') return;
  if (actor.employeeId === employeeId) return;
  throw new ForbiddenException('You can only access your own HRIS record');
}

@ApiTags('people')
@Controller('people')
export class PeopleController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  @Get('employees')
  getEmployees() {
    return this.queries.execute(new GetEmployeesQuery());
  }

  @Get('employees/by-name/:name')
  getEmployeeByName(@Param('name') name: string) {
    return this.queries.execute(new GetEmployeeByNameQuery(name));
  }

  @Get('headcount')
  getHeadcount() {
    return this.queries.execute(new GetHeadcountQuery());
  }

  @Get('salary-benchmarks')
  getSalaryBenchmarks() {
    return this.queries.execute(new GetSalaryBenchmarksQuery());
  }

  /* --------------------- HRIS record (HR, or your own) -------------------- */

  /** Full HRIS record. SIN + bank account come back masked; raw never leaves.
   *  HR sees anyone; an employee sees their OWN record (My Profile). */
  @Get('employees/:id')
  getEmployeeDetail(@Param('id') id: string, @ActorCtx() actor: ActorContext) {
    assertSelfOrHr(actor, id);
    return this.queries.execute(new GetEmployeeDetailQuery(id));
  }

  /** HR edits anything; an employee may self-serve contact/address fields only. */
  @Patch('employees/:id')
  updateEmployee(
    @Param('id') id: string,
    @Body() body: UpdateEmployeeDto,
    @ActorCtx() actor: ActorContext,
  ) {
    assertSelfOrHr(actor, id);
    if (actor.role !== 'HR_ADMIN') {
      const blocked = Object.keys(body).filter(
        (k) => body[k as keyof UpdateEmployeeDto] !== undefined && !SELF_EDITABLE.has(k),
      );
      if (blocked.length) {
        throw new ForbiddenException(
          `These fields can only be changed by HR: ${blocked.join(', ')}. ` +
            'Use "Update banking info" to notify HR of banking or SIN changes.',
        );
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.commands.execute(new UpdateEmployeeCommand(id, body as any));
  }

  @Post('employees/:id/emergency-contacts')
  addEmergencyContact(
    @Param('id') id: string,
    @Body() body: EmergencyContactDto,
    @ActorCtx() actor: ActorContext,
  ) {
    assertSelfOrHr(actor, id);
    return this.commands.execute(new AddEmergencyContactCommand(id, body));
  }

  @Delete('employees/:id/emergency-contacts/:contactId')
  deleteEmergencyContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @ActorCtx() actor: ActorContext,
  ) {
    assertSelfOrHr(actor, id);
    return this.commands.execute(new DeleteEmergencyContactCommand(id, contactId));
  }
}
