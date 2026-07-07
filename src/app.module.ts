import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './platform/database/database.module';
import { HealthController } from './platform/health/health.controller';
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
  ],
  controllers: [HealthController],
  providers: [
    // Run after the InternalKeyGuard registered in main.ts:
    // ActorGuard resolves x-actor-id → req.actor, RolesGuard enforces @Roles().
    { provide: APP_GUARD, useClass: ActorGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
