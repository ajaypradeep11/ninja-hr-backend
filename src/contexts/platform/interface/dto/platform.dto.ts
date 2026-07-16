// src/contexts/platform/interface/dto/platform.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsIn, IsObject, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { AgentStatus } from '../../domain/platform.types';

const AGENT_STATUSES: AgentStatus[] = ['Running', 'Awaiting Approval', 'Completed'];
const PROVINCES = ['ON', 'BC', 'AB', 'QC', 'SK', 'MB', 'NS', 'NB'];

export class IntegrationsDto {
  @ApiProperty() @IsBoolean() google!: boolean;
  @ApiProperty() @IsBoolean() m365!: boolean;
  @ApiProperty() @IsBoolean() slack!: boolean;
  @ApiProperty() @IsBoolean() sharepoint!: boolean;
  @ApiProperty() @IsBoolean() esign!: boolean;
  @ApiProperty() @IsBoolean() quickbooks!: boolean;
}

const REVIEW_CADENCES = ['Annual', 'Bi-Annual', 'Quarterly'];

export class SaveSettingsDto {
  @ApiProperty() @IsString() companyName!: string;
  @ApiProperty({ type: [String], enum: PROVINCES }) @IsArray() @IsIn(PROVINCES, { each: true }) provinces!: string[];
  @ApiProperty({ type: IntegrationsDto }) @IsObject() @ValidateNested() @Type(() => IntegrationsDto) integrations!: IntegrationsDto;
  @ApiProperty() @IsBoolean() recognitionPublic!: boolean;

  /** Recurring review cadence (Cadence Configuration). Optional so existing
   *  callers that omit it keep the previously saved value. */
  @ApiProperty({ required: false, enum: REVIEW_CADENCES })
  @IsOptional()
  @IsIn(REVIEW_CADENCES)
  reviewCadence?: 'Annual' | 'Bi-Annual' | 'Quarterly';

  /** Admin-managed department options (onboarding preboard form). Optional so
   *  existing callers that omit it keep the previously saved list. */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(60, { each: true })
  departments?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsString({ each: true })
  jobTitles?: string[];
}

export class CreateAgentRunDto {
  @ApiProperty() @IsString() intent!: string;
}

export class SetAgentRunStatusDto {
  @ApiProperty({ enum: AGENT_STATUSES })
  @IsIn(AGENT_STATUSES)
  status!: AgentStatus;
}

export class AskCopilotDto {
  @ApiProperty({ maxLength: 2000 }) @IsString() @IsNotEmpty() @MaxLength(2000) question!: string;
}

export class SendChatMessageDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;
}

/* -------------------- Custom Calculator Engine --------------------- */

const CALC_CATEGORIES = ['Timesheet', 'Accrual', 'Bonus'] as const;
const CALC_OPERATORS = ['>', '>=', '<', '<=', '='] as const;

export class CalcRuleDto {
  @ApiProperty({ enum: CALC_CATEGORIES })
  @IsIn(CALC_CATEGORIES as unknown as string[])
  category!: 'Timesheet' | 'Accrual' | 'Bonus';

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) field!: string;

  @ApiProperty({ enum: CALC_OPERATORS })
  @IsIn(CALC_OPERATORS as unknown as string[])
  operator!: '>' | '>=' | '<' | '<=' | '=';

  @ApiProperty() @IsNumber() @Min(0) @Max(1000000) threshold!: number;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) action!: string;

  @ApiProperty() @IsNumber() @Min(0) @Max(1000000) value!: number;

  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateCalcRuleDto {
  @ApiProperty({ enum: CALC_CATEGORIES, required: false })
  @IsOptional()
  @IsIn(CALC_CATEGORIES as unknown as string[])
  category?: 'Timesheet' | 'Accrual' | 'Bonus';

  @ApiProperty({ required: false }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) field?: string;

  @ApiProperty({ enum: CALC_OPERATORS, required: false })
  @IsOptional()
  @IsIn(CALC_OPERATORS as unknown as string[])
  operator?: '>' | '>=' | '<' | '<=' | '=';

  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(1000000) threshold?: number;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) action?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(1000000) value?: number;

  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() active?: boolean;
}

/* ---------------------- Policy handbook (RAG) ---------------------- */

const POLICY_SOURCE_TYPES = ['pdf', 'text'] as const;

export class UploadPolicyDocumentDto {
  @ApiProperty({ maxLength: 200 }) @IsString() @IsNotEmpty() @MaxLength(200) title!: string;

  @ApiProperty({ enum: POLICY_SOURCE_TYPES })
  @IsIn(POLICY_SOURCE_TYPES as unknown as string[])
  sourceType!: 'pdf' | 'text';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(6_000_000)
  base64?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  text?: string;
}

export class ListModerationEventsDto {
  @ApiProperty({ required: false, minimum: 1, maximum: 500, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
