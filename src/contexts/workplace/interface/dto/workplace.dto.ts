// src/contexts/workplace/interface/dto/workplace.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ArrayMaxSize, ValidateNested, ValidateIf } from 'class-validator';
import type { CourseStatus, DocAccess, LetterKind, TrainingStatus } from '../../domain/workplace.types';

const MODERATION_STATUSES: CourseStatus[] = ['Published', 'Rejected'];

/** The vault's canonical folder tree — uploads must route into one of these. */
const VAULT_FOLDERS = [
  '01_Recruitment',
  '02_Onboarding_and_Tax',
  '03_Compliance_and_Training',
  '04_Performance_and_PIPs',
  '05_Leaves_and_Medical',
  '06_Offboarding',
] as const;

const DOC_ACCESS: DocAccess[] = ['Employee', 'Manager', 'HR Admin', 'Super Admin'];

export class UploadVaultDocumentDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) type!: string;
  @ApiProperty({ enum: VAULT_FOLDERS }) @IsIn(VAULT_FOLDERS as unknown as string[]) folder!: string;
  @ApiProperty({ enum: DOC_ACCESS }) @IsIn(DOC_ACCESS) access!: DocAccess;
  /** Optional owner — links the document to an employee's personal vault. */
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) employeeName?: string;

  @ApiProperty({ required: false, enum: ['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] })
  @IsOptional()
  @IsIn(['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
  mimeType?: string;

  /** Base64 payload, ~8 MB file ceiling (mirrors the preboarding upload cap). */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(11_500_000)
  dataBase64?: string;
}

/** Accepted uploaded-material MIME types (PDF, images, Word, PowerPoint). */
const COURSE_MATERIAL_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

const COURSE_COVER_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;

export class CreateCourseDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(160) title!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) category!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) contentUrl?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(1) @Max(100000) durationMins?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) @Max(100) passMark?: number;

  /** Optional uploaded course material — original file name. */
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) materialFileName?: string;

  @ApiProperty({ required: false, enum: COURSE_MATERIAL_MIME })
  @IsOptional()
  @IsIn(COURSE_MATERIAL_MIME as unknown as string[])
  materialMimeType?: string;

  /** Base64 payload, ~8 MB file ceiling (mirrors the vault upload cap). */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(11_500_000)
  materialDataBase64?: string;

  @ApiProperty({ required: false, enum: COURSE_COVER_MIME })
  @IsOptional()
  @IsIn(COURSE_COVER_MIME as unknown as string[])
  coverImageMimeType?: string;

  /** Base64 cover image, ~3 MB ceiling (catalog-card art, not a document). */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(4_200_000)
  coverImageDataBase64?: string;
}

export class UpdateCourseDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(160) title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) category?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) contentUrl?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(1) @Max(100000) durationMins?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) @Max(100) passMark?: number;
  /** HR moderation of peer submissions: approve (Published) or Reject. */
  @ApiProperty({ enum: MODERATION_STATUSES, required: false })
  @IsOptional()
  @IsIn(MODERATION_STATUSES)
  status?: CourseStatus;
}

export class PeerCourseDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(160) title!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) category!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) contentUrl?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(1) @Max(100000) durationMins?: number;
}

export class UpdatePeerCourseDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(160) title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) category?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) contentUrl?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(1) @Max(100000) durationMins?: number;
  /** True = send this Draft/Rejected course to HR for approval. */
  @ApiProperty({ required: false }) @IsOptional() @IsIn([true, false]) submit?: boolean;
}

export class LetterTemplateDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(60) category!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(20000) body!: string;
}

export class UpdateLetterTemplateDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60) category?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(20000) body?: string;
}

const LETTER_MODES = ['save', 'signature'] as const;

export class IssueLetterDto {
  @ApiProperty() @IsString() @IsNotEmpty() employeeId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @ApiProperty({ enum: LETTER_MODES }) @IsIn(LETTER_MODES as unknown as string[]) mode!:
    | 'save'
    | 'signature';
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(50000) content?: string;
}

const LETTER_KINDS: LetterKind[] = ['cover', 'employment_verification', 'promotion', 'probation', 'custom'];
export class DraftLetterDto {
  @ApiProperty() @IsString() @IsNotEmpty() employeeId!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) instructions = '';
  @ApiProperty({ required: false, enum: LETTER_KINDS }) @IsOptional() @IsIn(LETTER_KINDS) kind?: LetterKind;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @IsNotEmpty() templateId?: string;
}

const COHORT_TYPES = ['all', 'department', 'province', 'manual'] as const;
export class MassCohortDto {
  @ApiProperty({ enum: COHORT_TYPES }) @IsIn(COHORT_TYPES as unknown as string[]) type!: 'all' | 'department' | 'province' | 'manual';
  @ApiProperty({ required: false }) @ValidateIf((o: MassCohortDto) => o.type === 'department' || o.type === 'province') @IsString() @IsNotEmpty() @MaxLength(100) value?: string;
  @ApiProperty({ required: false, type: [String] }) @ValidateIf((o: MassCohortDto) => o.type === 'manual') @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) employeeIds?: string[];
}
export class MassIssueLetterDto {
  @ApiProperty() @IsString() @IsNotEmpty() templateId!: string;
  @ApiProperty({ type: MassCohortDto }) @ValidateNested() @Type(() => MassCohortDto) cohort!: MassCohortDto;
  @ApiProperty({ enum: LETTER_MODES }) @IsIn(LETTER_MODES as unknown as string[]) mode!: 'save' | 'signature';
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() personalizeWithAi?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) instructions?: string;
}

export class AssignTrainingDto {
  @ApiProperty() @IsString() @IsNotEmpty() courseId!: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) employeeIds!: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsString() dueDate?: string;
}

const STATUSES: TrainingStatus[] = ['Assigned', 'In-Progress', 'Completed'];

export class UpdateAssignmentDto {
  @ApiProperty({ enum: STATUSES, required: false }) @IsOptional() @IsIn(STATUSES) status?: TrainingStatus;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
}
