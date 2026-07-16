import { BadRequestException } from '@nestjs/common';
import { CopilotService } from './copilot.service';

describe('CopilotService', () => {
  it('delegates without changing the quick-ask result', async () => {
    const chat = { askStateless: jest.fn().mockResolvedValue({ text: 'Answer', live: true }) };
    const service = new CopilotService(chat as never);
    await expect(service.askCoPilot('Question', 'employee')).resolves.toEqual({ text: 'Answer', live: true });
    expect(chat.askStateless).toHaveBeenCalledWith({ question: 'Question', persona: 'employee', actor: undefined });
  });

  it('does not swallow guarded pipeline errors', async () => {
    const chat = { askStateless: jest.fn().mockRejectedValue(new BadRequestException('blocked')) };
    const service = new CopilotService(chat as never);
    await expect(service.askCoPilot('Question', 'admin')).rejects.toBeInstanceOf(BadRequestException);
  });
});
