// src/contexts/performance/interface/dto/performance.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class IssuePipDto {
  @ApiProperty() @IsString() employee!: string;
  @ApiProperty() @IsString() manager!: string;
  @ApiProperty() @IsInt() @Min(1) durationDays!: number;
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
