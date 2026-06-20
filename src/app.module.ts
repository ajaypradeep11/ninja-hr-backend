import { Module } from '@nestjs/common';
import { DatabaseModule } from './platform/database/database.module';
import { HealthController } from './platform/health/health.controller';
import { OnboardingModule } from './contexts/onboarding/onboarding.module';

@Module({ imports: [DatabaseModule, OnboardingModule], controllers: [HealthController] })
export class AppModule {}
