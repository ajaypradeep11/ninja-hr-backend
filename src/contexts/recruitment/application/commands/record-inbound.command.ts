// src/contexts/recruitment/application/commands/record-inbound.command.ts
// Two-way mailbox intake. Two callers:
//  - the inbound-email webhook (SendGrid Inbound Parse / SES style), which
//    addresses the candidate by portal token parsed from the To: address
//  - the HR "simulate candidate reply" demo helper, which uses the candidate id
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { CandidateDetail } from '../../domain/recruitment.types';

export class RecordInboundCommand {
  constructor(
    public readonly target: { candidateId: string } | { portalToken: string },
    public readonly input: { from?: string; subject?: string; body: string },
  ) {}
}

@CommandHandler(RecordInboundCommand)
export class RecordInboundHandler implements ICommandHandler<RecordInboundCommand, CandidateDetail> {
  constructor(private readonly repo: RecruitmentRepository) {}

  execute({ target, input }: RecordInboundCommand): Promise<CandidateDetail> {
    if (!input.body.trim()) throw new BadRequestException('Inbound message body is empty');
    return this.repo.recordInboundReply(
      'candidateId' in target ? { id: target.candidateId } : { portalToken: target.portalToken },
      input,
    );
  }
}
