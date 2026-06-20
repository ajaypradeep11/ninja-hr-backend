import { Module } from '@nestjs/common';
import { DatabaseModule } from './platform/database/database.module';
import { HealthController } from './platform/health/health.controller';
import { OnboardingModule } from './contexts/onboarding/onboarding.module';
import { OffboardingModule } from './contexts/offboarding/offboarding.module';

@Module({
  imports: [DatabaseModule, OnboardingModule, OffboardingModule],
  controllers: [HealthController],
})
export class AppModule {}
