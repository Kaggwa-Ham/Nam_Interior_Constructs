// Shared building blocks for every server-rendered page.
//
// The site is a multi-page platform: `layout.js` owns the document shell and
// each page module composes the blocks exported here. Nothing in this file
// touches the database — it takes plain data and returns HTML strings.
//
// NOTE: the Content-Security-Policy forbids inline scripts, so nothing here may
// emit a `<script>` without the per-response nonce generated in `index.js`.

import config from '../config.js';

// ── Escaping & tiny utilities ────────────────────────────────────────────────

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/// Escape a value for use in HTML text or a double-quoted attribute.
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/// Safe to embed inside a `<script type="application/ld+json">` block.
export const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

/// Human labels for the `ProjectCategory` enum values.
export const CATEGORY_LABELS = {
  KITCHENS: 'Kitchen',
  WARDROBES: 'Wardrobes & joinery',
  MEDIA_WALLS: 'Media walls',
  OFFICE_FITOUT: 'Office fit-out',
  CEILINGS: 'Ceilings',
  BATHROOMS: 'Bathrooms',
  TILING: 'Tiling',
  FURNITURE: 'Fitted furniture',
  PAINTING: 'Painting & finishes',
  RENOVATION: 'Renovation',
};

export const label = (category) =>
  CATEGORY_LABELS[category] ?? String(category ?? '').replace(/_/g, ' ');

// ── Icon set ─────────────────────────────────────────────────────────────────
// Inline SVG, 24×24, stroke-based so they inherit `currentColor`.

const S = (paths) =>
  `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`;

