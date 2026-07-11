import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

interface TenantStore {
  companyId: string | null;
}

/**
 * Holds the current request's tenant (companyId) in an AsyncLocalStorage store,
 * so the Prisma tenant extension and any code can read it without threading it
 * through call signatures. Set once per request by the auth layer, or explicitly
 * via run() for the tenant-less escape-hatch flows (careers-by-slug, by-token).
 */
@Injectable()
export class TenantContext {
  private readonly als = new AsyncLocalStorage<TenantStore>();

  /** Run fn with companyId as the active tenant (nested runs override). */
  run<T>(companyId: string | null, fn: () => T): T {
    return this.als.run({ companyId }, fn);
  }

  /** The active companyId, or null when running outside any tenant context. */
  get companyId(): string | null {
    return this.als.getStore()?.companyId ?? null;
  }
}
