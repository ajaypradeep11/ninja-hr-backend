// src/contexts/offboarding/interface/dto/offboarding.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import type { OffboardingStatus } from '../../domain/offboarding.types';

const VALID_STATUSES: OffboardingStatus[] = ['Pending', 'In-Progress', 'Completed'];

export class SetTaskStatusDto {
  @ApiProperty({ enum: VALID_STATUSES })
  @IsIn(VALID_STATUSES)
  status!: OffboardingStatus;
}

export class FinalizeTerminationDto {
  @ApiProperty()
  @IsString()
  employeeName!: string;
}
