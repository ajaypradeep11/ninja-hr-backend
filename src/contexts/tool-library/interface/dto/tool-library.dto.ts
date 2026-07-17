import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class ListToolsDto {
  @ApiProperty({ required: false, description: 'Filter to tools surfaced in a module (e.g. recruitment).' })
  @IsOptional()
  @IsString()
  surface?: string;
}

export class RunToolDto {
  @ApiProperty({
    description: 'Tool input values keyed by the tool’s input field keys.',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsObject()
  @Transform(({ value }: { value: unknown }) => {
    // Coerce every submitted value to string; field-level validation (unknown
    // keys, required, length caps) happens in the domain renderer.
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'string' ? v : String(v ?? '')]),
    );
  })
  inputs!: Record<string, string>;
}

export class SetToolEnabledDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class SetToolGrantsDto {
  @ApiProperty({ type: [String], description: 'Full replacement list of user ids granted this tool.' })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  userIds!: string[];
}
