import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantContext } from './tenant-context';

/**
 * Resolves the tenant for the public / token-scoped flows that carry no logged-in
 * user (careers pages, candidate portal, new-hire onboarding). Each entry point
 * receives a GLOBALLY-UNIQUE key (a company slug, a requisition slug, a portal or
 * onboarding token); we look the owning company up with the raw system client
 * (unscoped — this is the one place cross-tenant reads are legitimate), then run
 * the caller's work inside that company's tenant context so the scoped repos and
 * the Prisma extension behave exactly as they do for an authenticated request.
 *
 * A missing/unknown key surfaces as 404 — never as a tenant-less query, which
 * would fail closed anyway, but 404 is the correct answer for an unknown slug.
 */
@Injectable()
export class TenantResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  /** Public careers site: `/careers/:companySlug`. */
  async runByCompanySlug<T>(slug: string, fn: () => Promise<T>): Promise<T> {
    const c = await this.prisma.company.findUnique({ where: { slug }, select: { id: true } });
    return this.enter(c?.id ?? null, 'Company not found', fn);
  }

  /** A single published posting / application, keyed by the requisition slug. */
  async runByRequisitionSlug<T>(slug: string, fn: () => Promise<T>): Promise<T> {
    const r = await this.prisma.requisition.findFirst({ where: { slug }, select: { companyId: true } });
    return this.enter(r?.companyId ?? null, 'Job posting not found', fn);
  }

  /** Candidate self-service portal, keyed by the emailed portal token. */
  async runByPortalToken<T>(token: string, fn: () => Promise<T>): Promise<T> {
    const c = await this.prisma.candidate.findFirst({ where: { portalToken: token }, select: { companyId: true } });
    return this.enter(c?.companyId ?? null, 'Application not found', fn);
  }

  /** New-hire onboarding portal, keyed by the invite token. */
  async runByCaseToken<T>(token: string, fn: () => Promise<T>): Promise<T> {
    const c = await this.prisma.onboardingCase.findFirst({ where: { token }, select: { companyId: true } });
    return this.enter(c?.companyId ?? null, 'Onboarding case not found', fn);
  }

  /**
   * Like runByCaseToken but returns null (not 404) for an unknown/expired token,
   * preserving the `/welcome/:token` read contract (the invite page shows a
   * friendly "invalid link" rather than erroring).
   */
  async runByCaseTokenOrNull<T>(token: string, fn: () => Promise<T>): Promise<T | null> {
    const c = await this.prisma.onboardingCase.findFirst({ where: { token }, select: { companyId: true } });
    if (!c?.companyId) return null;
    return this.tenant.run(c.companyId, fn);
  }

  /** Run fn inside an explicit companyId (e.g. signup, which just created it). */
  runInTenant<T>(companyId: string, fn: () => Promise<T>): Promise<T> {
    return this.tenant.run(companyId, fn);
  }

  private enter<T>(companyId: string | null, notFoundMsg: string, fn: () => Promise<T>): Promise<T> {
    if (!companyId) throw new NotFoundException(notFoundMsg);
    return this.tenant.run(companyId, fn);
  }
}
