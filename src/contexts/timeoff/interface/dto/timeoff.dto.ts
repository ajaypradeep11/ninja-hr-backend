// src/contexts/timeoff/interface/dto/timeoff.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Min } from 'class-validator';
import type { LeaveStatus, LeaveType } from '../../domain/timeoff.types';

const LEAVE_TYPES: LeaveType[] = [
  'Vacation',
  'Sick Leave',
  'Personal',
  'Parental',
  'Bereavement',
];

const LEAVE_STATUSES: LeaveStatus[] = ['Approved', 'Denied'];

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

  @ApiProperty({ description: 'ISO date YYYY-MM-DD' }) @IsString() start!: string;

  @ApiProperty({ description: 'ISO date YYYY-MM-DD' }) @IsString() end!: string;

  @ApiProperty() @IsInt() @Min(1) days!: number;
}
