// src/contexts/onboarding/interface/dto/onboarding.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches,
  MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import type { ProvinceCode } from 'src/shared-kernel/province';
import type { DataAccess, TaskOwner, TaskStatus, WorkEligibilityLabel } from '../../domain/onboarding.types';

const PROVINCES = ['ON', 'BC', 'AB', 'QC', 'SK', 'MB', 'NS', 'NB'];
const OWNERS: TaskOwner[] = ['HR', 'Finance', 'IT / Ops', 'Manager'];
const TASK_STATUSES: TaskStatus[] = ['Pending', 'In-Progress', 'Completed'];
const DATA_ACCESS: DataAccess[] = ['general', 'banking', 'medical'];

export class NewCaseDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() department?: string;
  @ApiProperty({ enum: PROVINCES }) @IsIn(PROVINCES) province!: ProvinceCode;
  @ApiProperty({ description: 'ISO date YYYY-MM-DD' }) @IsDateString() startDate!: string;
  @ApiProperty() @IsEmail() personalEmail!: string;
}

export class PolicyDto {
  @ApiProperty() @IsString() policy!: string;
}

/**
 * Invite acceptance credential — exactly one of these (enforced in the
 * handler): `password` when the hire chooses one, `idToken` when they signed in
 * with Google and the backend must verify who they are before linking.
 */
export class AcceptInviteDto {
  @ApiProperty({ required: false, minLength: 8 })
  @IsOptional() @IsString() @MinLength(8)
  password?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @IsNotEmpty()
  idToken?: string;
}

export class TaskStatusDto {
  @ApiProperty({ enum: TASK_STATUSES })
  @IsIn(TASK_STATUSES)
  status!: TaskStatus;
}

export class ChecklistTaskDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() id?: string;
  @ApiProperty() @IsString() label!: string;
  @ApiProperty({ enum: OWNERS }) @IsIn(OWNERS) owner!: TaskOwner;
  @ApiProperty({ enum: TASK_STATUSES }) @IsIn(TASK_STATUSES) status!: TaskStatus;
  @ApiProperty() @IsBoolean() blocking!: boolean;
  @ApiProperty({ enum: DATA_ACCESS }) @IsIn(DATA_ACCESS) dataAccess!: DataAccess;
}

export class ChecklistDto {
  @ApiProperty({ type: [ChecklistTaskDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistTaskDto)
  tasks!: ChecklistTaskDto[];
}

const WORK_ELIGIBILITY: WorkEligibilityLabel[] = ['Citizen', 'Permanent Resident', 'Work Permit', 'Study Permit'];

/**
 * Standard new-hire form (Ontario) — everything HR needs on file before day
 * one. SIN + banking are validated here, stored on the case, and masked on
 * every read by the onboarding mapper.
 */
export class NewHireProfileDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) legalFirstName!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) legalLastName!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100) preferredName?: string;
  @ApiProperty({ description: 'ISO date YYYY-MM-DD' }) @IsDateString() dateOfBirth!: string;
  /** Keep my birthday private — hidden from team calendars and dashboards. */
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() birthdayPrivate?: boolean;

  @ApiProperty({ description: '9 digits, no spaces' })
  @Matches(/^\d{9}$/, { message: 'SIN must be exactly 9 digits (no spaces or dashes)' })
  sin!: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(30) phone!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) addressStreet!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) addressCity!: string;
  @ApiProperty({ description: 'Canadian postal code' })
  @Matches(/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/, { message: 'Postal code must look like A1A 1A1' })
  addressPostal!: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) emergencyName!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(60) emergencyRelationship!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(30) emergencyPhone!: string;

  @ApiProperty({ enum: WORK_ELIGIBILITY }) @IsIn(WORK_ELIGIBILITY) workEligibility!: WorkEligibilityLabel;
  @ApiProperty({ required: false, description: 'Required for permit holders' })
  @IsOptional()
  @IsDateString()
  workPermitExpiry?: string;

  @ApiProperty({ description: '3-digit institution number' })
  @Matches(/^\d{3}$/, { message: 'Institution number is 3 digits' })
  bankInstitution!: string;
  @ApiProperty({ description: '5-digit transit number' })
  @Matches(/^\d{5}$/, { message: 'Transit number is 5 digits' })
  bankTransit!: string;
  @ApiProperty({ description: '7-12 digit account number' })
  @Matches(/^\d{7,12}$/, { message: 'Account number is 7-12 digits' })
  bankAccount!: string;

  /** Must match the legal name to avoid payroll delays. */
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) bankAccountHolder!: string;
}

const UPLOAD_KIND_KEYS = ['td1-federal', 'td1-ontario', 'benefits-enrollment', 'manual-acknowledgment'];

export class UploadCaseDocumentDto {
  @ApiProperty({ enum: UPLOAD_KIND_KEYS })
  @IsIn(UPLOAD_KIND_KEYS)
  kind!: 'td1-federal' | 'td1-ontario' | 'benefits-enrollment' | 'manual-acknowledgment';

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) fileName!: string;

  @ApiProperty({ enum: ['application/pdf', 'image/png', 'image/jpeg'] })
  @IsIn(['application/pdf', 'image/png', 'image/jpeg'])
  mimeType!: string;

  /** Base64 file body — ~8 MB binary ≈ 11 M chars. */
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(11_500_000) dataBase64!: string;
}

/** Why the document was rejected — shown to the employee and audited. */
export class RejectDocumentDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) note!: string;
}

export class SetTaskAssigneeDto {
  @ApiProperty({ enum: OWNERS })
  @IsIn(OWNERS)
  owner!: TaskOwner;

  /** Employee full name, or null to unassign. */
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  employeeName!: string | null;
}
