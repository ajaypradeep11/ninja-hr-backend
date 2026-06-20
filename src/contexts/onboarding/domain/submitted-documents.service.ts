// src/contexts/onboarding/domain/submitted-documents.service.ts
import type { OnboardingCase, CaseDocument } from './onboarding.types';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return h;
}

export function generateSubmittedDocuments(c: OnboardingCase): CaseDocument[] {
  const today = c.startDate;
  const sign = (name: string, type: string, needsVerify = false): CaseDocument => ({
    id: `doc_${Math.abs(hash(name + c.id))}`,
    name,
    type,
    folder: '02_Onboarding_and_Tax',
    status: needsVerify ? 'Needs Verification' : 'Verified',
    signedAt: today,
    signedBy: c.name,
    ip: '203.0.113.42',
  });
  return [
    sign('TD1 Federal 2026 (signed).pdf', 'TD1 Form'),
    sign(`TD1 ${c.province} Provincial (signed).pdf`, 'TD1 Form'),
    sign('New Hire Form (signed).pdf', 'New Hire Form'),
    sign('Direct Deposit – Void Cheque.jpg', 'Direct Deposit', true),
    sign('Benefits Election (signed).pdf', 'Benefits'),
  ];
}
