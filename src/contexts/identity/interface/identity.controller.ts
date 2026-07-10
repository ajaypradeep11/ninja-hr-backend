// src/contexts/identity/interface/identity.controller.ts
import { Body, ConflictException, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { ActorCtx, type ActorContext } from 'src/platform/auth/actor-context';
import { GetUsersQuery } from '../application/queries/get-users.query';
import { GetUserByIdQuery } from '../application/queries/get-user-by-id.query';
import { Public } from 'src/platform/auth/public.decorator';
import { Roles } from 'src/platform/auth/roles.decorator';
import { PrismaService } from 'src/platform/database/prisma.service';
import { FirebaseAdminService } from 'src/platform/auth/firebase-admin.service';
import { Province } from 'src/platform/database/generated/prisma/enums';

const DEFAULT_INTEGRATIONS = {
  google: true,
  m365: true,
  slack: false,
  sharepoint: false,
  esign: false,
  quickbooks: false,
};
class CompanySignupDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  companyName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  adminName!: string;

  @ApiProperty()
  @IsEmail()
  workEmail!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: Province })
  @IsEnum(Province)
  province!: Province;
}

@ApiTags('identity')
@Controller('identity')
export class IdentityController {
  constructor(
    private readonly queries: QueryBus,
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
  ) {}

  /**
   * First-company bootstrap. This app is single-tenant today, so public signup
   * is intentionally one-time: after any user exists, HR must invite people.
   */
  @Public()
  @Post('company-signup')
  async companySignup(@Body() body: CompanySignupDto) {
    // Public bootstrap is strictly one-time: it stays open only until the first
    // user account exists. The previous companyName allow-list never closed
    // when the name was still the product/seed default ('NinjaHR'/'TestHR
    // Inc.'), so anyone could self-provision an additional HR_ADMIN.
    const existingUsers = await this.prisma.user.count();
    if (existingUsers > 0) {
      throw new ConflictException('Company is already onboarded. Ask an administrator for an invite.');
    }

    const email = body.workEmail.trim().toLowerCase();
    // Never adopt an already-existing Firebase identity: provisionUser is
    // create-or-GET and setPassword would overwrite that account's password,
    // so signing up with a victim's email could hijack their Firebase login.
    if (await this.firebase.findUserByEmail(email)) {
      throw new ConflictException('An account already exists for this email.');
    }
    const uid = await this.firebase.provisionUser(email);
    if (!uid) {
      throw new ConflictException('Firebase Auth is not enabled for signup.');
    }
    await this.firebase.setPassword(uid, body.password);

    const employee = await this.prisma.$transaction(async (tx) => {
      await tx.companySettings.upsert({
        where: { id: 'default' },
        update: {
          companyName: body.companyName.trim(),
          provinces: [body.province],
        },
        create: {
          id: 'default',
          companyName: body.companyName.trim(),
          provinces: [body.province],
          integrations: DEFAULT_INTEGRATIONS,
        },
      });

      const created = await tx.employee.create({
        data: {
          name: body.adminName.trim(),
          title: 'Founder / HR Admin',
          department: 'People',
          province: body.province,
          email,
          hireDate: new Date(),
          birthDate: new Date('1970-01-01T00:00:00.000Z'),
          salary: 0,
          user: {
            create: {
              role: 'HR_ADMIN',
              firebaseUid: uid,
            },
          },
        },
        include: { user: true },
      });
      return created;
    });

    return {
      userId: employee.user?.id,
      employeeId: employee.id,
      email: employee.email,
      role: employee.user?.role,
    };
  }

  /**
   * Switchable demo logins for the frontend user switcher. Intentionally
   * available to any authenticated user because the employee shell renders the
   * switcher too; the mapped shape carries no email/salary/SIN — only
   * name/title/department/role — so this is limited to org-directory data.
   */
  @Get('users')
  getUsers() {
    return this.queries.execute(new GetUsersQuery());
  }

  /** Single account lookup — HR-only (not used by the employee UI). */
  @Get('users/:id')
  @Roles('HR_ADMIN')
  getUserById(@Param('id') id: string) {
    return this.queries.execute(new GetUserByIdQuery(id));
  }

  /**
   * The authenticated caller's own identity. Shape mirrors `users` items plus
   * `realUserId` (the verified caller, distinct from `userId` while an
   * HR_ADMIN is impersonating via x-actor-id).
   */
  @Get('me')
  async me(@ActorCtx() actor: ActorContext) {
    // Trusted-lane persona fallback has no user id; report the coarse role.
    if (!actor.userId) {
      return {
        id: null, employeeId: null, name: null, title: null,
        department: null, role: actor.role, roleCode: actor.role, realUserId: null,
      };
    }
    const user = await this.queries.execute(new GetUserByIdQuery(actor.userId));
    return { ...user, realUserId: actor.realUserId };
  }
}
