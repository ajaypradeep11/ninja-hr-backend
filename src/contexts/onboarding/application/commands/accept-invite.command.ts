// src/contexts/onboarding/application/commands/accept-invite.command.ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { FirebaseAdminService } from 'src/platform/auth/firebase-admin.service';
import { PrismaService } from 'src/platform/database/prisma.service';

/**
 * Invite acceptance — the new hire choosing a password (or signing in with
 * Google) on `/welcome/:token`. Exactly one of `password` / `idToken` is set.
 */
export class AcceptInviteCommand {
  constructor(
    public readonly token: string,
    public readonly credential: { password?: string; idToken?: string },
  ) {}
}

export interface AcceptInviteResult {
  /** The address to sign in with — the client signs in right after this call. */
  email: string;
}

/**
 * Turns an invite token into a real, signed-in-able identity.
 *
 * Preboarding used to create NO database rows until HR pressed Activate, so a
 * hire who set their password landed in the employee shell as a Firebase user
 * with no User row and got a hard 403 from ActorGuard. Acceptance now
 * provisions the Employee + User up front at PRE_HIRE (invisible to the
 * directory, which lists ACTIVE/ON_STATUTORY_LEAVE only) with the hire's
 * Firebase uid stamped on the User, so the guard resolves them by uid from
 * their very first request. Activation later promotes that same row to ACTIVE.
 */
@CommandHandler(AcceptInviteCommand)
export class AcceptInviteHandler implements ICommandHandler<AcceptInviteCommand, AcceptInviteResult> {
  constructor(
    private readonly repo: OnboardingRepository,
    private readonly firebase: FirebaseAdminService,
    private readonly prisma: PrismaService,
  ) {}

  async execute({ token, credential }: AcceptInviteCommand): Promise<AcceptInviteResult> {
    const { password, idToken } = credential;
    if (!password === !idToken) {
      throw new BadRequestException('Provide exactly one of password or idToken.');
    }
    const c = await this.repo.findByToken(token);
    if (!c) throw new NotFoundException('This invite link is invalid or has expired.');

    const email = c.personalEmail.trim().toLowerCase();
    const uid = idToken ? await this.uidFromIdToken(idToken, email) : await this.uidFromPassword(c.id, email, password!);

    await this.repo.provisionEmployee(c.id, { status: 'PRE_HIRE', firebaseUid: uid });
    // A hire who accepted before this row existed (or who signs in with Google
    // after setting a password) already has a User — make sure it carries the
    // uid they are actually authenticating with, or ActorGuard 403s them.
    await this.bindUid(c.id, uid);
    return { email };
  }

  /** Google lane: the client already signed in — trust only a VERIFIED token. */
  private async uidFromIdToken(idToken: string, email: string): Promise<string> {
    const verified = await this.firebase.verifyBearer(idToken);
    if ((verified.email ?? '').trim().toLowerCase() !== email) {
      throw new ConflictException(`Sign in with ${email} to accept this invite.`);
    }
    return verified.uid;
  }

  /**
   * Password lane: set the password on the identity provisioned at invite time.
   *
   * The guard below is the important part. HR types the invite address by hand,
   * so a case can name an address that already belongs to a real, linked
   * account — setting a password on it would hand this invite's holder that
   * person's login (including an HR_ADMIN's). Adopting an UNLINKED Firebase
   * account is safe and expected: that is exactly what `CreateCaseHandler`
   * provisions for the invite. Mirrors `identity.controller`'s signup check.
   */
  private async uidFromPassword(caseId: string, email: string, password: string): Promise<string> {
    if (password.length < 10) throw new BadRequestException('Password must be at least 10 characters.');

    const existingUid = await this.firebase.findUserByEmail(email);
    if (existingUid) {
      const linked = await this.prisma.user.findFirst({ where: { firebaseUid: existingUid } });
      // Linked to THIS case's own hire → they are re-accepting (a re-sent
      // invite, a second submit); anyone else → refuse, that is a takeover.
      if (linked) {
        const own = await this.prisma.onboardingCase.findUnique({
          where: { id: caseId },
          select: { employeeId: true },
        });
        if (!own?.employeeId || own.employeeId !== linked.employeeId) {
          throw new ConflictException('An account already exists for this email — ask HR to check the invite address.');
        }
      }
    }

    const uid = existingUid ?? (await this.firebase.provisionUser(email));
    if (!uid) throw new ConflictException('Firebase Auth is not enabled — cannot accept this invite.');
    await this.firebase.setPassword(uid, password);
    // The invite went to this address, so reaching here proves control of the
    // inbox. Marking it verified lets ActorGuard's email auto-link work later
    // (e.g. if HR re-creates the User) instead of dead-ending at a 403.
    await this.firebase.markEmailVerified(uid);
    return uid;
  }

  /** Stamp the uid on this case's User when it isn't already bound to one. */
  private async bindUid(caseId: string, uid: string): Promise<void> {
    const row = await this.prisma.onboardingCase.findUnique({
      where: { id: caseId },
      select: { employeeId: true },
    });
    if (!row?.employeeId) return;
    await this.prisma.user.updateMany({
      where: { employeeId: row.employeeId, firebaseUid: null },
      data: { firebaseUid: uid },
    });
  }
}
