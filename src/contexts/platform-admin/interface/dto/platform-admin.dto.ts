import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCompanyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  // The admin console also derives a slug client-side for its optimistic row,
  // but the server ignores it and slugifies `name` itself — the slug is a
  // uniqueness-bearing key and must not be caller-controlled.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;
}

export class ListLogsDto {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
