// Admin: manage portfolio projects and their galleries.

import express from 'express';
import prisma from '../db.js';
import { asyncHandler, conflict, notFound } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { projectSchema } from '../lib/validation.js';

const router = express.Router();
router.use(requireAuth);

/// Turns a project title into a unique, URL-safe slug.
async function uniqueSlug(desired, excludeId = null) {
  const base =
    desired ||
    'project';
  let slug = base;
  let n = 2;
  // Loop rather than trusting a single check, in case of concurrent inserts.
  for (;;) {
    const clash = await prisma.project.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${base}-${n++}`;
  }
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.category && req.query.category !== 'ALL') where.category = String(req.query.category).toUpperCase();
    if (req.query.published === 'true') where.published = true;
    if (req.query.published === 'false') where.published = false;

    if (req.query.q) {
      const term = String(req.query.q).trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { location: { contains: term, mode: 'insensitive' } },
        { summary: { contains: term, mode: 'insensitive' } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { images: { orderBy: { sortOrder: 'asc' } }, _count: { select: { images: true } } },
    });
    res.json({ projects });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!project) throw notFound('That project no longer exists.');
    res.json({ project });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = projectSchema.parse(req.body);
    const { images, ...fields } = data;

    const project = await prisma.project.create({
      data: {
        ...fields,
        slug: await uniqueSlug(fields.slug),
        images: images?.length
          ? { create: images.map((img, i) => ({ url: img.url, alt: img.alt || fields.title, sortOrder: i })) }
          : undefined,
      },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });

    await prisma.auditLog.create({
      data: { action: 'PROJECT_CREATE', entity: 'Project', entityId: project.id, userId: req.user.id },
    });
    res.status(201).json({ project });
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = projectSchema.parse(req.body);
    const { images, ...fields } = data;

    const existing = await prisma.project.findUnique({ where: { id: req.params.id }, select: { id: true, slug: true } });
    if (!existing) throw notFound('That project no longer exists.');

    // Only spend a slug lookup if the slug actually changed.
    const slug =
      fields.slug && fields.slug !== existing.slug ? await uniqueSlug(fields.slug, existing.id) : existing.slug;

    const project = await prisma.$transaction(async (tx) => {
      if (images) {
        // Replace the gallery wholesale — simpler and always consistent.
        await tx.projectImage.deleteMany({ where: { projectId: existing.id } });
      }
      return tx.project.update({
        where: { id: existing.id },
        data: {
          ...fields,
          slug,
          ...(images
            ? {
                images: {
                  create: images.map((img, i) => ({
                    url: img.url,
                    alt: img.alt || fields.title,
                    sortOrder: i,
                  })),
                },
              }
            : {}),
        },
        include: { images: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    await prisma.auditLog.create({
      data: { action: 'PROJECT_UPDATE', entity: 'Project', entityId: project.id, userId: req.user.id },
    });
    res.json({ project });
  }),
);

router.patch(
  '/:id/featured',
  asyncHandler(async (req, res) => {
    const current = await prisma.project.findUnique({ where: { id: req.params.id }, select: { featured: true } });
    if (!current) throw notFound();
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { featured: !current.featured },
      select: { id: true, featured: true },
    });
    res.json({ project });
  }),
);

router.patch(
  '/:id/published',
  asyncHandler(async (req, res) => {
    const current = await prisma.project.findUnique({ where: { id: req.params.id }, select: { published: true } });
    if (!current) throw notFound();
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { published: !current.published },
      select: { id: true, published: true },
    });
    res.json({ project });
  }),
);

/// Reorders the whole list in one call. Body: { ids: [...] } in display order.
router.post(
  '/reorder',
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    if (!ids) throw conflict('Expected an `ids` array.');
    await prisma.$transaction(
      ids.map((id, index) => prisma.project.update({ where: { id }, data: { sortOrder: index } })),
    );
    res.json({ ok: true });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const project = await prisma.project.delete({ where: { id: req.params.id }, select: { id: true } });
    await prisma.auditLog.create({
      data: { action: 'PROJECT_DELETE', entity: 'Project', entityId: project.id, userId: req.user.id },
    });
    res.json({ ok: true });
  }),
);

export default router;
