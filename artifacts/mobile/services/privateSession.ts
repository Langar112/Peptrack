import type { User } from './api';

export interface PrivateSessionResponse {
  token: string;
  user: User;
}

export interface PrivateSessionDependencies {
  getStoredToken: () => Promise<string | null>;
  storeToken: (token: string) => Promise<void>;
  clearStoredToken: () => Promise<void>;
  restoreUser: () => Promise<PrivateSessionResponse>;
  createAnonymousSession: () => Promise<PrivateSessionResponse>;
}

/**
 * Restores a device's existing private session or provisions one automatically.
 * An invalid legacy token is discarded before a new isolated session is created.
 */
export async function restoreOrCreatePrivateSession(
  dependencies: PrivateSessionDependencies,
): Promise<User> {
  const existingToken = await dependencies.getStoredToken();

  if (existingToken) {
    try {
      const restored = await dependencies.restoreUser();
      await dependencies.storeToken(restored.token);
      return restored.user;
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? (error as { status?: unknown }).status
        : undefined;

      if (status === 401 || status === 404) {
        await dependencies.clearStoredToken();
      } else {
        throw error;
      }
    }
  }

  const created = await dependencies.createAnonymousSession();
  await dependencies.storeToken(created.token);
  return created.user;
}