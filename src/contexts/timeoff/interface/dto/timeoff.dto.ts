// src/contexts/timeoff/interface/dto/timeoff.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';
import type { LeaveStatus, LeaveType } from '../../domain/timeoff.types';

const LEAVE_TYPES: LeaveType[] = [
  'Vacation',
  'Sick Leave',
  'Personal',
  'Parental',
  'Bereavement',
  'Overtime',
];

// Partial-day leave caps at 7h (8h = a full day); overtime can run to 12h.
const MAX_HOURS = 12;

const LEAVE_STATUSES: LeaveStatus[] = ['Approved', 'Denied'];
const ALL_STATUSES: LeaveStatus[] = ['Pending', 'Approved', 'Denied'];

export class SetLeaveStatusDto {
  @ApiProperty({ enum: LEAVE_STATUSES })
  @IsIn(LEAVE_STATUSES)
  status!: 'Approved' | 'Denied';
}

export class CreateLeaveRequestDto {
  @ApiProperty() @IsString() employeeName!: string;

  @ApiProperty({ enum: LEAVE_TYPES })
  @IsIn(LEAVE_TYPES)
  type!: LeaveType;

  @ApiProperty({ description: 'ISO date YYYY-MM-DD' }) @IsDateString() start!: string;

  @ApiProperty({ description: 'ISO date YYYY-MM-DD' }) @IsDateString() end!: string;

  @ApiProperty() @IsInt() @Min(1) days!: number;

  /** Hours: partial-day leave (1–7) or overtime worked (1–12). Omit for full day(s). */
  @ApiProperty({ required: false, minimum: 1, maximum: MAX_HOURS })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_HOURS)
  hours?: number;
}

/** HR absence-record override — every field optional; only what's sent changes. */
export class UpdateLeaveDto {
  @ApiProperty({ enum: LEAVE_TYPES, required: false })
  @IsOptional()
  @IsIn(LEAVE_TYPES)
  type?: LeaveType;

  @ApiProperty({ required: false, description: 'ISO date YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  start?: string;

  @ApiProperty({ required: false, description: 'ISO date YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  end?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(1) days?: number;

  /** 1–12 hours (partial day / overtime), or null to convert back to full day(s). */
  @ApiProperty({ required: false, nullable: true, minimum: 1, maximum: MAX_HOURS })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(MAX_HOURS)
  hours?: number | null;

  @ApiProperty({ enum: ALL_STATUSES, required: false })
  @IsOptional()
  @IsIn(ALL_STATUSES)
  status?: LeaveStatus;
}
