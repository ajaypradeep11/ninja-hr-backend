import { Global, Module } from '@nestjs/common';
import { FirebaseAdminService } from '../auth/firebase-admin.service';
import { PrismaService } from './prisma.service';
import { TenantContext } from './tenant-context';
import { TenantPrismaService } from './tenant-prisma.service';

// PrismaService = raw/system client (connection owner; used for cross-tenant
// lookups by globally-unique keys: firebaseUid, invite/portal tokens, slug).
// TenantPrismaService = the tenant-scoped client that every domain repository
// injects. TenantContext carries the active companyId via AsyncLocalStorage.
@Global()
@Module({
  providers: [PrismaService, TenantContext, TenantPrismaService, FirebaseAdminService],
  exports: [PrismaService, TenantContext, TenantPrismaService, FirebaseAdminService],
})
export class DatabaseModule {}
