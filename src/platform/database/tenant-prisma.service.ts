import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantContext } from './tenant-context';
import { tenantExtension } from './tenant.extension';

function build(base: PrismaService, tenant: TenantContext) {
  return base.$extends(tenantExtension(tenant));
}

type ExtendedClient = ReturnType<typeof build>;

// The instance IS the extended client at runtime (the constructor returns it);
// declaration merging gives the class the extended client's typed model
// accessors, so repositories inject TenantPrismaService and keep calling
// this.prisma.<model>.<op> unchanged — now every op is tenant-scoped.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
export interface TenantPrismaService extends ExtendedClient {}

@Injectable()
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TenantPrismaService {
  constructor(base: PrismaService, tenant: TenantContext) {
    return build(base, tenant) as unknown as TenantPrismaService;
  }
}
