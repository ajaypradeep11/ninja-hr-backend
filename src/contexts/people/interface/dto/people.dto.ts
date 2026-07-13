// src/contexts/people/interface/dto/people.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  EmployeeStatus,
  EmploymentType,
  PayFrequency,
  WorkEligibility,
} from '../../domain/people.types';

const PROVINCES = ['ON', 'BC', 'AB', 'QC', 'SK', 'MB', 'NS', 'NB'];
const STATUSES: EmployeeStatus[] = ['Active', 'Pre-Hire', 'On Statutory Leave', 'Offboarding', 'Terminated'];
const EMPLOYMENT: EmploymentType[] = ['Full-time', 'Part-time', 'Contractor'];
const PAY: PayFrequency[] = ['Weekly', 'Bi-weekly', 'Semi-monthly', 'Monthly'];
const ELIGIBILITY: WorkEligibility[] = ['Citizen', 'Permanent Resident', 'Work Permit', 'Study Permit'];

export class CreateEmployeeDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) title!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) department!: string;
  @ApiProperty({ enum: PROVINCES }) @IsIn(PROVINCES) province!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({ description: 'ISO date (yyyy-mm-dd)' }) @IsDateString() hireDate!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() birthDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) salary?: number;
  @ApiProperty({ required: false, enum: EMPLOYMENT }) @IsOptional() @IsIn(EMPLOYMENT) employmentType?: EmploymentType;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) workLocation?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(80) preferredName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) manager?: string;
}

export class UpdateEmployeeDto {
  /** Employee privacy toggle — hide birthday from team views (self-editable). */
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() birthdayPrivate?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() hireDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() birthDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) department?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) manager?: string;
  @ApiProperty({ enum: STATUSES, required: false }) @IsOptional() @IsIn(STATUSES) status?: EmployeeStatus;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) salary?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(20) employeeNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) preferredName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40) pronouns?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(160) personalEmail?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(160) addressStreet?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(80) addressCity?: string;
  @ApiProperty({ enum: PROVINCES, required: false }) @IsOptional() @IsIn(PROVINCES) addressProvince?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(10) addressPostal?: string;
  @ApiProperty({ enum: EMPLOYMENT, required: false }) @IsOptional() @IsIn(EMPLOYMENT) employmentType?: EmploymentType;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) workLocation?: string;
  @ApiProperty({ enum: PAY, required: false }) @IsOptional() @IsIn(PAY) payFrequency?: PayFrequency;
  @ApiProperty({ enum: ELIGIBILITY, required: false }) @IsOptional() @IsIn(ELIGIBILITY) workEligibility?: WorkEligibility;
  @ApiProperty({ required: false }) @IsOptional() @IsString() workPermitExpiry?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() td1FederalOnFile?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() td1ProvincialOnFile?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(15) sin?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) bankInstitution?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(10) bankTransit?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(20) bankAccount?: string;
}

export class EmergencyContactDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(60) relationship!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(40) phone!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40) altPhone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPrimary?: boolean;
}
