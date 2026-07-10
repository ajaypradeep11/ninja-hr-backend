// src/contexts/recruitment/interface/dto/recruitment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import type { CandidateSource, CandidateStage, EmploymentType } from '../../domain/recruitment.types';

// The platform is strictly scoped to Ontario. Reject any other province at the
// edge so no requisition can be created or edited outside ON.
const PROVINCES = ['ON'];
const EMPLOYMENT_TYPES: EmploymentType[] = ['Full-time', 'Part-time', 'Contractor'];

@ValidatorConstraint({ name: 'salaryRange', async: false })
class SalaryRangeValid implements ValidatorConstraintInterface {
  validate(salaryMax: number, args: ValidationArguments): boolean {
    const { salaryMin } = args.object as CreateRequisitionDto;
    return typeof salaryMin !== 'number' || salaryMax >= salaryMin;
  }
  defaultMessage(): string {
    return 'salaryMax must be greater than or equal to salaryMin';
  }
}

const CANDIDATE_STAGES: CandidateStage[] = [
  'Applied',
  'AI Screened',
  'Interview',
  'Offer',
  'Hired',
  'Rejected',
];

export class HiringTeamMemberDto {
  @ApiProperty() @IsString() @IsNotEmpty() employeeId!: string;
  @ApiProperty() @IsBoolean() isPanelMember!: boolean;
}

export class CreateRequisitionDto {
  @ApiProperty() @IsString() @IsNotEmpty() title!: string;
  @ApiProperty() @IsString() @IsNotEmpty() department!: string;
  @ApiProperty({ enum: PROVINCES, default: 'ON' })
  @IsIn(PROVINCES, { message: 'This platform is scoped to Ontario — province must be "ON"' })
  province!: string;
  @ApiProperty({ enum: EMPLOYMENT_TYPES }) @IsIn(EMPLOYMENT_TYPES) type!: EmploymentType;
  @ApiProperty() @IsInt() @Min(0) salaryMin!: number;
  @ApiProperty() @IsInt() @Min(0) @Validate(SalaryRangeValid) salaryMax!: number;
  /** Optional at draft time — managers may leave it to HR; HR can add it here. */
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(20000) jd?: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) approverIds!: string[];
  @ApiProperty({ type: [HiringTeamMemberDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => HiringTeamMemberDto)
  hiringTeam!: HiringTeamMemberDto[];
}

export class DecisionDto {
  @ApiProperty({ enum: ['Approved', 'Rejected'] })
  @IsIn(['Approved', 'Rejected'])
  decision!: 'Approved' | 'Rejected';

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

export class PreScreenQuestionDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) question!: string;
  @ApiProperty() @IsBoolean() required!: boolean;
}

export class PublishingDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(20000) jd?: string;
  @ApiProperty({ type: [PreScreenQuestionDto], required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PreScreenQuestionDto)
  preScreenQuestions?: PreScreenQuestionDto[];
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() indeedEnabled?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() linkedinEnabled?: boolean;
  /** Admin-controlled Blind Hiring — scrubs candidate identity for non-HR viewers. */
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() blindHiring?: boolean;
}

export class SetCandidateStageDto {
  @ApiProperty({ enum: CANDIDATE_STAGES })
  @IsIn(CANDIDATE_STAGES)
  stage!: CandidateStage;
}

/* ------------------------- Communication templates ----------------------- */

const TRIGGERS = ['Application Received', 'Interview Scheduled', 'Rejected', 'Manual'] as const;
type TriggerLabel = (typeof TRIGGERS)[number];

export class TemplateDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) subject!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(10000) body!: string;
  @ApiProperty({ enum: TRIGGERS }) @IsIn(TRIGGERS) trigger!: TriggerLabel;
}

export class UpdateTemplateDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(300) subject?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(10000) body?: string;
  @ApiProperty({ enum: TRIGGERS, required: false }) @IsOptional() @IsIn(TRIGGERS) trigger?: TriggerLabel;
}

export class SendCommunicationDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() templateId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(300) subject?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(10000) body?: string;
}

export class AddNoteDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) body!: string;
}

