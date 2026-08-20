import jwt from 'jsonwebtoken';
import { beforeAll, describe, expect, it } from 'vitest';

let signToken: typeof import('./auth.js').signToken;
let verifyToken: typeof import('./auth.js').verifyToken;

beforeAll(async () => {
  process.env.SESSION_SECRET = 'test-private-session-secret';
  ({ signToken, verifyToken } = await import('./auth.js'));
});

describe('private session tokens', () => {
  it('contains only an opaque private user identity', () => {
    const token = signToken({ userId: 'device-a' });
    const payload = jwt.decode(token) as Record<string, unknown>;

    expect(payload.userId).toBe('device-a');
    expect(payload.email).toBeUndefined();
    expect(verifyToken(token).userId).toBe('device-a');
  });

  it('keeps separate anonymous sessions isolated by user identity', () => {
    const first = verifyToken(signToken({ userId: 'device-a' }));
    const second = verifyToken(signToken({ userId: 'device-b' }));

    expect(first.userId).toBe('device-a');
    expect(second.userId).toBe('device-b');
    expect(first.userId).not.toBe(second.userId);
  });

  it('continues to accept existing account tokens during the transition', () => {
    const legacyToken = jwt.sign(
      { userId: 'existing-user', email: 'legacy@example.test' },
      process.env.SESSION_SECRET!,
      { expiresIn: '1h' },
    );

    expect(verifyToken(legacyToken).userId).toBe('existing-user');
  });
});