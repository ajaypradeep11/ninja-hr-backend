// src/contexts/performance/interface/dto/performance.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class IssuePipDto {
  @ApiProperty() @IsString() employee!: string;
  @ApiProperty() @IsString() manager!: string;
  @ApiProperty() @IsInt() @Min(1) durationDays!: number;
}

/** Start a performance review for an employee (begins in Draft). */
export class CreateReviewDto {
  @ApiProperty() @IsString() @IsNotEmpty() employeeId!: string;
  @ApiProperty({ description: 'e.g. "2026 Annual", "Q3 2026"' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  cycle!: string;
  @ApiProperty({ description: 'ISO date YYYY-MM-DD' }) @IsDateString() due!: string;
}

/** The employee's self-assessment submission. */
export class SubmitSelfEvaluationDto {
  @ApiProperty({ maxLength: 5000 }) @IsString() @IsNotEmpty() @MaxLength(5000) text!: string;
}

/** The assigned manager's evaluation + proposed rating. */
export class SubmitManagerEvaluationDto {
  @ApiProperty({ maxLength: 5000 }) @IsString() @IsNotEmpty() @MaxLength(5000) text!: string;
  @ApiProperty({ required: false, minimum: 0, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  score?: number;
}

/** Fill in review content — every field optional; only what's sent changes. */
export class UpdateReviewDto {
  @ApiProperty({ required: false, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  selfEvaluation?: string;

  @ApiProperty({ required: false, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  managerEvaluation?: string;

  @ApiProperty({ required: false, minimum: 0, maximum: 5, description: 'Overall rating 0–5' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  score?: number;
}

/* ---------------- Continuous performance (growth) ---------------- */

export class GoalProgressDto {
  @ApiProperty() @IsInt() @Min(0) @Max(100) progress!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

/** Goal re-weighting request, guarded by the 15% constructive-dismissal rule. */
export class GoalWeightChangeDto {
  @ApiProperty() @IsNumber() @Min(0) @Max(100) previousWeight!: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(100) proposedWeight!: number;
}

export class TalkingPointDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) text!: string;
}

export class ActionItemDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) text!: string;
}

export class ToggleActionItemDto {
  @ApiProperty() @IsIn([true, false]) done!: boolean;
}

export class FeedbackRequestDto {
  @ApiProperty() @IsString() @IsNotEmpty() colleagueId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) topic!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) message?: string;
}

export class FeedbackResponseDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(4000) response!: string;
}

export class KudosDto {
  @ApiProperty() @IsString() @IsNotEmpty() toEmployeeId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) message!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(16) emoji?: string;
}
