/**
 * Where the session token lives when the API is configured for `token` auth.
 *
 * In `cookie` mode none of this runs — the token is in an httpOnly cookie the
 * page can't see, which is the safer arrangement and the one to go back to
 * once the app and the API share a domain. Token mode exists because a cookie
 * can't cross between two unrelated domains without `SameSite=None`, and that
 * is increasingly blocked as a third-party cookie.
 */
const KEY = 'schema-designer.token';

export const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE || 'cookie').toLowerCase();
export const usesToken = AUTH_MODE === 'token';

// Private-mode Safari and "block site data" settings make localStorage throw
// rather than return null, so every access is guarded.
export function readToken() {
  if (!usesToken) return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeToken(token) {
  if (!usesToken || !token) return;
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* Session then lasts only as long as the tab. Better than failing login. */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* Nothing stored, nothing to clear. */
  }
}
