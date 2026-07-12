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

const TERMINATION_TYPES = ['Voluntary', 'Involuntary'] as const;

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

  /** Explicit admin override of the statutory-leave termination lock. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  statutoryOverride?: boolean;

  /** Human Rights Code certification acknowledgement — required with statutoryOverride. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  hrCertified?: boolean;

  @ApiProperty({ required: false, enum: TERMINATION_TYPES })
  @IsOptional()
  @IsIn(TERMINATION_TYPES as unknown as string[])
  terminationType?: 'Voluntary' | 'Involuntary';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  rehireEligible?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class SaveOffboardingDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  employeeName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  template?: string;
}
