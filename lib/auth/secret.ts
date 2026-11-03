import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * AUTH_SECRET, or for zero-config local runs a random secret generated once and kept in
 * .pglite/auth-secret. A deployment (VERCEL set) must provide AUTH_SECRET.
 */
export function authSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.VERCEL) throw new Error('AUTH_SECRET is required in deployments. Generate one with: openssl rand -base64 32');
  const dir = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.PGLITE_DIR || '.pglite');
  const file = path.join(dir, 'auth-secret');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  mkdirSync(dir, { recursive: true });
  const secret = randomBytes(32).toString('base64');
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && adminEmails().has(email.toLowerCase());
}

/** The email-only dev login: on in development and test, opt-in elsewhere, never on Vercel production. */
export function devLoginEnabled(): boolean {
  if (process.env.VERCEL_ENV === 'production') return false;
  return process.env.NODE_ENV !== 'production' || process.env.GW_ENABLE_DEV_LOGIN === '1';
}
