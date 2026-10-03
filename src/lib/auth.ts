import crypto from 'crypto';

const PASSWORD_PREFIX = 'pbkdf2_sha512';
const PASSWORD_SALT = process.env.PASSWORD_SALT || 'chatsphere-dev-salt';

export function hashPasswordForStorage(password: string): string {
  const normalized = String(password ?? '').trim();
  if (!normalized) return '';
  const hash = crypto.pbkdf2Sync(normalized, PASSWORD_SALT, 100000, 64, 'sha512').toString('hex');
  return `${PASSWORD_PREFIX}$${PASSWORD_SALT}$${hash}`;
}

export function verifyPassword(password: string, storedHash?: string): boolean {
  if (!storedHash) return false;
  const normalized = String(password ?? '');

  if (storedHash.startsWith(`${PASSWORD_PREFIX}$`)) {
    const [, salt, hash] = storedHash.split('$');
    const computed = crypto.pbkdf2Sync(normalized, salt || PASSWORD_SALT, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
  }

  return storedHash === normalized;
}

export function normalizePasswordForStorage(password?: string | null): string | null {
  if (password === undefined || password === null) return null;
  const trimmed = String(password).trim();
  if (!trimmed) return null;
  return hashPasswordForStorage(trimmed);
}

export function isPasswordHashed(password?: string | null): boolean {
  return Boolean(password && password.startsWith(`${PASSWORD_PREFIX}$`));
}
