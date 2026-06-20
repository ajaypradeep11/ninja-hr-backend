// src/contexts/recruitment/interface/dto/recruitment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Min } from 'class-validator';
import type { CandidateStage } from '../../domain/recruitment.types';

const CANDIDATE_STAGES: CandidateStage[] = [
  'Applied',
  'AI Screened',
  'Interview',
  'Offer',
  'Hired',
  'Rejected',
];

export class PublishRequisitionDto {
  @ApiProperty() @IsString() title!: string;
  @ApiProperty() @IsString() department!: string;
  @ApiProperty() @IsString() province!: string;
  @ApiProperty() @IsInt() @Min(0) salaryMin!: number;
  @ApiProperty() @IsInt() @Min(0) salaryMax!: number;
}

export class SetCandidateStageDto {
  @ApiProperty({ enum: CANDIDATE_STAGES })
  @IsIn(CANDIDATE_STAGES)
  stage!: CandidateStage;
}
