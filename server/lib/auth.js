// Password hashing and session-token signing built on Node's own crypto
// module. This keeps the auth layer dependency-free (no bcrypt native build,
// no jwt package) while remaining standards-correct:
//
//   • Passwords  → scrypt with a per-user random salt (memory-hard KDF)
//   • Sessions   → HMAC-SHA256 signed, base64url token, verified in constant time

import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHmac,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

// ── Passwords ────────────────────────────────────────────────────────────────

/// Returns a self-describing hash string: `scrypt$N$r$p$salt$key` (all hex).
export async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }
  const salt = randomBytes(16);
  const key = await scrypt(plain, salt, SCRYPT_PARAMS.keylen, SCRYPT_PARAMS);
  const { N, r, p } = SCRYPT_PARAMS;
  return ['scrypt', N, r, p, salt.toString('hex'), key.toString('hex')].join('$');
}

/// Constant-time verification that also tolerates unknown/legacy formats.
export async function verifyPassword(plain, stored) {
  if (typeof plain !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, N, r, p, saltHex, keyHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(keyHex, 'hex');

  let actual;
  try {
    actual = await scrypt(plain, salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ── Session tokens ───────────────────────────────────────────────────────────

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function sign(payloadSegment, secret) {
  return createHmac('sha256', secret).update(payloadSegment).digest('base64url');
}

/// Creates a compact, tamper-evident token: `<base64url payload>.<hmac>`.
export function createSessionToken({ sub, role, email, name }, { secret, hours }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub, role, email, name, iat: now, exp: now + hours * 3600 };
  const segment = b64url(JSON.stringify(payload));
  return { token: `${segment}.${sign(segment, secret)}`, expiresAt: new Date(payload.exp * 1000) };
}

/// Returns the decoded payload, or null when invalid, tampered with or expired.
export function verifySessionToken(token, secret) {
  if (typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;

  const segment = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = sign(segment, secret);

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== 'number') return null;
  if (payload.exp * 1000 < Date.now()) return null;
  return payload;
}

/// URL-safe random id generator used for uploaded filenames.
export function randomId(bytes = 12) {
  return randomBytes(bytes).toString('hex');
}
