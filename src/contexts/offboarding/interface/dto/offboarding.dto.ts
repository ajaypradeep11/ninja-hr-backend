// src/contexts/offboarding/interface/dto/offboarding.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { OffboardingOwner, OffboardingStatus } from '../../domain/offboarding.types';

const VALID_STATUSES: OffboardingStatus[] = ['Pending', 'In-Progress', 'Completed'];
const VALID_OWNERS: OffboardingOwner[] = ['Manager', 'IT / Ops', 'HR / Payroll'];

export class SetTaskStatusDto {
  @ApiProperty({ enum: VALID_STATUSES })
  @IsIn(VALID_STATUSES)
  status!: OffboardingStatus;
}

export class SetOffboardingAssigneeDto {
  @ApiProperty({ enum: VALID_OWNERS })
  @IsIn(VALID_OWNERS)
  owner!: OffboardingOwner;

  /** Internal employee name, or null/empty to clear the delegation. */
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignee?: string | null;
}

export class FinalizeTerminationDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  employeeName!: string;

  /** Super-admin override: bypass the blocking-task gate (audited client-side). */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  override?: boolean;
}
