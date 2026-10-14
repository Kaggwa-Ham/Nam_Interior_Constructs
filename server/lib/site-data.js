// Single source of truth for the marketing site's content.
//
// Both the JSON API (`GET /api/bootstrap`) and the server-rendered homepage
// read from here, so the HTML and the API can never drift apart.

import prisma from '../db.js';
import config from '../config.js';

/// The image fields the front end needs to build a responsive `srcset`.
const IMAGE_SELECT = { url: true, alt: true, width: true, height: true, sources: true };

export async function loadSiteData() {
  const [services, projects, testimonials, settings] = await Promise.all([
    prisma.service.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      select: {
        id: true, slug: true, title: true, tagline: true, description: true,
        icon: true, features: true, priceFrom: true, coverImage: true,
      },
    }),
    prisma.project.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true, slug: true, title: true, category: true, location: true, year: true,
        summary: true, description: true, coverImage: true, featured: true,
        images: { orderBy: { sortOrder: 'asc' }, select: IMAGE_SELECT },
      },
    }),
    prisma.testimonial.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, name: true, role: true, quote: true, rating: true },
    }),
    prisma.siteSetting.findMany(),
  ]);

  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return {
    business: config.business,
    services,
    projects,
    testimonials,
    settings: settingsMap,
    meta: {
      projectCount: projects.length,
      categories: [...new Set(projects.map((p) => p.category))].sort(),
    },
  };
}

export default loadSiteData;
