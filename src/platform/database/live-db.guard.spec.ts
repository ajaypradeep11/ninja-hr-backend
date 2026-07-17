// src/platform/database/live-db.guard.spec.ts
import { assertNotLiveDb, isLiveDbTarget } from './live-db.guard';

const ENV_KEYS = ['DATABASE_URL', 'LIVE_DATABASE_URL', 'DB_LIVE', 'DB_LIVE_CONFIRM'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('isLiveDbTarget', () => {
  it('is false for a plain local setup (no live URL configured)', () => {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/testhr';
    expect(isLiveDbTarget()).toBe(false);
  });

  it('is true when DB_LIVE=true, regardless of URL comparison', () => {
    process.env.DB_LIVE = 'true';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/testhr';
    expect(isLiveDbTarget()).toBe(true);
  });

  it('is true when DATABASE_URL equals LIVE_DATABASE_URL even without the flag', () => {
    process.env.LIVE_DATABASE_URL = 'postgresql://app:secret@10.0.0.1:5432/prod';
    process.env.DATABASE_URL = 'postgresql://app:secret@10.0.0.1:5432/prod';
    expect(isLiveDbTarget()).toBe(true);
  });

  it('is false when DATABASE_URL differs from a configured LIVE_DATABASE_URL', () => {
    process.env.LIVE_DATABASE_URL = 'postgresql://app:secret@10.0.0.1:5432/prod';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/testhr';
    expect(isLiveDbTarget()).toBe(false);
  });
});

describe('assertNotLiveDb', () => {
  it('passes silently on a local target', () => {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/testhr';
    expect(() => assertNotLiveDb('db:seed')).not.toThrow();
  });

  it('throws with the context name when targeting the live DB', () => {
    process.env.DB_LIVE = 'true';
    expect(() => assertNotLiveDb('db:seed')).toThrow(/db:seed.*LIVE/i);
  });

  it('allows a live target only with the explicit DB_LIVE_CONFIRM=yes override', () => {
    process.env.DB_LIVE = 'true';
    process.env.DB_LIVE_CONFIRM = 'yes';
    expect(() => assertNotLiveDb('db:seed')).not.toThrow();
  });

  it('rejects any other DB_LIVE_CONFIRM value', () => {
    process.env.DB_LIVE = 'true';
    process.env.DB_LIVE_CONFIRM = 'true'; // must be exactly "yes"
    expect(() => assertNotLiveDb('db:seed')).toThrow(/LIVE/);
  });
});
