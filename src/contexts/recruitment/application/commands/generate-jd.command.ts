// src/contexts/recruitment/application/commands/generate-jd.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { JdGeneratorService, type JdGenInput, type JdGenResult } from '../../infrastructure/jd-generator.service';

export class GenerateJdCommand {
  constructor(public readonly input: JdGenInput) {}
}

@CommandHandler(GenerateJdCommand)
export class GenerateJdHandler implements ICommandHandler<GenerateJdCommand, JdGenResult> {
  constructor(private readonly generator: JdGeneratorService) {}
  execute({ input }: GenerateJdCommand): Promise<JdGenResult> {
    return this.generator.generate(input);
  }
}
