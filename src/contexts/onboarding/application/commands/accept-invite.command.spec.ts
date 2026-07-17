// src/contexts/onboarding/application/commands/accept-invite.command.spec.ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AcceptInviteHandler, AcceptInviteCommand } from './accept-invite.command';
import type { OnboardingCase } from '../../domain/onboarding.types';

const invitedCase = {
  id: 'c1', token: 't1', name: 'Abi', title: 'Manager', department: 'Engineering',
  province: 'ON', startDate: '2026-07-31', personalEmail: 'Abi@Gmail.com',
  status: 'Invited', createdAt: '2026-07-16',
  forms: { personal: false, td1: false, directDeposit: false, benefits: false, handbook: false },
  checklist: [], documents: [], consent: [], taskAssignees: {}, policiesAttached: [], auditLog: [],
} as unknown as OnboardingCase;

function makeDeps(opts: {
  case?: OnboardingCase | null;
  /** uid already registered in Firebase for the case's email, if any. */
  existingUid?: string | null;
  /** User row that uid is linked to, if any. */
  linkedUser?: { id: string; employeeId: string } | null;
  /** employeeId already on the case (i.e. it has been accepted before). */
  caseEmployeeId?: string | null;
  verified?: { uid: string; email: string | null; emailVerified: boolean };
} = {}) {
  const calls = {
    provisioned: [] as { caseId: string; status?: string; firebaseUid?: string }[],
    passwords: [] as [string, string][],
    verifiedEmails: [] as string[],
    created: [] as string[],
    boundUids: [] as string[],
  };
  const repo = {
    findByToken: async () => (opts.case === undefined ? invitedCase : opts.case),
    provisionEmployee: async (caseId: string, o: { status?: string; firebaseUid?: string }) => {
      calls.provisioned.push({ caseId, ...o });
      return { created: true, employeeId: 'emp1' };
    },
  };
  const firebase = {
    findUserByEmail: async () => opts.existingUid ?? null,
    provisionUser: async (email: string) => { calls.created.push(email); return 'uid-new'; },
    setPassword: async (uid: string, pw: string) => { calls.passwords.push([uid, pw]); },
    markEmailVerified: async (uid: string) => { calls.verifiedEmails.push(uid); },
    verifyBearer: async () => opts.verified ?? { uid: 'uid-google', email: 'abi@gmail.com', emailVerified: true },
  };
  const prisma = {
    user: {
      findFirst: async () => opts.linkedUser ?? null,
      updateMany: async ({ data }: { data: { firebaseUid: string } }) => {
        calls.boundUids.push(data.firebaseUid);
        return { count: 1 };
      },
    },
    onboardingCase: {
      findUnique: async () => ({ employeeId: opts.caseEmployeeId ?? null }),
    },
  };
  const handler = new AcceptInviteHandler(repo as never, firebase as never, prisma as never);
  return { handler, calls };
}

describe('AcceptInviteHandler', () => {
  it('provisions a PRE_HIRE employee bound to the hire’s firebase uid', async () => {
    const { handler, calls } = makeDeps({ existingUid: 'uid-invited' });
    const out = await handler.execute(new AcceptInviteCommand('t1', { password: 'super-secret' }));

    // Lower-cased: the address is what the client signs in with next.
    expect(out).toEqual({ email: 'abi@gmail.com' });
    expect(calls.passwords).toEqual([['uid-invited', 'super-secret']]);
    // PRE_HIRE keeps them out of the directory until HR activates; the uid is
    // what ActorGuard resolves them by on their very first request.
    expect(calls.provisioned).toEqual([{ caseId: 'c1', status: 'PRE_HIRE', firebaseUid: 'uid-invited' }]);
  });

  it('marks the email verified — the invite proves inbox control', async () => {
    const { handler, calls } = makeDeps({ existingUid: 'uid-invited' });
    await handler.execute(new AcceptInviteCommand('t1', { password: 'super-secret' }));
    expect(calls.verifiedEmails).toEqual(['uid-invited']);
  });

  it('creates the firebase identity when the invite never provisioned one', async () => {
    const { handler, calls } = makeDeps({ existingUid: null });
    await handler.execute(new AcceptInviteCommand('t1', { password: 'super-secret' }));
    expect(calls.created).toEqual(['abi@gmail.com']);
    expect(calls.passwords).toEqual([['uid-new', 'super-secret']]);
  });

  // The takeover guard: HR types the invite address by hand, so a case can name
  // an address that already belongs to a real account. Setting a password on it
  // would hand this link's holder that person's login.
  it('refuses an email already linked to somebody else’s account', async () => {
    const { handler, calls } = makeDeps({
      existingUid: 'uid-ceo',
      linkedUser: { id: 'u-ceo', employeeId: 'emp-ceo' },
      caseEmployeeId: null,
    });
    await expect(handler.execute(new AcceptInviteCommand('t1', { password: 'super-secret' })))
      .rejects.toThrow(ConflictException);
    expect(calls.passwords).toEqual([]); // never touched the victim's password
  });

  it('allows the hire to re-accept their own invite', async () => {
    const { handler, calls } = makeDeps({
      existingUid: 'uid-abi',
      linkedUser: { id: 'u-abi', employeeId: 'emp1' },
      caseEmployeeId: 'emp1', // same person — a re-sent invite / second submit
    });
    await handler.execute(new AcceptInviteCommand('t1', { password: 'new-password' }));
    expect(calls.passwords).toEqual([['uid-abi', 'new-password']]);
  });

  it('accepts a google id token whose verified email matches the invite', async () => {
    const { handler, calls } = makeDeps({
      verified: { uid: 'uid-google', email: 'ABI@gmail.com', emailVerified: true },
    });
    await handler.execute(new AcceptInviteCommand('t1', { idToken: 'tok' }));
    expect(calls.provisioned).toEqual([{ caseId: 'c1', status: 'PRE_HIRE', firebaseUid: 'uid-google' }]);
    expect(calls.passwords).toEqual([]);
  });

  it('refuses a google id token for a different email', async () => {
    const { handler } = makeDeps({
      verified: { uid: 'uid-other', email: 'someone.else@gmail.com', emailVerified: true },
    });
    await expect(handler.execute(new AcceptInviteCommand('t1', { idToken: 'tok' })))
      .rejects.toThrow(ConflictException);
  });

  it('404s an unknown or expired token', async () => {
    const { handler } = makeDeps({ case: null });
    await expect(handler.execute(new AcceptInviteCommand('nope', { password: 'super-secret' })))
      .rejects.toThrow(NotFoundException);
  });

  it('rejects a short password and a missing/ambiguous credential', async () => {
    const { handler } = makeDeps();
    await expect(handler.execute(new AcceptInviteCommand('t1', { password: 'short' })))
      .rejects.toThrow(BadRequestException);
    await expect(handler.execute(new AcceptInviteCommand('t1', {})))
      .rejects.toThrow(BadRequestException);
    await expect(handler.execute(new AcceptInviteCommand('t1', { password: 'super-secret', idToken: 'tok' })))
      .rejects.toThrow(BadRequestException);
  });
});
