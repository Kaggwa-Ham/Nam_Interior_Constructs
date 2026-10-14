// Work index and individual project pages.

import config from '../../config.js';
import {
  esc,
  icon,
  img,
  label,
  pageHero,
  sectionHead,
  projectCard,
  galleryTemplate,
  photoCount,
  coverOf,
  pager,
  ctaBand,
  absolute,
} from '../components.js';

/// The projects either side of `project` in the published list.
export function siblings(data, project) {
  const list = data.projects;
  const i = list.findIndex((p) => p.id === project.id);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: list[(i - 1 + list.length) % list.length] ?? null,
    next: list[(i + 1) % list.length] ?? null,
  };
}

// ── Index ────────────────────────────────────────────────────────────────────

export function workPage(data) {
  const { meta } = data;
  const count = meta.projectCount;

  const chips = [
    '<button class="chip" type="button" data-filter="all" aria-pressed="true">All work</button>',
    ...meta.categories.map(
      (c) =>
        `<button class="chip" type="button" data-filter="${esc(c)}" aria-pressed="false">${esc(label(c))} (${data.projects.filter((p) => p.category === c).length})</button>`,
    ),
  ].join('\n            ');

  const body = `${pageHero({
    eyebrow: 'Selected projects',
    title: 'Work you can stand inside',
    lede: `${count} documented ${count === 1 ? 'project' : 'projects'}, every one on the site above photographed on handover day — not stock imagery.`,
    trail: [{ label: 'Home', href: '/' }, { label: 'Our work' }],
    actions: [{ label: 'Request a quote', href: '/contact', large: true }],
  })}

      <section class="section">
        <div class="container">
          <div class="filter-bar" role="group" aria-label="Filter projects by category">
            ${chips}
          </div>
          <div class="gallery" id="gallery">
${data.projects.map((p) => projectCard(p, { quickLook: true })).join('\n')}
          </div>
          <p class="gallery-empty" id="galleryEmpty" hidden>No projects in this category yet — try another filter.</p>
        </div>
      </section>

${ctaBand(data, {
    title: 'Want something like one of these?',
    body: 'Tell us which project caught your eye and we will price a version of it for your space.',
  })}`;

  return {
    active: 'work',
    path: '/work',
    title: `Our work — ${data.business.name}`,
    description: `${count} completed interior fit-out projects in Kampala — kitchens, wardrobes, media walls and full renovations, photographed on handover.`,
    image: data.projects[0]?.images?.[0]?.url,
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: new URL('/', config.publicUrl).href },
          { '@type': 'ListItem', position: 2, name: 'Our work' },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Our work',
        url: new URL('/work', config.publicUrl).href,
        hasPart: data.projects.map((p) => ({
          '@type': 'ImageGallery',
          name: p.title,
          url: new URL(`/work/${p.slug}`, config.publicUrl).href,
        })),
      },
    ],
    body,
  };
}

// ── Single project ───────────────────────────────────────────────────────────

export function projectDetailPage(data, project) {
  const { business } = data;
  const shots = Array.isArray(project.images) ? project.images : [];
  const cover = coverOf(project);
  const count = photoCount(project);
  const category = label(project.category);
  const { prev, next } = siblings(data, project);

  const facts = [
    ['Space', category],
    ['Location', project.location],
    ['Completed', project.year ? String(project.year) : ''],
    ['Photographs', count ? String(count) : ''],
  ].filter(([, v]) => v);

  // The first photo spans the full width of the grid, which avoids showing the
  // cover twice (once as a hero, once as the first thumbnail).
  const cells = shots
    .map(
      (shot, i) => `<button class="gallery-cell${i === 0 ? ' is-lead' : ''}" type="button" data-open-gallery="${esc(project.slug)}" data-gallery-index="${i}" aria-label="Open photo ${i + 1} of ${count}">
              ${img(shot, {
                sizes: i === 0 ? '(max-width: 900px) 94vw, 74vw' : '(max-width: 700px) 46vw, 32vw',
                priority: i === 0,
                alt: shot.alt || `${project.title} — photo ${i + 1}`,
              })}
            </button>`,
    )
    .join('\n            ');

  const longDescription =
    project.description && String(project.description).trim().length > String(project.summary ?? '').length
      ? String(project.description).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
      : [];

  const body = `${pageHero({
    eyebrow: category,
    title: project.title,
    lede: project.summary ?? '',
    trail: [
      { label: 'Home', href: '/' },
      { label: 'Our work', href: '/work' },
      { label: project.title },
    ],
    actions: [{ label: 'Get a quote like this', href: '/contact', large: true }],
  })}

      <section class="section section--tight">
        <div class="container">
          <dl class="project-facts">
            ${facts
              .map(
                ([k, v]) => `<div class="fact">
              <dt>${esc(k)}</dt>
              <dd>${esc(v)}</dd>
            </div>`,
              )
              .join('\n            ')}
          </dl>

          ${
            longDescription.length
              ? `<div class="prose project-prose">
            ${longDescription.map((p) => `<p>${esc(p)}</p>`).join('\n            ')}
          </div>`
              : ''
          }
        </div>
      </section>

      <section class="section section--tight" data-project-title="${esc(project.title)}">
        <div class="container">
          <div class="gallery-grid">
            ${cells}
          </div>
          ${galleryTemplate(project)}
          <p class="gallery-hint">${icon('spark')} Tap any photo to open the full-size viewer — use the arrow keys to move through the set.</p>
        </div>
      </section>

      <div class="container">
${pager(prev, next, { base: '/work' })}
      </div>

${ctaBand(data, {
    title: `Want this standard in your ${category.toLowerCase()}?`,
    body: 'Send us your room sizes and we will come back with a fixed, itemised quote after a free site visit.',
  })}`;

  return {
    active: 'work',
    path: `/work/${project.slug}`,
    title: `${project.title} — ${business.name}`,
    description: project.summary ?? '',
    image: cover?.url,
    ogType: 'article',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: new URL('/', config.publicUrl).href },
          { '@type': 'ListItem', position: 2, name: 'Our work', item: new URL('/work', config.publicUrl).href },
          { '@type': 'ListItem', position: 3, name: project.title },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ImageGallery',
        name: project.title,
        description: project.summary ?? undefined,
        url: new URL(`/work/${project.slug}`, config.publicUrl).href,
        image: shots.map((s) => absolute(s.url)),
        about: category,
        locationCreated: project.location,
        dateCreated: project.year ? String(project.year) : undefined,
        creator: { '@type': 'HomeAndConstructionBusiness', name: business.name },
      },
    ],
    body,
  };
}

export default workPage;
