// src/contexts/onboarding/application/commands/submit-profile.command.spec.ts
import { BadRequestException, ConflictException } from '@nestjs/common';
import { SubmitProfileHandler, SubmitProfileCommand, type NewHireProfileInput } from './submit-profile.command';
import type { OnboardingCase } from '../../domain/onboarding.types';

const openCase = {
  id: 'c1', token: 't1', name: 'Julie Warren', status: 'Forms In Progress',
  forms: { personal: false, td1: false, directDeposit: false, benefits: false, handbook: false },
} as unknown as OnboardingCase;

/** A complete form, minus the two secrets — tests add those per-case. */
const baseInput = {
  legalFirstName: 'Julie', legalLastName: 'Warren', dateOfBirth: '1995-04-12',
  phone: '416-555-0142', addressStreet: '12 Queen St W', addressCity: 'Toronto',
  addressPostal: 'M5H 2N2', emergencyName: 'Ravi', emergencyRelationship: 'Spouse',
  emergencyPhone: '416-555-0199', workEligibility: 'Citizen',
  bankInstitution: '001', bankTransit: '12345', bankAccountHolder: 'Julie Warren',
} as unknown as NewHireProfileInput;

function makeRepo(opts: { onFile?: Record<string, unknown> | null; c?: OnboardingCase } = {}) {
  const saved: Record<string, unknown>[] = [];
  const repo = {
    findByToken: async () => opts.c ?? openCase,
    rawProfile: async () => opts.onFile ?? null,
    saveProfile: async (_t: string, profile: Record<string, unknown>) => { saved.push(profile); },
    updateForms: async () => undefined,
    addAudit: async () => undefined,
    findById: async () => opts.c ?? openCase,
    setStatus: async () => undefined,
  };
  return { handler: new SubmitProfileHandler(repo as never), saved };
}

describe('SubmitProfileHandler — secrets already on file', () => {
  const onFile = { sin: '123456789', bankAccount: '9876543', legalFirstName: 'Julie' };

  it('keeps the stored SIN and account when they are not re-typed', async () => {
    const { handler, saved } = makeRepo({ onFile });
    // What a returning employee sends: they never had the real values to send —
    // reads mask them — so both are simply absent.
    await handler.execute(new SubmitProfileCommand('t1', { ...baseInput, addressCity: 'Ottawa' }));

    expect(saved[0].sin).toBe('123456789');
    expect(saved[0].bankAccount).toBe('9876543');
    expect(saved[0].addressCity).toBe('Ottawa'); // the edit they actually made
  });

  it('replaces them when the employee deliberately re-types them', async () => {
    const { handler, saved } = makeRepo({ onFile });
    await handler.execute(
      new SubmitProfileCommand('t1', { ...baseInput, sin: '987654321', bankAccount: '1112223' }),
    );
    expect(saved[0].sin).toBe('987654321');
    expect(saved[0].bankAccount).toBe('1112223');
  });

  // The corruption this whole design exists to prevent: merging from a MASKED
  // read would persist "••• ••• 789" as the SIN, silently destroying it.
  it('never stores a mask as the real value', async () => {
    const { handler, saved } = makeRepo({ onFile });
    await handler.execute(new SubmitProfileCommand('t1', { ...baseInput }));
    expect(String(saved[0].sin)).not.toContain('•');
    expect(String(saved[0].bankAccount)).not.toContain('•');
  });

  it('requires both on a FIRST submission — nothing on file to keep', async () => {
    const { handler } = makeRepo({ onFile: null });
    await expect(handler.execute(new SubmitProfileCommand('t1', { ...baseInput })))
      .rejects.toThrow(BadRequestException);

    const { handler: h2 } = makeRepo({ onFile: null });
    await expect(h2.execute(new SubmitProfileCommand('t1', { ...baseInput, sin: '123456789' })))
      .rejects.toThrow(BadRequestException); // bank account still missing
  });

  it('stamps submittedAt on every save', async () => {
    const { handler, saved } = makeRepo({ onFile });
    await handler.execute(new SubmitProfileCommand('t1', { ...baseInput }));
    expect(typeof saved[0].submittedAt).toBe('string');
  });

  it('refuses edits once the case is activated (HRIS owns the record)', async () => {
    const active = { ...openCase, status: 'Active' } as OnboardingCase;
    const { handler } = makeRepo({ onFile, c: active });
    await expect(handler.execute(new SubmitProfileCommand('t1', { ...baseInput })))
      .rejects.toThrow(ConflictException);
  });
});
