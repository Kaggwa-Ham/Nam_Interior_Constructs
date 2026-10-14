// Admin: services, testimonials and editable site settings.

import express from 'express';
import prisma from '../db.js';
import { asyncHandler, notFound } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { serviceSchema, settingsSchema, testimonialSchema } from '../lib/validation.js';

const router = express.Router();
router.use(requireAuth);

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'item';

async function uniqueServiceSlug(desired, excludeId = null) {
  const base = slugify(desired);
  let slug = base;
  let n = 2;
  for (;;) {
    const clash = await prisma.service.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${base}-${n++}`;
  }
}

// ── Services ─────────────────────────────────────────────────────────────────

router.get(
  '/services',
  asyncHandler(async (_req, res) => {
    const services = await prisma.service.findMany({ orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] });
    res.json({ services });
  }),
);

router.post(
  '/services',
  asyncHandler(async (req, res) => {
    const data = serviceSchema.parse(req.body);
    const service = await prisma.service.create({
      data: {
        ...data,
        priceFrom: data.priceFrom || null,
        coverImage: data.coverImage || null,
        slug: await uniqueServiceSlug(data.slug || data.title),
      },
    });
    res.status(201).json({ service });
  }),
);

router.put(
  '/services/:id',
  asyncHandler(async (req, res) => {
    const data = serviceSchema.parse(req.body);
    const existing = await prisma.service.findUnique({ where: { id: req.params.id }, select: { id: true, slug: true } });
    if (!existing) throw notFound('That service no longer exists.');

    const slug =
      data.slug && data.slug !== existing.slug ? await uniqueServiceSlug(data.slug, existing.id) : existing.slug;

    const service = await prisma.service.update({
      where: { id: existing.id },
      data: { ...data, slug, priceFrom: data.priceFrom || null, coverImage: data.coverImage || null },
    });
    res.json({ service });
  }),
);

router.delete(
  '/services/:id',
  asyncHandler(async (req, res) => {
    await prisma.service.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

// ── Testimonials ─────────────────────────────────────────────────────────────

router.get(
  '/testimonials',
  asyncHandler(async (_req, res) => {
    const testimonials = await prisma.testimonial.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
    res.json({ testimonials });
  }),
);

router.post(
  '/testimonials',
  asyncHandler(async (req, res) => {
    const testimonial = await prisma.testimonial.create({ data: testimonialSchema.parse(req.body) });
    res.status(201).json({ testimonial });
  }),
);

router.put(
  '/testimonials/:id',
  asyncHandler(async (req, res) => {
    const testimonial = await prisma.testimonial.update({
      where: { id: req.params.id },
      data: testimonialSchema.parse(req.body),
    });
    res.json({ testimonial });
  }),
);

router.delete(
  '/testimonials/:id',
  asyncHandler(async (req, res) => {
    await prisma.testimonial.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

// ── Site settings (key/value JSON) ───────────────────────────────────────────

router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.siteSetting.findMany({ orderBy: { key: 'asc' } });
    res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  }),
);

router.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const payload = settingsSchema.parse(req.body);
    const entries = Object.entries(payload);

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } }),
      ),
    );
    await prisma.auditLog.create({
      data: { action: 'SETTINGS_UPDATE', entity: 'SiteSetting', meta: { keys: entries.map(([k]) => k) }, userId: req.user.id },
    });

    const rows = await prisma.siteSetting.findMany();
    res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  }),
);

// ── Subscribers ──────────────────────────────────────────────────────────────

router.get(
  '/subscribers',
  asyncHandler(async (_req, res) => {
    const subscribers = await prisma.subscriber.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ subscribers });
  }),
);

export default router;
