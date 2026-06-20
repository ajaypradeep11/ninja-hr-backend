import { Module } from '@nestjs/common';
import { DatabaseModule } from './platform/database/database.module';
import { HealthController } from './platform/health/health.controller';

@Module({ imports: [DatabaseModule], controllers: [HealthController] })
export class AppModule {}
