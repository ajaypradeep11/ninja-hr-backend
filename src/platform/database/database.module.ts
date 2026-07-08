import { Global, Module } from '@nestjs/common';
import { FirebaseAdminService } from '../auth/firebase-admin.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, FirebaseAdminService],
  exports: [PrismaService, FirebaseAdminService],
})
export class DatabaseModule {}
