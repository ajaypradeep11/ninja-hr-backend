// src/contexts/identity/infrastructure/identity.repository.ts
import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import type { UserAccount } from '../domain/identity.types';
import { rowToUserAccount } from './identity.mapper';

@Injectable()
export class IdentityRepository {
  constructor(private readonly prisma: TenantPrismaService) {}

  async getUsers(): Promise<UserAccount[]> {
    const rows = await this.prisma.user.findMany({
      include: { employee: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(rowToUserAccount);
  }

  async getUserById(id: string): Promise<UserAccount | null> {
    const row = await this.prisma.user.findUnique({ where: { id }, include: { employee: true } });
    return row ? rowToUserAccount(row) : null;
  }
}
