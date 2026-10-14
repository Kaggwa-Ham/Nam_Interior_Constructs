// Public API — everything the marketing site needs. No authentication.

import express from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../db.js';
import config from '../config.js';
import { asyncHandler } from '../middleware/errors.js';
import { loadSiteData } from '../lib/site-data.js';
import { leadCreateSchema, subscribeSchema } from '../lib/validation.js';
import { leadNotificationEmail, leadAutoReplyEmail, sendMail } from '../lib/mailer.js';

const router = express.Router();

/// Abuse protection for the public write endpoints. Generous enough that a
/// real person never notices, tight enough to stop casual form spam.
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many submissions from this address. Please try again shortly or call us.' },
});

// ── Site-wide bootstrap payload ──────────────────────────────────────────────
// One request returns everything the homepage needs. The homepage itself is
// server-rendered, so this exists for the client-side enhancements and for any
// other consumer (mobile app, future SPA) that wants the same data.
router.get(
  '/bootstrap',
  asyncHandler(async (_req, res) => {
    res.json(await loadSiteData());
  }),
);

// ── Services ─────────────────────────────────────────────────────────────────
router.get(
  '/services',
  asyncHandler(async (_req, res) => {
    const services = await prisma.service.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
    res.json({ services });
  }),
);

// ── Projects ─────────────────────────────────────────────────────────────────
router.get(
  '/projects',
  asyncHandler(async (req, res) => {
    const { category } = req.query;
    const where = { published: true };
    if (category && category !== 'ALL') where.category = String(category).toUpperCase();

    const projects = await prisma.project.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    res.json({ projects });
  }),
);

router.get(
  '/projects/:slug',
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findFirst({
      where: { slug: req.params.slug, published: true },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!project) return res.status(404).json({ error: 'That project could not be found.' });
    res.json({ project });
  }),
);

// ── Testimonials ─────────────────────────────────────────────────────────────
router.get(
  '/testimonials',
  asyncHandler(async (_req, res) => {
    const testimonials = await prisma.testimonial.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ testimonials });
  }),
);

// ── Lead capture ─────────────────────────────────────────────────────────────
router.post(
  '/leads',
  submitLimiter,
  asyncHandler(async (req, res) => {
    const data = leadCreateSchema.parse(req.body);

    // Honeypot: the schema already rejects a filled `website` field, but if it
    // somehow slips through, silently accept without storing anything.
    if (req.body?.website) {
      return res.status(201).json({ ok: true, message: 'Thank you — we will be in touch.' });
    }

    // If the client sent a serviceId, confirm it exists before linking it, so a
    // bogus id cannot cause a foreign-key error.
    let serviceId = data.serviceId || null;
    if (serviceId) {
      const exists = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true } });
      if (!exists) serviceId = null;
    }

    const lead = await prisma.lead.create({
      data: {
        ...data,
        serviceId,
        source: req.get('referer') ? 'website' : 'direct',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')?.slice(0, 500),
        referrer: req.get('referer')?.slice(0, 500),
      },
      include: { service: { select: { title: true } } },
    });

    // Fire-and-forget: a mail outage must never fail the customer's submission.
    void (async () => {
      const notify = leadNotificationEmail(lead);
      await sendMail(notify);
      if (config.mail.enabled) {
        await sendMail(leadAutoReplyEmail({ ...lead }));
      }
    })();

    res.status(201).json({
      ok: true,
      id: lead.id,
      message: 'Thank you — your enquiry has been received. We will be in touch within one working day.',
    });
  }),
);

// ── Newsletter ───────────────────────────────────────────────────────────────
router.post(
  '/subscribe',
  submitLimiter,
  asyncHandler(async (req, res) => {
    const { email } = subscribeSchema.parse(req.body);
    await prisma.subscriber.upsert({
      where: { email },
      update: { unsubscribedAt: null },
      create: { email },
    });
    res.status(201).json({ ok: true, message: 'You are on the list. Thank you.' });
  }),
);

// ── Lightweight health/uptime endpoint ───────────────────────────────────────
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      latencyMs: Date.now() - start,
      uptimeSeconds: Math.round(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
    });
  }),
);

export default router;
