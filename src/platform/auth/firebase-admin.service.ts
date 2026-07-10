// src/platform/auth/firebase-admin.service.ts
// Wraps firebase-admin so the rest of the app never imports it directly.
// Three modes:
//  - disabled (FIREBASE_AUTH_DISABLED=1): guard rejects bearer auth; internal-key lane still works
//  - emulator (FIREBASE_AUTH_EMULATOR_HOST set): no credentials needed, project id only
//  - production: application default credentials, or explicit service-account env vars
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';

export interface VerifiedFirebaseUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

@Injectable()
export class FirebaseAdminService {
  private app: admin.app.App | null = null;

  constructor() {
    if (process.env.FIREBASE_AUTH_DISABLED === '1') return;

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (emulator) {
      if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required with the auth emulator');
      this.app = admin.apps.length
        ? admin.app()
        : admin.initializeApp({ projectId });
      return;
    }
    if (!projectId && !process.env.FIREBASE_CONFIG) {
      throw new Error(
        'FIREBASE_PROJECT_ID or FIREBASE_CONFIG is required. Use application default credentials in production, ' +
          'set FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY for explicit service-account auth, ' +
          'or FIREBASE_AUTH_EMULATOR_HOST for local dev, or FIREBASE_AUTH_DISABLED=1 to run without auth.',
      );
    }
    const options =
      clientEmail && privateKey
        ? { credential: admin.credential.cert({ projectId, clientEmail, privateKey }) }
        : projectId
          ? { projectId }
          : undefined;
    this.app = admin.apps.length ? admin.app() : admin.initializeApp(options);
  }

  get enabled(): boolean {
    return this.app !== null;
  }

  private auth(): admin.auth.Auth {
    if (!this.app) throw new UnauthorizedException('firebase auth is disabled');
    return this.app.auth();
  }

  /** Verify a bearer credential: browser ID token first, then SSR session cookie. */
  async verifyBearer(token: string): Promise<VerifiedFirebaseUser> {
    const auth = this.auth();
    try {
      const t = await auth.verifyIdToken(token, true);
      return { uid: t.uid, email: t.email ?? null, emailVerified: t.email_verified === true };
    } catch {
      const c = await auth.verifySessionCookie(token, true).catch(() => {
        throw new UnauthorizedException('invalid or expired token');
      });
      return { uid: c.uid, email: c.email ?? null, emailVerified: c.email_verified === true };
    }
  }

  /** Look up an existing Firebase user's uid by email WITHOUT creating one.
   * Returns null when no account exists (or auth is disabled). */
  async findUserByEmail(email: string): Promise<string | null> {
    if (!this.app) return null;
    try {
      return (await this.auth().getUserByEmail(email)).uid;
    } catch {
      return null;
    }
  }

  /** Create-or-get a Firebase user for an invited employee. Null when disabled. */
  async provisionUser(email: string): Promise<string | null> {
    if (!this.app) return null;
    const auth = this.auth();
    try {
      return (await auth.getUserByEmail(email)).uid;
    } catch {
      const u = await auth.createUser({ email, emailVerified: false });
      return u.uid;
    }
  }

  async setPassword(uid: string, password: string): Promise<void> {
    await this.auth().updateUser(uid, { password });
  }

  async createSessionCookie(idToken: string, expiresInMs: number): Promise<string> {
    return this.auth().createSessionCookie(idToken, { expiresIn: expiresInMs });
  }

  async revokeSessions(uid: string): Promise<void> {
    await this.auth().revokeRefreshTokens(uid);
  }
}
