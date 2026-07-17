// src/contexts/platform-admin/platform-admin.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PlatformAdminController } from './interface/platform-admin.controller';
import { PlatformAdminRepository } from './infrastructure/platform-admin.repository';
import { PLATFORM_ADMIN_HANDLERS } from './application/platform-admin.handlers';

/**
 * The control plane for the ninja-hr-admin console: cross-tenant reads plus
 * company/user lifecycle. Kept as its own context (rather than folded into
 * contexts/platform, which is AI copilot/policy/moderation) so the one place
 * that intentionally bypasses tenant isolation is obvious by name.
 */
@Module({
  imports: [CqrsModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminRepository, ...PLATFORM_ADMIN_HANDLERS],
})
export class PlatformAdminModule {}
