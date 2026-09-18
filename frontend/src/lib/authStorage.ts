/** Namespaced localStorage keys for JWT + user snapshot. */ // FIXED: A3
const appName = import.meta.env.VITE_APP_NAME || 'CertaPay'; // FIXED: A3

export const AUTH_TOKEN_KEY = `${appName}_token`; // FIXED: A3
export const AUTH_USER_KEY = `${appName}_user`; // FIXED: A3

const LEGACY_TOKEN = 'sg_token'; // FIXED: A3
const LEGACY_USER = 'sg_user'; // FIXED: A3

export function getStoredToken(): string | null {
  // FIXED: A3
  return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN); // FIXED: A3
}

export function setStoredToken(token: string): void {
  // FIXED: A3
  localStorage.setItem(AUTH_TOKEN_KEY, token); // FIXED: A3
}

export function removeStoredAuth(): void {
  // FIXED: A3
  localStorage.removeItem(AUTH_TOKEN_KEY); // FIXED: A3
  localStorage.removeItem(AUTH_USER_KEY); // FIXED: A3
  localStorage.removeItem(LEGACY_TOKEN); // FIXED: A3
  localStorage.removeItem(LEGACY_USER); // FIXED: A3
}
