// src/contexts/platform/interface/dto/platform.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsArray, IsString, IsIn, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { AgentStatus } from '../../domain/platform.types';

const AGENT_STATUSES: AgentStatus[] = ['Running', 'Awaiting Approval', 'Completed'];

export class IntegrationsDto {
  @ApiProperty() @IsBoolean() google!: boolean;
  @ApiProperty() @IsBoolean() m365!: boolean;
  @ApiProperty() @IsBoolean() slack!: boolean;
  @ApiProperty() @IsBoolean() sharepoint!: boolean;
  @ApiProperty() @IsBoolean() esign!: boolean;
  @ApiProperty() @IsBoolean() wagepoint!: boolean;
  @ApiProperty() @IsBoolean() payworks!: boolean;
  @ApiProperty() @IsBoolean() quickbooks!: boolean;
}

export class SaveSettingsDto {
  @ApiProperty() @IsString() companyName!: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) provinces!: string[];
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
  @ApiProperty() @IsString() question!: string;
}
