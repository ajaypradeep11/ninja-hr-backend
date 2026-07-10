import { FirebaseAdminService } from './firebase-admin.service';

describe('FirebaseAdminService', () => {
  afterEach(() => {
    delete process.env.FIREBASE_AUTH_DISABLED;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.FIREBASE_CONFIG;
  });

  it('reports disabled when FIREBASE_AUTH_DISABLED=1', () => {
    process.env.FIREBASE_AUTH_DISABLED = '1';
    const svc = new FirebaseAdminService();
    expect(svc.enabled).toBe(false);
  });

  it('is enabled with emulator host + project id', () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    process.env.FIREBASE_PROJECT_ID = 'demo-ninjahr';
    const svc = new FirebaseAdminService();
    expect(svc.enabled).toBe(true);
  });

  it('throws at construction when enabled but unconfigured', () => {
    expect(() => new FirebaseAdminService()).toThrow(/FIREBASE/);
  });

  it('is enabled with project id only for application default credentials', () => {
    process.env.FIREBASE_PROJECT_ID = 'demo-ninjahr';
    const svc = new FirebaseAdminService();
    expect(svc.enabled).toBe(true);
  });

  it('verifyBearer rejects when disabled', async () => {
    process.env.FIREBASE_AUTH_DISABLED = '1';
    const svc = new FirebaseAdminService();
    await expect(svc.verifyBearer('x')).rejects.toThrow(/disabled/);
  });
});
