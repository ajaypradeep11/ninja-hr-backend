import { TenantContext } from './tenant-context';

// The tenant root itself carries no companyId and is never scoped. Every other
// model is tenant-owned and must be scoped.
const UNSCOPED_MODELS = new Set(['Company']);

/**
 * Prisma client extension that enforces tenant isolation using the active
 * TenantContext. For every tenant-owned model it:
 *  - reads (findMany/findFirst/count/aggregate/groupBy) → adds `companyId` to the where
 *  - findUnique/update/delete → adds `companyId` as an extra filter (Prisma's
 *    extended-where-unique), so cross-tenant id access resolves to not-found
 *  - create/createMany → stamps `companyId`
 *  - upsert → filters the where and stamps the create branch
 * and FAILS CLOSED: a tenant model touched with no companyId in context throws,
 * so a missing context is a loud error, never a silent "return everything".
 *
 * Cross-tenant lookups (resolving a user by firebaseUid, a case by token) must
 * use the raw/system client instead — see PrismaService.
 *
 * NOTE: query extensions do not intercept NESTED writes, so a nested
 * `{ user: { create: {...} } }` will not be stamped — those few flows set
 * companyId explicitly.
 */
export function tenantExtension(tenant: TenantContext) {
  return {
    name: 'tenant-scope',
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          if (UNSCOPED_MODELS.has(model)) return query(args);

          const companyId = tenant.companyId;
          if (!companyId) {
            throw new Error(
              `Tenant context required for ${model}.${operation} but none is set. ` +
                `Use the system client for cross-tenant lookups, or wrap the work in runInTenant().`,
            );
          }

          args = args ?? {};
          switch (operation) {
            case 'findMany':
            case 'findFirst':
            case 'findFirstOrThrow':
            case 'count':
            case 'aggregate':
            case 'groupBy':
            case 'updateMany':
            case 'deleteMany':
              args.where = args.where ? { AND: [args.where, { companyId }] } : { companyId };
              break;
            case 'findUnique':
            case 'findUniqueOrThrow':
            case 'update':
            case 'delete':
              args.where = { ...args.where, companyId };
              break;
            case 'upsert':
              args.where = { ...args.where, companyId };
              args.create = { ...args.create, companyId };
              break;
            case 'create':
              args.data = { ...args.data, companyId: args.data?.companyId ?? companyId };
              break;
            case 'createMany':
            case 'createManyAndReturn':
              if (Array.isArray(args.data)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                args.data = args.data.map((d: any) => ({ ...d, companyId: d.companyId ?? companyId }));
              } else if (args.data) {
                args.data = { ...args.data, companyId: args.data.companyId ?? companyId };
              }
              break;
            default:
              // count/raw variants with no where/data to scope fall through.
              break;
          }
          return query(args);
        },
      },
    },
  };
}
