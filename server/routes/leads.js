// Admin: manage the sales pipeline.

import express from 'express';
import prisma from '../db.js';
import { asyncHandler, notFound } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { leadBulkSchema, leadNoteSchema, leadUpdateSchema } from '../lib/validation.js';

const router = express.Router();
router.use(requireAuth);

const LEAD_SELECT = {
  id: true, name: true, email: true, phone: true, location: true,
  type: true, projectType: true, budgetRange: true, timeline: true,
  message: true, status: true, priority: true, source: true, assignedTo: true,
  createdAt: true, updatedAt: true, contactedAt: true, convertedAt: true,
  service: { select: { id: true, title: true } },
  _count: { select: { notes: true } },
};

/// GET /api/admin/leads
/// Query: q, status, type, sort, page, pageSize
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 20));
    const { q, status, type, sort } = req.query;

    const where = {};
    if (status && status !== 'ALL') where.status = String(status).toUpperCase();
    if (type && type !== 'ALL') where.type = String(type).toUpperCase();
    if (q) {
      const term = String(q).trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { location: { contains: term, mode: 'insensitive' } },
        { message: { contains: term, mode: 'insensitive' } },
      ];
    }

    const orderBy =
      sort === 'oldest' ? [{ createdAt: 'asc' }] : sort === 'name' ? [{ name: 'asc' }] : [{ createdAt: 'desc' }];

    const [rows, total, byStatus] = await Promise.all([
      prisma.lead.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, select: LEAD_SELECT }),
      prisma.lead.count({ where }),
      prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    res.json({
      rows,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      counts: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    });
  }),
);

/// Dashboard summary cards.
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [total, thisMonth, prevMonth, newCount, won, recent, byStatus, byCategory] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.lead.count({ where: { createdAt: { gte: startOfPrevMonth, lt: startOfMonth } } }),
      prisma.lead.count({ where: { status: 'NEW' } }),
      prisma.lead.count({ where: { status: 'WON' } }),
      prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 6, select: LEAD_SELECT }),
      prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.lead.groupBy({ by: ['projectType'], _count: { _all: true }, where: { projectType: { not: null } } }),
    ]);

    // Twelve-month trend for the dashboard chart.
    const since = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const leadsForTrend = await prisma.lead.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, status: true },
    });

    const buckets = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('en-GB', { month: 'short' }),
        count: 0,
      });
    }
    const index = Object.fromEntries(buckets.map((b, i) => [b.key, i]));
    for (const lead of leadsForTrend) {
      const key = `${lead.createdAt.getFullYear()}-${String(lead.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (key in index) buckets[index[key]].count += 1;
    }

    const growth = prevMonth === 0 ? (thisMonth > 0 ? 100 : 0) : Math.round(((thisMonth - prevMonth) / prevMonth) * 100);
    const conversionRate = total ? Math.round((won / total) * 1000) / 10 : 0;

    res.json({
      total,
      thisMonth,
      prevMonth,
      growth,
      newCount,
      won,
      conversionRate,
      recent,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      topProjectTypes: byCategory
        .filter((c) => c.projectType)
        .sort((a, b) => b._count._all - a._count._all)
        .slice(0, 5)
        .map((c) => ({ label: c.projectType, count: c._count._all })),
      trend: buckets,
    });
  }),
);

router.get(
  '/export',
  asyncHandler(async (_req, res) => {
    const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
    const headers = [
      'id', 'createdAt', 'status', 'type', 'name', 'email', 'phone', 'location',
      'projectType', 'budgetRange', 'timeline', 'message', 'source',
    ];
    const escape = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(','),
      ...leads.map((l) => headers.map((h) => escape(h === 'createdAt' ? l[h]?.toISOString() : l[h])).join(',')),
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="nam-leads-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\uFEFF' + csv); // BOM keeps Excel happy with UTF-8
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      select: {
        ...LEAD_SELECT,
        ipAddress: true,
        userAgent: true,
        referrer: true,
        notes: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, body: true, createdAt: true, author: { select: { name: true } } },
        },
      },
    });
    if (!lead) throw notFound('That lead no longer exists.');
    res.json({ lead });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = leadUpdateSchema.parse(req.body);

    // Record pipeline timestamps automatically when status changes.
    if (data.status && !data.contactedAt && ['CONTACTED', 'QUALIFIED', 'QUOTED', 'WON'].includes(data.status)) {
      const existing = await prisma.lead.findUnique({ where: { id: req.params.id }, select: { contactedAt: true } });
      if (existing && !existing.contactedAt) data.contactedAt = new Date();
    }
    if (data.status === 'WON' && !data.convertedAt) data.convertedAt = new Date();

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data,
      select: LEAD_SELECT,
    });
    await prisma.auditLog.create({
      data: {
        action: 'LEAD_UPDATE',
        entity: 'Lead',
        entityId: lead.id,
        meta: data,
        userId: req.user.id,
      },
    });
    res.json({ lead });
  }),
);

router.post(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    const { body } = leadNoteSchema.parse(req.body);
    const note = await prisma.leadNote.create({
      data: { body, leadId: req.params.id, authorId: req.user.id },
      select: { id: true, body: true, createdAt: true, author: { select: { name: true } } },
    });
    res.status(201).json({ note });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const lead = await prisma.lead.delete({ where: { id: req.params.id }, select: { id: true } });
    await prisma.auditLog.create({
      data: { action: 'LEAD_DELETE', entity: 'Lead', entityId: lead.id, userId: req.user.id },
    });
    res.json({ ok: true });
  }),
);

/// Bulk update status or delete many leads at once.
router.post(
  '/bulk',
  asyncHandler(async (req, res) => {
    const { ids, action, status } = leadBulkSchema.parse(req.body);

    if (action === 'delete') {
      const result = await prisma.lead.deleteMany({ where: { id: { in: ids } } });
      await prisma.auditLog.create({
        data: { action: 'LEAD_BULK_DELETE', entity: 'Lead', meta: { count: result.count }, userId: req.user.id },
      });
      return res.json({ ok: true, affected: result.count });
    }

    if (!status) return res.status(400).json({ error: 'A status is required for this action.' });
    const result = await prisma.lead.updateMany({ where: { id: { in: ids } }, data: { status } });
    await prisma.auditLog.create({
      data: { action: 'LEAD_BULK_STATUS', entity: 'Lead', meta: { status, count: result.count }, userId: req.user.id },
    });
    return res.json({ ok: true, affected: result.count });
  }),
);

export default router;