const ICONS = {
  kitchen: S('<path d="M4 10h16M4 10V6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V10M4 10v9h16v-9"/><path d="M8 13v3M16 13v3M9.5 7.5h5"/>'),
  wardrobe: S('<rect x="5" y="3.5" width="14" height="17" rx="1.2"/><path d="M12 3.5v17M9.6 11h1.2M13.2 11h1.2"/>'),
  media: S('<rect x="3" y="4.5" width="18" height="11" rx="1.4"/><path d="M3 18.5h18M8 15.5l-1.5 3M16 15.5l1.5 3"/>'),
  office: S('<path d="M3 19.5h18M5 19.5V9h8v10.5M13 12h6v7.5M7.6 12h1.6M7.6 15h1.6M15.4 15h1.4"/>'),
  ceiling: S('<path d="M3.5 7h17M3.5 12.5h17M8.6 7v5.5M15.4 7v5.5M12 16.6v3"/><circle cx="12" cy="16.6" r="1.9"/>'),
  bathroom: S('<path d="M4 12.5h16v2.2a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M7 12.5V6.2A2.2 2.2 0 0 1 11.4 6M6 21l1-2.3M18 21l-1-2.3"/>'),
  tiling: S('<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1"/><rect x="13" y="13" width="7.5" height="7.5" rx="1"/>'),
  painting: S('<rect x="4" y="3.5" width="12" height="6" rx="1.4"/><path d="M16 5.6h3.4v4.2H10.6M10.6 9.8v3.4M8.6 13.2h4v7.3h-4z"/>'),
  spark: S('<path d="M12 3.5l2.2 5.6 5.8 2-5.8 2L12 18.8l-2.2-5.7-5.8-2 5.8-2z"/>'),
  sparkle: S('<path d="M12 3.5l2.2 5.6 5.8 2-5.8 2L12 18.8l-2.2-5.7-5.8-2 5.8-2z"/>'),
  arrow: S('<path d="M4.5 12h15M13.5 6l6 6-6 6"/>'),
  arrowLeft: S('<path d="M19.5 12h-15M10.5 6l-6 6 6 6"/>'),
  chevronLeft: S('<path d="M14.5 5.5L8 12l6.5 6.5"/>'),
  chevronRight: S('<path d="M9.5 5.5L16 12l-6.5 6.5"/>'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  menu: S('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>'),
  moon: S('<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2z"/>'),
  phone: S('<path d="M7.2 3.8h2.3l1.4 3.6-2 1.3a11.5 11.5 0 0 0 5.4 5.4l1.3-2 3.6 1.4v2.3a2.4 2.4 0 0 1-2.6 2.4C10.6 18 6 13.4 4.8 6.4a2.4 2.4 0 0 1 2.4-2.6z"/>'),
  mail: S('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.6 6.4l8.4 6 8.4-6"/>'),
  pin: S('<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>'),
  clock: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.4V12l3.2 1.9"/>'),
  ruler: S('<path d="M3.5 15.2L15.2 3.5l5.3 5.3L8.8 20.5z"/><path d="M7.4 11.3l1.8 1.8M10.3 8.4l1.8 1.8M13.2 5.5l1.8 1.8"/>'),
  shield: S('<path d="M12 3l7 2.6v5.6c0 4.4-3 8-7 9.8-4-1.8-7-5.4-7-9.8V5.6z"/><path d="M8.8 12l2.3 2.3 4.1-4.4"/>'),
  whatsapp: '<path fill="currentColor" d="M12.04 2.5A9.4 9.4 0 0 0 3.9 16.6L2.5 21.5l5.05-1.32A9.4 9.4 0 1 0 12.04 2.5Zm0 1.72a7.68 7.68 0 0 1 0 15.36 7.7 7.7 0 0 1-3.92-1.07l-.28-.17-2.99.78.8-2.92-.18-.29a7.68 7.68 0 0 1 6.57-11.69Zm-3.2 3.6c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.23.9 2.42 1.03 2.59.13.16 1.75 2.79 4.3 3.8 2.12.84 2.55.67 3.01.63.46-.04 1.49-.6 1.7-1.2.21-.58.21-1.09.15-1.19-.06-.1-.23-.16-.48-.29-.25-.12-1.49-.73-1.72-.82-.23-.08-.4-.12-.56.13-.17.25-.65.82-.8.99-.14.16-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.39.1-.51.11-.11.25-.29.38-.44.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.41-.56-.42z"/>',
  star: '<path fill="currentColor" d="M12 2.8l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.8 6.4 20l1.3-6.3L2.9 9.4l6.4-.7z"/>',
  check: S('<path d="M4.5 12.5l5 5 10-11"/>'),
  quote: S('<path d="M9.4 5.5C6.6 6.9 4.8 9.6 4.8 12.9c0 3 1.7 5.1 4.2 5.1 2 0 3.5-1.4 3.5-3.4 0-1.9-1.3-3.2-3.1-3.2-.4 0-.8.1-1 .2.3-1.6 1.6-3 3.3-3.9z"/><path d="M18.4 5.5c-2.8 1.4-4.6 4.1-4.6 7.4 0 3 1.7 5.1 4.2 5.1 2 0 3.5-1.4 3.5-3.4 0-1.9-1.3-3.2-3.1-3.2-.4 0-.8.1-1 .2.3-1.6 1.6-3 3.3-3.9z"/>'),
};

export const icon = (name, className = '') =>
  `<svg class="${className ? esc(className) : 'icon'}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] ?? ICONS.spark}</svg>`;

/// A service row stores a free-text `icon` string; fall back gracefully.
const serviceIcon = (name) => (ICONS[name] ? name : 'spark');

// ── Responsive image helper ──────────────────────────────────────────────────
// Every project image carries an intrinsic width/height plus a list of WebP
// variants, so we can emit a real `srcset` and reserve layout space (no CLS).

export function img(image, { sizes, className = '', priority = false, alt } = {}) {
  if (!image?.url) return '';

  const width = Number(image.width) || 1200;
  const height = Number(image.height) || 900;

  let variants = Array.isArray(image.sources) ? image.sources : [];
  variants = variants.filter((v) => v && v.url && Number(v.width) > 0);
  if (!variants.length) variants = [{ url: image.url, width }];
  variants.sort((a, b) => Number(b.width) - Number(a.width));

  const responsive =
    variants.length > 1
      ? ` srcset="${esc(variants.map((v) => `${v.url} ${v.width}w`).join(', '))}" sizes="${esc(sizes || '100vw')}"`
      : '';

  const loading = priority ? 'eager' : 'lazy';
  const priorityAttr = priority ? ' fetchpriority="high"' : '';

  return `<img src="${esc(image.url)}"${responsive} width="${width}" height="${height}" alt="${esc(alt ?? image.alt ?? '')}" loading="${loading}" decoding="async"${priorityAttr}${className ? ` class="${esc(className)}"` : ''}>`;
}

// ── Business helpers ─────────────────────────────────────────────────────────

export const businessInitials = (name) =>
  String(name || 'Nam Interior Constructs')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

export const telHref = (phone) => `tel:${String(phone ?? '').replace(/[^\d+]/g, '')}`;

export function whatsappLink(number, text) {
  const digits = String(number ?? '').replace(/\D/g, '');
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${query}`;
}

export const quoteWhatsApp = (business) =>
  whatsappLink(business.whatsapp, `Hello ${business.name}, I would like a quote.`);

// ── Navigation ───────────────────────────────────────────────────────────────
// Single source of truth: the header, the footer and the sitemap all read this.

export const NAV = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'services', label: 'Services', href: '/services' },
  { key: 'work', label: 'Our work', href: '/work' },
  { key: 'about', label: 'About', href: '/about' },
  { key: 'contact', label: 'Contact', href: '/contact' },
];

// ── Page furniture ───────────────────────────────────────────────────────────

/// `trail` is an array of `{ label, href }`; the final crumb is the page itself.
export function breadcrumbs(trail) {
  if (!trail?.length) return '';
  const items = trail
    .map((crumb, i) => {
      const last = i === trail.length - 1;
      return `<li>${
        last || !crumb.href
          ? `<span aria-current="page">${esc(crumb.label)}</span>`
          : `<a href="${esc(crumb.href)}">${esc(crumb.label)}</a>`
      }</li>`;
    })
    .join('');

  return `
      <nav class="crumbs" aria-label="Breadcrumb">
        <ol>${items}</ol>
      </nav>`;
}

export function pageHero({ eyebrow, title, lede, trail, actions = [] }) {
  return `
      <section class="page-hero">
        <div class="container">
          ${breadcrumbs(trail)}
          <div class="page-hero-inner">
            <div class="page-hero-copy">
              ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
              <h1>${esc(title)}</h1>
              ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
            </div>
            ${
              actions.length
                ? `<div class="page-hero-actions">${actions
                    .map(
                      (a) =>
                        `<a class="btn${a.variant ? ` btn--${a.variant}` : ''}${a.large ? ' btn--lg' : ''}" href="${esc(a.href)}"${
                          a.external ? ' target="_blank" rel="noopener"' : ''
                        }>${a.icon ? icon(a.icon) : ''}${esc(a.label)}</a>`,
                    )
                    .join('')}</div>`
                : ''
            }
          </div>
        </div>
      </section>`;
}

/// Section heading. Pass `href` to add a "view all" affordance in the right
/// column of the split layout.
export function sectionHead({ eyebrow, title, lede, href, linkLabel = 'View all', center = false }) {
  if (center) {
    return `
          <div class="section-head section-head--center">
            ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
            <h2>${esc(title)}</h2>
            ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
          </div>`;
  }

  return `
          <div class="section-head section-head--split">
            <div>
              ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
              <h2>${esc(title)}</h2>
            </div>
            <div class="section-head-aside">
              ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
              ${href ? `<a class="link-more" href="${esc(href)}">${esc(linkLabel)} ${icon('arrow')}</a>` : ''}
            </div>
          </div>`;
}

// ── Content cards ────────────────────────────────────────────────────────────

export function serviceCard(service, { complete = true } = {}) {
  const features = Array.isArray(service.features) ? service.features : [];
  const shown = complete ? features : features.slice(0, 3);

  return `
            <article class="service-card reveal">
              <span class="service-icon" aria-hidden="true">${icon(serviceIcon(service.icon))}</span>
              <h3 class="service-title"><a href="/services/${esc(service.slug)}">${esc(service.title)}</a></h3>
              <p class="service-tagline">${esc(service.tagline ?? '')}</p>
              ${
                shown.length
                  ? `<ul class="service-features">${shown.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`
                  : ''
              }
              <div class="service-foot">
                ${service.priceFrom ? `<span class="service-price">From ${esc(service.priceFrom)}</span>` : '<span></span>'}
                <a class="project-link" href="/services/${esc(service.slug)}">Details ${icon('arrow')}</a>
              </div>
            </article>`;
}

export const photoCount = (project) =>
  Array.isArray(project.images) ? project.images.length : 0;

export const coverOf = (project) =>
  project.images?.[0] ?? (project.coverImage ? { url: project.coverImage } : null);

/// The full photo set for a project, kept in an inert `<template>` so the
/// lightbox can open instantly without a second network round-trip.
export function galleryTemplate(project) {
  const shots = Array.isArray(project.images) ? project.images : [];
  if (!shots.length) return '';

  const fallbackAlt = `${project.title} — ${label(project.category)}`;
  const pool = shots
    .map(
      (shot) =>
        `<img data-src="${esc(shot.url)}"${
          Array.isArray(shot.sources) && shot.sources.length
            ? ` data-srcset="${esc(shot.sources.map((s) => `${s.url} ${s.width}w`).join(', '))}"`
            : ''
        } data-width="${Number(shot.width) || ''}" data-height="${Number(shot.height) || ''}" data-alt="${esc(shot.alt || fallbackAlt)}">`,
    )
    .join('');

  return `<template data-gallery="${esc(project.slug)}">${pool}</template>`;
}

/// `quickLook` adds a button that opens the photo viewer in place; the card
/// itself always links through to the project's own page.
export function projectCard(project, { quickLook = true, priority = false } = {}) {
  const count = photoCount(project);
  const cover = coverOf(project);
  const alt = cover?.alt || `${project.title} — ${label(project.category)}`;
  const meta = [project.location, project.year].filter(Boolean).join(' · ');

  return `
            <article class="project-card reveal" data-category="${esc(project.category)}" data-project-title="${esc(project.title)}">
              <a class="project-media" href="/work/${esc(project.slug)}">
                ${img(cover, {
                  sizes: '(max-width: 700px) 92vw, (max-width: 1100px) 46vw, 30vw',
                  priority,
                  alt,
                })}
                <span class="project-zoom">${icon('spark')} ${count ? `${count} photo${count === 1 ? '' : 's'}` : 'View'}</span>
              </a>
              <div class="project-body">
                <div class="project-tags">
                  <span class="tag">${esc(label(project.category))}</span>
                  ${meta ? `<span class="tag tag--plain">${esc(meta)}</span>` : ''}
                </div>
                <h3 class="project-title"><a href="/work/${esc(project.slug)}">${esc(project.title)}</a></h3>
                ${project.summary ? `<p class="project-summary">${esc(project.summary)}</p>` : ''}
                <div class="project-actions">
                  <a class="project-link" href="/work/${esc(project.slug)}">View project ${icon('arrow')}</a>
                  ${
                    quickLook && count
                      ? `<button class="project-quick" type="button" data-open-gallery="${esc(project.slug)}">Quick look</button>`
                      : ''
                  }
                </div>
              </div>
              ${quickLook ? galleryTemplate(project) : ''}
            </article>`;
}

export function testimonialCard(t) {
  const rating = Math.max(0, Math.min(5, Number(t.rating) || 5));
  const initials = String(t.name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return `
            <figure class="quote-card reveal">
              <div class="stars" role="img" aria-label="${rating} out of 5 stars">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</div>
              <blockquote class="quote-text">${esc(t.quote)}</blockquote>
              <figcaption class="quote-author">
                <span class="avatar" aria-hidden="true">${esc(initials)}</span>
                <span class="quote-name">
                  <strong>${esc(t.name)}</strong>
                  ${t.role ? `<span>${esc(t.role)}</span>` : ''}
                </span>
              </figcaption>
            </figure>`;
}

// ── Reusable sections ────────────────────────────────────────────────────────

export function marquee(data) {
  const items = [
    ...data.services.map((s) => s.title),
    'Site survey',
    'Fixed pricing',
    'Own workshop',
    'Handover snagging',
  ];
  if (!items.length) return '';

  const group = items.map((t) => `<span class="marquee-item">${esc(t)}</span>`).join('');

  return `
      <div class="marquee" aria-hidden="true">
        <div class="marquee-track">
          <div class="marquee-group">${group}</div>
          <div class="marquee-group">${group}</div>
        </div>
      </div>`;
}

export function heroSection(data) {
  const { settings, projects, services, business } = data;
  const hero = settings.hero ?? {};
  const stats = Array.isArray(hero.stats) ? hero.stats : [];
  const serviceCount = services.length || 8;

  const picks = [];
  for (const project of projects) {
    const shot = project.images?.[0];
    if (shot) picks.push({ shot, project });
    if (picks.length === 3) break;
  }

  const collage = picks
    .map(({ shot, project }, i) =>
      img(shot, {
        className: `hero-shot hero-shot--${i + 1}`,
        sizes: '(max-width: 900px) 46vw, 22vw',
        priority: i === 0,
        alt: shot.alt || `${project.title} — ${label(project.category)}`,
      }),
    )
    .join('\n            ');

  return `
      <section class="hero" id="top">
        <div class="container hero-grid">
          <div class="hero-copy">
            <p class="eyebrow">${esc(hero.eyebrow ?? '')}</p>
            <h1 class="hero-title">
              ${esc(hero.headline ?? business.name)}
              <span class="hero-accent">${esc(hero.headlineAccent ?? '')}</span>
            </h1>
            <p class="hero-sub">${esc(hero.subtext ?? '')}</p>
            <div class="hero-cta">
              <a class="btn btn--lg" href="/contact">${esc(hero.primaryCta ?? 'Request a quote')} ${icon('arrow')}</a>
              <a class="btn btn--lg btn--ghost" href="/work">${esc(hero.secondaryCta ?? 'See our work')}</a>
            </div>
            ${
              stats.length
                ? `<dl class="stats">
              ${stats
                .slice(0, 4)
                .map(
                  (s) => `<div>
                <dt class="stat-label">${esc(s.label)}</dt>
                <dd class="stat-value">${esc(s.value)}</dd>
              </div>`,
                )
                .join('\n              ')}
            </dl>`
                : ''
            }
          </div>

          <div class="hero-media">
            <div class="hero-collage">
            ${collage}
            </div>
            <p class="hero-badge">${icon('check')} ${serviceCount} trades, one contractor</p>
          </div>
        </div>
      </section>`;
}

export function servicesSection(data, { limit, center = false } = {}) {
  const list = limit ? data.services.slice(0, limit) : data.services;
  if (!list.length) return '';

  const cards = list.map((s) => serviceCard(s, { complete: !limit })).join('\n');
  const total = data.services.length;

  return `
      <section class="section" id="services">
        <div class="container">
          ${sectionHead({
            eyebrow: 'What we do',
            title: 'Specialist trades, one contractor',
            lede: `${total} ${total === 1 ? 'discipline' : 'disciplines'} under one roof, so nobody hands you off to somebody else halfway through the job.`,
            href: limit ? '/services' : undefined,
            linkLabel: 'All services',
            center,
          })}
          <div class="service-grid">
${cards}
          </div>
          ${
            limit && data.services.length > limit
              ? `<p class="section-foot"><a class="btn btn--ghost btn--lg" href="/services">See all ${data.services.length} services ${icon('arrow')}</a></p>`
              : ''
          }
        </div>
      </section>`;
}

/// Picks `limit` projects, preferring ones flagged as featured.
export function featuredProjects(data, limit = 3) {
  const featured = data.projects.filter((p) => p.featured);
  const rest = data.projects.filter((p) => !p.featured);
  return [...featured, ...rest].slice(0, limit);
}

export function projectGrid(projects, { quickLook = true, priorityFirst = false } = {}) {
  return projects
    .map((p, i) => projectCard(p, { quickLook, priority: priorityFirst && i === 0 }))
    .join('\n');
}

export function processList(data) {
  const process = data.settings.process ?? {};
  const steps = Array.isArray(process.steps) ? process.steps : [];
  if (!steps.length) return '';

  return `
      <section class="section" id="process">
        <div class="container">
          ${sectionHead({
            eyebrow: 'Our process',
            title: process.heading ?? 'How it works',
            lede: 'Five stages, no surprises. You always know what happens next and what it costs.',
            center: true,
          })}
          <ol class="process-list">
            ${steps
              .map(
                (step, i) => `<li class="step reveal">
              <span class="step-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
              <div class="step-content">
                <h3 class="step-title">${esc(step.title)}</h3>
                <p class="step-body">${esc(step.body)}</p>
              </div>
            </li>`,
              )
              .join('\n            ')}
          </ol>
        </div>
      </section>`;
}

/// A wide installation shot reads better than a portrait crop.
const landscapeShot = (data) =>
  data.projects.flatMap((p) => p.images ?? []).find((i) => (Number(i.width) || 0) >= (Number(i.height) || 0)) ??
  data.projects[0]?.images?.[1] ??
  data.projects[0]?.images?.[0];

export function aboutSection(data) {
  const about = data.settings.about ?? {};
  const points = Array.isArray(about.points) ? about.points : [];
  const shot = landscapeShot(data);

  return `
      <section class="section section--surface" id="about">
        <div class="container about-grid">
          <div class="about-media reveal">
            ${img(shot, {
              sizes: '(max-width: 900px) 92vw, 46vw',
              alt: shot?.alt || `Inside a completed ${data.business.name} installation`,
            })}
          </div>
          <div class="about-body">
            <p class="eyebrow">Who we are</p>
            <h2>${esc(about.heading ?? 'About us')}</h2>
            <p class="lede">${esc(about.body ?? '')}</p>
            ${
              points.length
                ? `<ul class="about-points">
              ${points
                .map(
                  (p) => `<li class="point">
                <span class="point-mark" aria-hidden="true">${icon('check')}</span>
                <span>${esc(p)}</span>
              </li>`,
                )
                .join('\n              ')}
            </ul>`
                : ''
            }
            <div class="hero-cta">
              <a class="btn" href="/contact">Start your project ${icon('arrow')}</a>
              <a class="btn btn--ghost" href="/work">See the work</a>
            </div>
          </div>
        </div>
      </section>`;
}

/// A dark call-to-action band used at the foot of most pages.
export function ctaBand(data, { title, body, primary = { label: 'Request a quote', href: '/contact' } } = {}) {
  const { business } = data;
  const heading = title ?? 'Ready to price your project?';

  return `
      <section class="cta-band">
        <div class="container cta-band-inner">
          <div>
            <p class="eyebrow">Next step</p>
            <h2>${esc(heading)}</h2>
            <p class="lede">${esc(body ?? 'Send us the rooms and rough sizes. We will come back with a fixed, itemised quote after a free site visit.')}</p>
          </div>
          <div class="cta-actions">
            <a class="btn btn--lg" href="${esc(primary.href)}">${esc(primary.label)} ${icon('arrow')}</a>
            <a class="btn btn--lg btn--ghost" href="${esc(quoteWhatsApp(business))}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp</a>
            <a class="cta-phone" href="${esc(telHref(business.phone))}">${icon('phone')} ${esc(business.phone)}</a>
          </div>
        </div>
      </section>`;
}

/// Prev/next navigation between sibling records (projects, services).
export function pager(prev, next, { base }) {
  if (!prev && !next) return '';

  const link = (item, dir) =>
    item
      ? `<a class="pager-link pager-link--${dir}" href="${esc(base)}/${esc(item.slug)}">
              <span class="pager-dir">${dir === 'prev' ? icon('arrowLeft') + ' Previous' : 'Next ' + icon('arrow')}</span>
              <span class="pager-title">${esc(item.title)}</span>
            </a>`
      : '<span></span>';

  return `
      <nav class="pager" aria-label="More like this">
        ${link(prev, 'prev')}
        ${link(next, 'next')}
      </nav>`;
}

// ── Structured data ──────────────────────────────────────────────────────────

export function businessGraph(data) {
  const { business, services, projects, testimonials } = data;
  const rated = testimonials.filter((t) => Number(t.rating) > 0);

  return {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    name: business.name,
    description: data.settings.seo?.description,
    url: config.publicUrl,
    telephone: business.phone,
    email: business.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.address,
      addressLocality: 'Kampala',
      addressCountry: 'UG',
    },
    areaServed: 'Kampala, Uganda',
    image: projects[0]?.images?.[0]?.url
      ? new URL(projects[0].images[0].url, config.publicUrl).href
      : undefined,
    makesOffer: services.map((s) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: s.title, description: s.tagline ?? undefined },
    })),
    aggregateRating: rated.length
      ? {
          '@type': 'AggregateRating',
          ratingValue: (rated.reduce((sum, t) => sum + Number(t.rating), 0) / rated.length).toFixed(1),
          reviewCount: rated.length,
          bestRating: 5,
        }
      : undefined,
  };
}

export const absolute = (url) => (url ? new URL(url, config.publicUrl).href : '');
