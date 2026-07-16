import { agentStatusToDb, agentStatusFromDb, rowToAgentRun } from './platform.mapper';

describe('platform enum maps', () => {
  it('round-trips Running', () => {
    expect(agentStatusToDb['Running']).toBe('RUNNING');
    expect(agentStatusFromDb['RUNNING']).toBe('Running');
  });

  it('round-trips Awaiting Approval', () => {
    expect(agentStatusToDb['Awaiting Approval']).toBe('AWAITING_APPROVAL');
    expect(agentStatusFromDb['AWAITING_APPROVAL']).toBe('Awaiting Approval');
  });

  it('round-trips Completed', () => {
    expect(agentStatusToDb['Completed']).toBe('COMPLETED');
    expect(agentStatusFromDb['COMPLETED']).toBe('Completed');
  });

  it('round-trips all three statuses', () => {
    const statuses = ['Running', 'Awaiting Approval', 'Completed'] as const;
    for (const s of statuses) {
      const db = agentStatusToDb[s];
      expect(agentStatusFromDb[db]).toBe(s);
    }
  });

  it('maps nested mass-letter items and defaults generic runs to none', () => {
    const base = { id: 'r1', intent: 'run', status: 'AWAITING_APPROVAL', progress: 100, affected: 1, summary: 'ready', time: 'now' };
    expect(rowToAgentRun(base).items).toEqual([]);
    expect(rowToAgentRun({ ...base, items: [{ id: 'i1', employeeId: 'e1', status: 'Pending', payload: { employeeName: 'A', documentName: 'A.txt', body: 'Body', mode: 'save', aiPersonalized: false } }] }).items[0].payload.body).toBe('Body');
  });
});
