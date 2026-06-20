import { Module } from '@nestjs/common';
import { DatabaseModule } from './platform/database/database.module';
import { HealthController } from './platform/health/health.controller';
import { OnboardingModule } from './contexts/onboarding/onboarding.module';
import { PeopleModule } from './contexts/people/people.module';
import { TimeoffModule } from './contexts/timeoff/timeoff.module';

@Module({ imports: [DatabaseModule, OnboardingModule, PeopleModule, TimeoffModule], controllers: [HealthController] })
export class AppModule {}
