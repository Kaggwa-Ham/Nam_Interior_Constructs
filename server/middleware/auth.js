// Authentication / authorisation middleware.

import config from '../config.js';
import prisma from '../db.js';
import { verifySessionToken } from '../lib/auth.js';

const COOKIE = config.session.cookieName;

/// Base options for the session cookie. `secure` is only enabled in
/// production because browsers reject Secure cookies over plain http.
export function cookieOptions(expires) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
    ...(expires ? { expires } : {}),
  };
}

/// Reads the session cookie and attaches `req.user` when valid.
/// Never rejects — use `requireAuth` for that.
export async function attachUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE];
  if (!token) return next();

  const payload = verifySessionToken(token, config.session.secret);
  if (!payload) return next();

  try {
    // Re-check the user still exists and is active, so deactivating an
    // account takes effect immediately rather than at token expiry.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (user?.isActive) req.user = user;
  } catch {
    // Database hiccup should not turn into an auth bypass or a crash.
  }
  return next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  return next();
}

/// Usage: requireRole('OWNER', 'ADMIN')
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    return next();
  };
}

export function setSessionCookie(res, token, expiresAt) {
  res.cookie(COOKIE, token, cookieOptions(expiresAt));
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE, cookieOptions());
}
