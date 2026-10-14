// Admin: user management and activity log. Restricted to OWNER.

import express from 'express';
import prisma from '../db.js';
import { asyncHandler, badRequest, notFound } from '../middleware/errors.js';
import { requireRole } from '../middleware/auth.js';
import { hashPassword } from '../lib/auth.js';
import { userCreateSchema, userUpdateSchema } from '../lib/validation.js';

const router = express.Router();
router.use(requireRole('OWNER'));

const SAFE_SELECT = {
  id: true, email: true, name: true, role: true, isActive: true,
  lastLoginAt: true, createdAt: true, _count: { select: { notes: true } },
};

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: SAFE_SELECT });
    res.json({ users });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = userCreateSchema.parse(req.body);
    const user = await prisma.user.create({
      data: { name, email, role, passwordHash: await hashPassword(password) },
      select: SAFE_SELECT,
    });
    await prisma.auditLog.create({
      data: { action: 'USER_CREATE', entity: 'User', entityId: user.id, userId: req.user.id },
    });
    res.status(201).json({ user });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = userUpdateSchema.parse(req.body);

    // Guard against locking the whole team out of the dashboard.
    if (req.params.id === req.user.id && (data.isActive === false || (data.role && data.role !== 'OWNER'))) {
      throw badRequest('You cannot deactivate or demote your own account.');
    }

    if (data.isActive === false || data.role && data.role !== 'OWNER') {
      const owners = await prisma.user.count({ where: { role: 'OWNER', isActive: true } });
      const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
      if (!target) throw notFound('That user no longer exists.');
      if (target.role === 'OWNER' && owners <= 1) {
        throw badRequest('At least one active OWNER must remain.');
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        role: data.role,
        isActive: data.isActive,
        ...(data.password ? { passwordHash: await hashPassword(data.password) } : {}),
      },
      select: SAFE_SELECT,
    });

    await prisma.auditLog.create({
      data: { action: 'USER_UPDATE', entity: 'User', entityId: user.id, meta: { ...data, password: undefined }, userId: req.user.id },
    });
    res.json({ user });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) throw badRequest('You cannot delete your own account.');

    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
    if (!target) throw notFound('That user no longer exists.');
    if (target.role === 'OWNER' && (await prisma.user.count({ where: { role: 'OWNER' } })) <= 1) {
      throw badRequest('At least one OWNER account must remain.');
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

/// Recent activity feed shown on the dashboard.
router.get(
  '/activity',
  asyncHandler(async (_req, res) => {
    const activity = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true, action: true, entity: true, entityId: true, meta: true, createdAt: true,
        user: { select: { name: true } },
      },
    });
    res.json({ activity });
  }),
);

export default router;
