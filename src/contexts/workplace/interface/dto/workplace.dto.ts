// src/contexts/workplace/interface/dto/workplace.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { CourseStatus, DocAccess, TrainingStatus } from '../../domain/workplace.types';

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

export class CreateCourseDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(160) title!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) category!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) contentUrl?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(1) @Max(100000) durationMins?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) @Max(100) passMark?: number;
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
