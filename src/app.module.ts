import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './platform/database/database.module';
import { HealthController } from './platform/health/health.controller';
import { InternalKeyGuard } from './platform/auth/internal-key.guard';
import { ActorGuard } from './platform/auth/actor.guard';
import { RolesGuard } from './platform/auth/roles.guard';
import { IdentityModule } from './contexts/identity/identity.module';
import { OnboardingModule } from './contexts/onboarding/onboarding.module';
import { PeopleModule } from './contexts/people/people.module';
import { TimeoffModule } from './contexts/timeoff/timeoff.module';
import { RecruitmentModule } from './contexts/recruitment/recruitment.module';
import { PerformanceModule } from './contexts/performance/performance.module';
import { OffboardingModule } from './contexts/offboarding/offboarding.module';
import { WorkplaceModule } from './contexts/workplace/workplace.module';
import { PlatformModule } from './contexts/platform/platform.module';
import { PlatformAdminModule } from './contexts/platform-admin/platform-admin.module';

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    OnboardingModule,
    PeopleModule,
    TimeoffModule,
    RecruitmentModule,
    PerformanceModule,
    OffboardingModule,
    WorkplaceModule,
    PlatformModule,
    PlatformAdminModule,
  ],
  controllers: [HealthController],
  providers: [
    // Multiple APP_GUARD providers run in registration order (Nest appends
    // each to the same global-guards list as it scans this array), so the
    // edge guard MUST come first: it authenticates the caller (internal key
    // or Firebase bearer) and sets req.trusted / req.firebaseUser, which
    // ActorGuard then reads to resolve req.actor. RolesGuard enforces
    // @Roles() against that resolved actor last.
    // NOTE: previously InternalKeyGuard was registered via
    // app.useGlobalGuards() in main.ts/e2e-utils.ts, which Nest appends
    // *after* module-scanned APP_GUARD providers — so it actually ran LAST,
    // after ActorGuard's x-actor-id branch had already resolved (and
    // ActorGuard's trusted-lane branch does not itself check req.trusted).
    // Net effect: any request carrying an x-actor-id header impersonated
    // that user with no credential check at all. Registering it here fixes
    // both the ordering and the impersonation gap.
    { provide: APP_GUARD, useClass: InternalKeyGuard },
    { provide: APP_GUARD, useClass: ActorGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
