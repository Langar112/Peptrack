import { describe, expect, it, vi } from 'vitest';
import { restoreOrCreatePrivateSession } from './privateSession';
import type { User } from './api';

const user: User = {
  id: 'device-session',
  timezone: 'UTC',
  theme: 'system',
  firstDayOfWeek: 'sunday',
  defaultSyringeSize: '1.0',
  disclaimerAccepted: false,
  createdAt: '2026-08-20T00:00:00.000Z',
};

describe('restoreOrCreatePrivateSession', () => {
  it('creates and stores a private session automatically on a new installation', async () => {
    const storeToken = vi.fn().mockResolvedValue(undefined);
    const createAnonymousSession = vi.fn().mockResolvedValue({ token: 'new-private-token', user });

    await expect(restoreOrCreatePrivateSession({
      getStoredToken: vi.fn().mockResolvedValue(null),
      storeToken,
      clearStoredToken: vi.fn(),
      restoreUser: vi.fn(),
      createAnonymousSession,
    })).resolves.toEqual(user);

    expect(createAnonymousSession).toHaveBeenCalledOnce();
    expect(storeToken).toHaveBeenCalledWith('new-private-token');
  });

  it('keeps an existing private session and refreshes its token', async () => {
    const storeToken = vi.fn().mockResolvedValue(undefined);
    const restoreUser = vi.fn().mockResolvedValue({ token: 'refreshed-token', user });
    const createAnonymousSession = vi.fn();

    await restoreOrCreatePrivateSession({
      getStoredToken: vi.fn().mockResolvedValue('legacy-token'),
      storeToken,
      clearStoredToken: vi.fn(),
      restoreUser,
      createAnonymousSession,
    });

    expect(restoreUser).toHaveBeenCalledOnce();
    expect(createAnonymousSession).not.toHaveBeenCalled();
    expect(storeToken).toHaveBeenCalledWith('refreshed-token');
  });

  it('replaces an invalid stored token with a new private session', async () => {
    const clearStoredToken = vi.fn().mockResolvedValue(undefined);
    const createAnonymousSession = vi.fn().mockResolvedValue({ token: 'replacement-token', user });

    await restoreOrCreatePrivateSession({
      getStoredToken: vi.fn().mockResolvedValue('invalid-token'),
      storeToken: vi.fn().mockResolvedValue(undefined),
      clearStoredToken,
      restoreUser: vi.fn().mockRejectedValue({ status: 401 }),
      createAnonymousSession,
    });

    expect(clearStoredToken).toHaveBeenCalledOnce();
    expect(createAnonymousSession).toHaveBeenCalledOnce();
  });

  it('keeps an existing session token when the service is temporarily unreachable', async () => {
    const clearStoredToken = vi.fn();
    const createAnonymousSession = vi.fn();
    const networkError = new Error('Network request failed');

    await expect(restoreOrCreatePrivateSession({
      getStoredToken: vi.fn().mockResolvedValue('existing-token'),
      storeToken: vi.fn(),
      clearStoredToken,
      restoreUser: vi.fn().mockRejectedValue(networkError),
      createAnonymousSession,
    })).rejects.toBe(networkError);

    expect(clearStoredToken).not.toHaveBeenCalled();
    expect(createAnonymousSession).not.toHaveBeenCalled();
  });
});