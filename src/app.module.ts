import { Module } from '@nestjs/common';
import { DatabaseModule } from './platform/database/database.module';
import { HealthController } from './platform/health/health.controller';
import { OnboardingModule } from './contexts/onboarding/onboarding.module';
import { PeopleModule } from './contexts/people/people.module';
import { TimeoffModule } from './contexts/timeoff/timeoff.module';
import { RecruitmentModule } from './contexts/recruitment/recruitment.module';
import { PerformanceModule } from './contexts/performance/performance.module';
import { OffboardingModule } from './contexts/offboarding/offboarding.module';
import { WorkplaceModule } from './contexts/workplace/workplace.module';

@Module({
  imports: [DatabaseModule, OnboardingModule, PeopleModule, TimeoffModule, RecruitmentModule, PerformanceModule, OffboardingModule, WorkplaceModule],
  controllers: [HealthController],
})
export class AppModule {}
