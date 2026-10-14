// Admin authentication. Session is an HMAC-signed httpOnly cookie — see
// server/lib/auth.js for how tokens are produced and verified.

import express from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../db.js';
import config from '../config.js';
import { asyncHandler, unauthorized, badRequest } from '../middleware/errors.js';
import { clearSessionCookie, requireAuth, setSessionCookie } from '../middleware/auth.js';
import { createSessionToken, hashPassword, verifyPassword } from '../lib/auth.js';
import { loginSchema, passwordChangeSchema } from '../lib/validation.js';

const router = express.Router();

/// Brute-force protection: 10 attempts per 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
});

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Always run a hash comparison, even when the user does not exist, so
    // response timing does not reveal which emails are registered.
    const dummyHash =
      'scrypt$16384$8$1$00000000000000000000000000000000$' + '0'.repeat(128);
    const ok = await verifyPassword(password, user?.passwordHash ?? dummyHash);

    if (!user || !ok) return res.status(401).json({ error: 'Incorrect email or password.' });
    if (!user.isActive) return res.status(403).json({ error: 'This account has been deactivated.' });

    const { token, expiresAt } = createSessionToken(
      { sub: user.id, role: user.role, email: user.email, name: user.name },
      { secret: config.session.secret, hours: config.session.hours },
    );
    setSessionCookie(res, token, expiresAt);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await prisma.auditLog.create({
      data: { action: 'LOGIN', entity: 'User', entityId: user.id, userId: user.id },
    });

    res.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      expiresAt,
    });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (req.user) {
      await prisma.auditLog.create({
        data: { action: 'LOGOUT', entity: 'User', entityId: req.user.id, userId: req.user.id },
      });
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  }),
);

/// Used by the admin UI on load to decide whether to show the login screen.
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }),
);

router.post(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw unauthorized();
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw badRequest('Your current password is incorrect.', { currentPassword: 'Incorrect password.' });
    }
    if (await verifyPassword(newPassword, user.passwordHash)) {
      throw badRequest('Choose a password you have not used before.', {
        newPassword: 'That is already your password.',
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    await prisma.auditLog.create({
      data: { action: 'PASSWORD_CHANGE', entity: 'User', entityId: user.id, userId: user.id },
    });

    // Force a fresh sign-in everywhere with the new password.
    clearSessionCookie(res);
    res.json({ ok: true, message: 'Password updated. Please sign in again.' });
  }),
);

export default router;
