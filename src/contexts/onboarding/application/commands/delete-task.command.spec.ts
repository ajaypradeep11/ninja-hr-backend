// src/contexts/onboarding/application/commands/delete-task.command.spec.ts
import { NotFoundException } from '@nestjs/common';
import { DeleteTaskHandler, DeleteTaskCommand } from './delete-task.command';
import type { OnboardingCase } from '../../domain/onboarding.types';

const baseCase: OnboardingCase = {
  id: 'c1', token: 't1', name: 'A', title: 'x', department: 'Engineering', province: 'ON',
  startDate: '2026-07-01', personalEmail: 'a@b.com', status: 'Forms In Progress', createdAt: '2026-06-01',
  forms: { personal: true, td1: false, directDeposit: true, benefits: false, handbook: false },
  checklist: [{ id: 'task2', label: 'y', owner: 'HR', status: 'Pending', blocking: false, dataAccess: 'general' }],
  documents: [], consent: [], taskAssignees: {}, policiesAttached: [], auditLog: [],
};

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
  const calls = { deleteTask: [] as [string, string][], audit: [] as string[] };
  const repo = {
    deleteTask: async (caseId: string, taskId: string) => {
      calls.deleteTask.push([caseId, taskId]);
      return true;
    },
    addAudit: async (_id: string, event: string) => { calls.audit.push(event); },
    findById: async () => baseCase,
    setStatus: async () => undefined,
    ...overrides,
  };
  return { repo: repo as never, calls };
}

describe('DeleteTaskHandler', () => {
  it('deletes exactly the requested task and audits it', async () => {
    const { repo, calls } = makeRepo();
    const out = await new DeleteTaskHandler(repo).execute(new DeleteTaskCommand('c1', 'task1'));
    expect(calls.deleteTask).toEqual([['c1', 'task1']]);
    expect(calls.audit).toEqual(['Checklist task task1 deleted']);
    // Returns the re-read case (not a locally mutated copy) so the client
    // rebinds to server truth — the surviving task is still there.
    expect(out?.checklist.map((t) => t.id)).toEqual(['task2']);
  });

  it('is idempotent-safe: a second delete of the same task 404s instead of mutating', async () => {
    const { repo, calls } = makeRepo({ deleteTask: async () => false });
    await expect(
      new DeleteTaskHandler(repo).execute(new DeleteTaskCommand('c1', 'task1')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(calls.audit).toEqual([]);
  });

  it('rejects a task id that belongs to another case (repo scopes by caseId)', async () => {
    // The repo's delete is WHERE (id, caseId) — cross-case ids delete 0 rows.
    const { repo } = makeRepo({ deleteTask: async () => false });
    await expect(
      new DeleteTaskHandler(repo).execute(new DeleteTaskCommand('other-case', 'task2')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
