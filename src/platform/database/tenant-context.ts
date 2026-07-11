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

  /**
   * Mutate the active store's companyId. Used by the auth layer: a global
   * middleware opens an empty store (run(null, …)) for the whole request, then
   * ActorGuard resolves the caller and calls set() so the tenant is visible to
   * the route handler and the Prisma extension downstream. Throws if no store is
   * open — that means the request-scoped middleware did not run, which must fail
   * loudly rather than silently leave queries unscoped.
   */
  set(companyId: string | null): void {
    const store = this.als.getStore();
    if (!store) {
      throw new Error(
        'No tenant store is open — ensure the tenant context middleware wraps every request before ActorGuard runs.',
      );
    }
    store.companyId = companyId;
  }

  /** The active companyId, or null when running outside any tenant context. */
  get companyId(): string | null {
    return this.als.getStore()?.companyId ?? null;
  }
}
