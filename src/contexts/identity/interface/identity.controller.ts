// src/contexts/identity/interface/identity.controller.ts
import { Body, ConflictException, Controller, Get, Param, Post } from '@nestjs/common';
import { slugify, dedupeSlug } from 'src/platform/database/slug';
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
   * Multi-tenant signup: every call provisions a brand-new company. Creates a
   * Company (name + a unique URL slug), the founding Employee + HR_ADMIN User,
   * and the company's settings row — all stamped with the new companyId. One
   * email still maps to one company (the Firebase check below), matching
   * Firebase's one-account-per-email model.
   *
   * Uses the raw system client on purpose: the tenant did not exist a moment
   * ago, so there is no ALS context to inherit, and the tenant extension does
   * not stamp NESTED writes (the User created under Employee) — here we set
   * companyId explicitly on every row instead.
   */
  @Public()
  @Post('company-signup')
  async companySignup(@Body() body: CompanySignupDto) {
    const email = body.workEmail.trim().toLowerCase();
    // Never adopt an already-existing Firebase identity: provisionUser is
    // create-or-GET and setPassword would overwrite that account's password,
    // so signing up with a victim's email could hijack their Firebase login.
    // This also enforces one-email-one-company.
    if (await this.firebase.findUserByEmail(email)) {
      throw new ConflictException('An account already exists for this email.');
    }

    const slug = await this.uniqueCompanySlug(body.companyName.trim());

    const uid = await this.firebase.provisionUser(email);
    if (!uid) {
      throw new ConflictException('Firebase Auth is not enabled for signup.');
    }
    await this.firebase.setPassword(uid, body.password);

    const result = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: body.companyName.trim(), slug },
      });

      await tx.companySettings.create({
        data: {
          companyId: company.id,
          companyName: body.companyName.trim(),
          provinces: [body.province],
          integrations: DEFAULT_INTEGRATIONS,
        },
      });

      const employee = await tx.employee.create({
        data: {
          companyId: company.id,
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
              companyId: company.id,
              role: 'HR_ADMIN',
              firebaseUid: uid,
            },
          },
        },
        include: { user: true },
      });
      return { company, employee };
    });

    return {
      companyId: result.company.id,
      companySlug: result.company.slug,
      userId: result.employee.user?.id,
      employeeId: result.employee.id,
      email: result.employee.email,
      role: result.employee.user?.role,
    };
  }

  /** base slug from the name, deduped against slugs already taken (base-2, …). */
  private async uniqueCompanySlug(name: string): Promise<string> {
    const base = slugify(name);
    const existing = await this.prisma.company.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    return dedupeSlug(base, new Set(existing.map((c) => c.slug)));
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
    // The caller's company slug backs the public careers links shown in the
    // authenticated UI (/careers/<slug>/<job>). Company is the unscoped tenant
    // root, looked up on the system client by the actor's resolved companyId.
    const companySlug = actor.companyId
      ? (await this.prisma.company.findUnique({ where: { id: actor.companyId }, select: { slug: true } }))?.slug ?? null
      : null;

    // Trusted-lane persona fallback has no user id; report the coarse role.
    if (!actor.userId) {
      return {
        id: null, employeeId: null, name: null, title: null,
        department: null, role: actor.role, roleCode: actor.role, realUserId: null,
        companyId: actor.companyId, companySlug,
      };
    }
    const user = await this.queries.execute(new GetUserByIdQuery(actor.userId));
    return { ...user, realUserId: actor.realUserId, companyId: actor.companyId, companySlug };
  }
}
