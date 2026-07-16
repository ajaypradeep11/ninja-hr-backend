import { NotFoundException } from '@nestjs/common';
import { ChatAgentService } from './chat-agent.service';
import type { ActorContext } from 'src/platform/auth/actor-context';

const actor: ActorContext = {
  userId: 'user-1', employeeId: 'employee-1', employeeName: 'Alex', department: 'People',
  role: 'EMPLOYEE', realUserId: 'user-1', companyId: 'company-1',
};
const empty = { id: 'conversation-1', title: 'New conversation', createdAt: '', updatedAt: '', messages: [] };

describe('ChatAgentService', () => {
  function setup() {
    const conversations = {
      findOwned: jest.fn().mockResolvedValue(empty),
      appendOwned: jest
        .fn()
        .mockResolvedValueOnce({ ...empty, messages: [{ id: 'm1', role: 'user', content: 'My leave?', blockedCategory: null, createdAt: '' }] })
        .mockResolvedValueOnce({ ...empty, messages: [] }),
    };
    const snapshots = { build: jest.fn().mockResolvedValue({ json: '{"me":{"name":"Alex"}}', otherEmployeeNames: ['Sarah'] }) };
    const policies = { retrieve: jest.fn().mockResolvedValue([]) };
    const guarded = { ask: jest.fn().mockResolvedValue({ text: 'Safe answer', live: true, verdict: { allowed: true } }) };
    return { conversations, snapshots, policies, guarded, service: new ChatAgentService(conversations as never, snapshots as never, policies as never, guarded as never) };
  }

  it('persists the user before context work and sends guarded last-turn history', async () => {
    const { service, conversations, snapshots, policies, guarded } = setup();
    await service.send({ conversationId: 'conversation-1', question: 'My leave?', persona: 'employee', actor });
    expect(conversations.findOwned).toHaveBeenCalledWith('conversation-1', 'user-1');
    expect(conversations.appendOwned.mock.invocationCallOrder[0]).toBeLessThan(snapshots.build.mock.invocationCallOrder[0]);
    expect(conversations.appendOwned.mock.invocationCallOrder[0]).toBeLessThan(policies.retrieve.mock.invocationCallOrder[0]);
    expect(guarded.ask).toHaveBeenCalledWith(expect.objectContaining({
      persona: 'employee', userId: 'user-1', maxTokens: 4096,
      otherEmployeeNames: ['Sarah'], messages: [{ role: 'user', content: 'My leave?' }],
    }));
    expect(conversations.appendOwned).toHaveBeenLastCalledWith('conversation-1', 'user-1', {
      role: 'assistant', content: 'Safe answer', blockedCategory: null,
    });
  });

  it('checks ownership before any write or model work', async () => {
    const { service, conversations, snapshots, guarded } = setup();
    conversations.findOwned.mockResolvedValue(null);
    await expect(service.send({ conversationId: 'other', question: 'Hi', persona: 'employee', actor })).rejects.toBeInstanceOf(NotFoundException);
    expect(conversations.appendOwned).not.toHaveBeenCalled();
    expect(snapshots.build).not.toHaveBeenCalled();
    expect(guarded.ask).not.toHaveBeenCalled();
  });

  it('makes offline quick-ask retain its legacy response shape', async () => {
    const { service, guarded } = setup();
    guarded.ask.mockResolvedValue({ text: '', live: false, verdict: { allowed: true } });
    await expect(service.askStateless({ question: 'Leave?', persona: 'employee', actor })).resolves.toEqual({ text: '', live: false });
  });
});
