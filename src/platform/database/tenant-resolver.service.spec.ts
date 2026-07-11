import { NotFoundException } from '@nestjs/common';
import { TenantResolver } from './tenant-resolver.service';
import { TenantContext } from './tenant-context';

// A real TenantContext so we can prove the fn runs inside the resolved tenant.
function make(prisma: any) {
  const tenant = new TenantContext();
  const resolver = new TenantResolver(prisma as never, tenant);
  return { resolver, tenant };
}

describe('TenantResolver', () => {
  it('runByCompanySlug runs fn inside the resolved company', async () => {
    const prisma = { company: { findUnique: jest.fn(async () => ({ id: 'c1' })) } };
    const { resolver, tenant } = make(prisma);
    const seen = await resolver.runByCompanySlug('acme', async () => tenant.companyId);
    expect(seen).toBe('c1');
  });

  it('runByCompanySlug 404s an unknown slug', async () => {
    const prisma = { company: { findUnique: jest.fn(async () => null) } };
    const { resolver } = make(prisma);
    await expect(resolver.runByCompanySlug('nope', async () => 1)).rejects.toThrow(NotFoundException);
  });

  it('runByRequisitionSlug resolves the owning company from the requisition', async () => {
    const prisma = { requisition: { findFirst: jest.fn(async () => ({ companyId: 'c9' })) } };
    const { resolver, tenant } = make(prisma);
    const seen = await resolver.runByRequisitionSlug('eng-lead', async () => tenant.companyId);
    expect(seen).toBe('c9');
  });

  it('runByCaseToken 404s an unknown token', async () => {
    const prisma = { onboardingCase: { findFirst: jest.fn(async () => null) } };
    const { resolver } = make(prisma);
    await expect(resolver.runByCaseToken('bad', async () => 1)).rejects.toThrow(NotFoundException);
  });

  it('runByCaseTokenOrNull returns null (not 404) for an unknown token', async () => {
    const prisma = { onboardingCase: { findFirst: jest.fn(async () => null) } };
    const { resolver } = make(prisma);
    await expect(resolver.runByCaseTokenOrNull('bad', async () => 1)).resolves.toBeNull();
  });

  it('runByPortalToken resolves the candidate company', async () => {
    const prisma = { candidate: { findFirst: jest.fn(async () => ({ companyId: 'c3' })) } };
    const { resolver, tenant } = make(prisma);
    const seen = await resolver.runByPortalToken('tok', async () => tenant.companyId);
    expect(seen).toBe('c3');
  });
});
