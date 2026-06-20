// src/contexts/performance/interface/dto/performance.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class IssuePipDto {
  @ApiProperty() @IsString() employee!: string;
  @ApiProperty() @IsString() manager!: string;
  @ApiProperty() @IsInt() @Min(1) durationDays!: number;
}
