// Server-rendered pages.
//
// Mounted between the static-file middleware and the `/:page` clean-URL
// handler, so a real file on disk always wins over a rendered page. That keeps
// `public/index.html` usable as a fallback if the database is unreachable.
//
// Every route follows the same three steps:
//   1. load the site data (one function, one shape)
//   2. ask a page module for a *descriptor* (`{ active, title, body, … }`)
//   3. hand that descriptor to `renderPage`, which owns the document shell
//
// Keeping markup out of the router means a page can be redesigned without
// touching routing, and the router never has to know about HTML.

import express from 'express';
import config from '../config.js';
import { asyncHandler } from '../middleware/errors.js';
import { loadSiteData } from '../lib/site-data.js';
import { renderPage } from '../views/layout.js';
import { esc, pageHero, ctaBand, icon } from '../views/components.js';
import { homePage } from '../views/pages/home.js';
import { servicesPage, serviceDetailPage } from '../views/pages/services.js';
import { workPage, projectDetailPage } from '../views/pages/work.js';
import { aboutPage } from '../views/pages/about.js';
import { contactPage } from '../views/pages/contact.js';
import { offlinePage } from '../views/pages/offline.js';

const router = express.Router();

// ── Shared plumbing ──────────────────────────────────────────────────────────

/// Renders a descriptor into a full document and sends it.
///
/// A descriptor may carry `__status` (used by the 404 paths); it is stripped
/// before it reaches the layout so only real options are forwarded.
///
/// Never cached: the content comes from the database and changes whenever the
/// team edits a project or the hero copy in the dashboard.
function send(res, data, descriptor) {
  const { __status = 200, ...page } = descriptor;
  const html = renderPage({ data, nonce: res.locals.cspNonce, ...page });
  res.setHeader('Cache-Control', 'no-cache');
  return res.status(__status).type('html').send(html);
}

/// Loads the data and renders, or degrades to the offline page.
///
/// The offline page is deliberately dependency-free: it uses only environment
/// variables, so it still works when Postgres is the thing that is broken.
async function render(res, build) {
  let data;
  try {
    data = await loadSiteData();
  } catch (err) {
    console.error('[pages] Could not load site data:', err.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).type('html').send(offlinePage());
  }

  try {
    return send(res, data, build(data));
  } catch (err) {
    // A rendering bug should never surface as a stack trace to a customer.
    console.error('[pages] Render failed:', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).type('html').send(offlinePage());
  }
}

/// A 404 that still has the site header and footer around it.
function notFound(data, heading = 'Page not found', message = 'That page has moved or never existed. The links below should get you back on track.') {
  return {
    __status: 404,
    active: '',
    path: '/404',
    title: `Page not found — ${data.business.name}`,
    description: 'The page you were looking for could not be found.',
    noindex: true,
    structuredData: [],
    body: `${pageHero({
      eyebrow: '404',
      title: heading,
      lede: message,
      actions: [
        { label: 'Back to home', href: '/', large: true },
        { label: 'See our work', href: '/work', variant: 'ghost', large: true },
      ],
    })}

      <section class="section">
        <div class="container">
          <div class="service-grid">
            ${data.services
              .slice(0, 3)
              .map(
                (s) => `<article class="service-card">
              <span class="service-icon" aria-hidden="true">${icon('spark')}</span>
              <h3 class="service-title"><a href="/services/${esc(s.slug)}">${esc(s.title)}</a></h3>
              <p class="service-tagline">${esc(s.tagline ?? '')}</p>
              <div class="service-foot"><span></span><a class="project-link" href="/services/${esc(s.slug)}">Details ${icon('arrow')}</a></div>
            </article>`,
              )
              .join('\n')}
          </div>
        </div>
      </section>

${ctaBand(data, { title: 'Cannot find what you need?', body: 'Tell us what you are looking for and we will point you in the right direction.' })}`,
  };
}

// ── Home ─────────────────────────────────────────────────────────────────────

