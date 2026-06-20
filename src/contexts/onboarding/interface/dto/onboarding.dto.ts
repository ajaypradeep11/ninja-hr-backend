// src/contexts/onboarding/interface/dto/onboarding.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import type { ProvinceCode } from 'src/shared-kernel/province';
import type { ChecklistTask, TaskStatus } from '../../domain/onboarding.types';

const PROVINCES = ['ON', 'BC', 'AB', 'QC', 'SK', 'MB', 'NS', 'NB'];

export class NewCaseDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() department?: string;
  @ApiProperty({ enum: PROVINCES }) @IsIn(PROVINCES) province!: ProvinceCode;
  @ApiProperty() @IsString() startDate!: string;
  @ApiProperty() @IsEmail() personalEmail!: string;
}

export class PolicyDto {
  @ApiProperty() @IsString() policy!: string;
}

export class TaskStatusDto {
  @ApiProperty({ enum: ['Pending', 'In-Progress', 'Completed'] })
  @IsIn(['Pending', 'In-Progress', 'Completed'])
  status!: TaskStatus;
}

export class ChecklistDto {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsArray()
  tasks!: ChecklistTask[];
}
