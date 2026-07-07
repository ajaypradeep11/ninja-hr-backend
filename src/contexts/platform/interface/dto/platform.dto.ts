// src/contexts/platform/interface/dto/platform.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsArray, IsNotEmpty, IsString, IsIn, IsObject, MaxLength, ValidateNested } from 'class-validator';
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

export class SaveSettingsDto {
  @ApiProperty() @IsString() companyName!: string;
  @ApiProperty({ type: [String], enum: PROVINCES }) @IsArray() @IsIn(PROVINCES, { each: true }) provinces!: string[];
  @ApiProperty({ type: IntegrationsDto }) @IsObject() @ValidateNested() @Type(() => IntegrationsDto) integrations!: IntegrationsDto;
  @ApiProperty() @IsBoolean() recognitionPublic!: boolean;
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