router.get(
  '/',
  asyncHandler((req, res) => render(res, (data) => homePage(data))),
);

// ── Services ─────────────────────────────────────────────────────────────────

router.get(
  '/services',
  asyncHandler((req, res) => render(res, (data) => servicesPage(data))),
);

router.get(
  '/services/:slug',
  asyncHandler((req, res) =>
    render(res, (data) => {
      const service = data.services.find((s) => s.slug === req.params.slug);
      if (!service) {
        return notFound(data, 'Service not found', 'We do not offer a service under that name — here is everything we do.');
      }
      return serviceDetailPage(data, service);
    }),
  ),
);

// ── Work ─────────────────────────────────────────────────────────────────────

router.get(
  '/work',
  asyncHandler((req, res) => render(res, (data) => workPage(data))),
);

router.get(
  '/work/:slug',
  asyncHandler((req, res) =>
    render(res, (data) => {
      const project = data.projects.find((p) => p.slug === req.params.slug);
      if (!project) {
        return notFound(data, 'Project not found', 'That project is no longer published. Everything we have is on the work page.');
      }
      return projectDetailPage(data, project);
    }),
  ),
);

// ── About ────────────────────────────────────────────────────────────────────

router.get(
  '/about',
  asyncHandler((req, res) => render(res, (data) => aboutPage(data))),
);

// ── Contact ──────────────────────────────────────────────────────────────────

router.get(
  '/contact',
  asyncHandler((req, res) =>
    render(res, (data) => {
      // `?service=<id>` comes from the "request a quote" buttons on service
      // pages. Validate it against real records so a hand-edited URL cannot
      // pre-select an option that does not exist.
      const raw = Array.isArray(req.query.service) ? req.query.service[0] : req.query.service;
      const candidate = typeof raw === 'string' ? raw.slice(0, 64) : '';
      const valid = candidate === 'other' || data.services.some((s) => s.id === candidate);

      return contactPage(data, { serviceId: valid ? candidate : '' });
    }),
  ),
);

// ── robots.txt ───────────────────────────────────────────────────────────────

router.get('/robots.txt', (req, res) => {
  const base = config.publicUrl.replace(/\/$/, '');
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      // The dashboard and the API hold client data and have nothing to index.
      'Disallow: /admin/',
      'Disallow: /api/',
      'Disallow: /uploads/',
      '',
      `Sitemap: ${base}/sitemap.xml`,
      '',
    ].join('\n'),
  );
});

// ── sitemap.xml ──────────────────────────────────────────────────────────────
// Generated rather than static so the hostname always matches PUBLIC_URL,
// which differs between local development and production.

router.get(
  '/sitemap.xml',
  asyncHandler(async (_req, res) => {
    const base = config.publicUrl.replace(/\/$/, '');
    const data = await loadSiteData();
    const lastmod = new Date().toISOString().slice(0, 10);
    const cover = data.projects[0]?.images?.[0]?.url;

    const urls = [
      { loc: `${base}/`, priority: '1.0', image: cover ? new URL(cover, config.publicUrl).href : null },
      { loc: `${base}/services`, priority: '0.9' },
      { loc: `${base}/work`, priority: '0.9' },
      { loc: `${base}/about`, priority: '0.7' },
      { loc: `${base}/contact`, priority: '0.8' },
      ...data.services.map((s) => ({
        loc: `${base}/services/${encodeURIComponent(s.slug)}`,
        priority: '0.8',
      })),
      ...data.projects.map((p) => ({
        loc: `${base}/work/${encodeURIComponent(p.slug)}`,
        priority: '0.7',
        image: p.images?.[0]?.url ? new URL(p.images[0].url, config.publicUrl).href : null,
      })),
    ];

    const body = urls
      .map(
        (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u.priority}</priority>${
      u.image ? `\n    <image:image><image:loc>${u.image}</image:loc></image:image>` : ''
    }
  </url>`,
      )
      .join('\n');

    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body}
</urlset>
`,
    );
  }),
);

export default router;