export class GuideSectionDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @ApiProperty({ required: false, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  weight?: number;
  /** Guiding questions/prompts (newline-separated) shown to interviewers. */
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000) guidance?: string;
}

export class SetGuideTemplateDto {
  @ApiProperty({ type: [GuideSectionDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GuideSectionDto)
  sections!: GuideSectionDto[];
}

export class ImportGuideDto {
  /** Raw text of an existing interview document (pasted or uploaded .txt/.md). */
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(50000) text!: string;
}

export class DraftMessageDto {
  /** Natural-language instruction, e.g. "Politely decline but invite a re-apply in 6 months". */
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(1000) instruction!: string;
}

/** Webhook payload shaped like SendGrid Inbound Parse / SES SNS notifications. */
export class InboundEmailDto {
  /** Reply address, e.g. "reply+<portalToken>@mail.ninjahr.ca" — routes the thread. */
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(320) to!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsEmail() from?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(300) subject?: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(20000) text!: string;
}

export class SimulateReplyDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(300) subject?: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(20000) body!: string;
}

export class SetCostDto {
  @ApiProperty() @IsInt() @Min(0) costOfHire!: number;
}

export class ArchiveRequisitionDto {
  @ApiProperty() @IsBoolean() archived!: boolean;
}

export class GenerateJdDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
  @ApiProperty() @IsString() @IsNotEmpty() department!: string;
  @ApiProperty() @IsString() province!: string;
  @ApiProperty() @IsString() type!: string;
  @ApiProperty() @IsInt() @Min(0) salaryMin!: number;
  @ApiProperty() @IsInt() @Min(0) salaryMax!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000) keyPoints?: string;
}

/* ------------------------------ Scorecards ------------------------------- */

export class ScorecardCriterionDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) weight?: number;
  /** Guiding questions/prompts (newline-separated) shown to interviewers. */
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000) guidance?: string;
}

export class SetScorecardCriteriaDto {
  @ApiProperty({ type: [ScorecardCriterionDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ScorecardCriterionDto)
  criteria!: ScorecardCriterionDto[];
}

const RECOMMENDATIONS = ['Strong Yes', 'Yes', 'No', 'Strong No'] as const;

export class ScorecardRatingDto {
  @ApiProperty() @IsString() @IsNotEmpty() criterionId!: string;
  // 0 allowed for drafts (not-yet-rated); the repo enforces 1–5 on final submit.
  @ApiProperty() @IsInt() @Min(0) @Max(5) rating!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class SubmitScorecardDto {
  @ApiProperty({ enum: RECOMMENDATIONS })
  @IsIn(RECOMMENDATIONS)
  recommendation!: (typeof RECOMMENDATIONS)[number];
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(5000) overallNotes?: string;
  @ApiProperty({ enum: ['DRAFT', 'SUBMITTED'], required: false })
  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED'])
  status?: 'DRAFT' | 'SUBMITTED';
  @ApiProperty({ type: [ScorecardRatingDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ScorecardRatingDto)
  ratings!: ScorecardRatingDto[];
}

/* ---------------------------- Public careers ---------------------------- */

const SOURCES: CandidateSource[] = ['Careers Site', 'Indeed', 'LinkedIn'];

export class PreScreenAnswerDto {
  @ApiProperty() @IsString() @IsNotEmpty() questionId!: string;
  @ApiProperty() @IsString() @MaxLength(2000) answer!: string;
}

export class ApplyDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(30000) resumeText?: string;
  // Base64-encoded résumé file (~6MB cap after encoding ≈ 4.5MB file).
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(6_000_000) resumeFileBase64?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(255) resumeFileName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['application/pdf', 'text/plain']) resumeMimeType?: string;
  @ApiProperty({ enum: SOURCES, required: false })
  @IsOptional()
  @IsIn(SOURCES)
  source?: CandidateSource;
  /** Ontario privacy compliance: explicit consent is mandatory to apply. */
  @ApiProperty() @IsBoolean() @Equals(true, { message: 'Privacy consent is required to apply' })
  consent!: boolean;
  @ApiProperty({ type: [PreScreenAnswerDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PreScreenAnswerDto)
  answers!: PreScreenAnswerDto[];
}
