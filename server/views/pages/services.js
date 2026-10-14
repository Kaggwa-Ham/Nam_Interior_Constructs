// Services index and individual service pages.
//
// A service's `icon` field is a stable string (`kitchen`, `wardrobe`, …) that
// also tells us which project category to showcase alongside it, which is how
// a service page gets relevant photography without an explicit relation in the
// database.
//
// Every page module returns a *page descriptor* — see `docs` in `layout.js`.
// Keeping that shape uniform means the router never has to know about markup.

import config from '../../config.js';
import {
  esc,
  icon,
  label,
  pageHero,
  sectionHead,
  serviceCard,
  servicesSection,
  processList,
  ctaBand,
  projectCard,
  telHref,
  quoteWhatsApp,
  absolute,
} from '../components.js';

/// Which `ProjectCategory` best illustrates each service icon.
const ICON_TO_CATEGORY = {
  kitchen: 'KITCHENS',
  wardrobe: 'WARDROBES',
  media: 'MEDIA_WALLS',
  office: 'OFFICE_FITOUT',
  ceiling: 'CEILINGS',
  bathroom: 'BATHROOMS',
  tiling: 'TILING',
  painting: 'PAINTING',
};

/// A service stores its icon as free text; keep the SVG lookup honest.
const safeIcon = (name) => (typeof name === 'string' && name ? name : 'spark');

/// Projects that best illustrate a given service. Internal to this module — a
/// service page is the only thing that wants its own related work.
function relatedProjects(data, service, limit = 3) {
  const category = ICON_TO_CATEGORY[service.icon];
  const matched = category ? data.projects.filter((p) => p.category === category) : [];
  const pool = matched.length ? matched : data.projects.filter((p) => p.featured);
  const source = pool.length ? pool : data.projects;
  return source.slice(0, limit);
}

// ── Index ────────────────────────────────────────────────────────────────────

export function servicesPage(data) {
  const count = data.services.length;

  const body = `${pageHero({
    eyebrow: 'What we do',
    title: 'Specialist trades, one contractor',
    lede: `${count} disciplines under one roof, so nobody hands you off to somebody else halfway through the job.`,
    trail: [{ label: 'Home', href: '/' }, { label: 'Services' }],
    actions: [
      { label: 'Request a quote', href: '/contact', large: true },
      { label: 'See our work', href: '/work', variant: 'ghost', large: true },
    ],
  })}

${servicesSection(data, { center: false })}

${processList(data)}

${ctaBand(data, {
    title: 'Not sure which trades you need?',
    body: 'Describe the rooms and we will tell you exactly what is involved, in what order, and what it will cost.',
  })}`;

  return {
    active: 'services',
    path: '/services',
    title: `Services — ${data.business.name}`,
    description: `${count} interior fit-out services in Kampala: kitchens, wardrobes, media walls, office fit-outs, ceilings, bathrooms, tiling and finishes.`,
    image: data.projects[0]?.images?.[0]?.url,
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: new URL('/', config.publicUrl).href },
          { '@type': 'ListItem', position: 2, name: 'Services' },
        ],
      },
    ],
    body,
  };
}

// ── Single service ───────────────────────────────────────────────────────────

export function serviceDetailPage(data, service) {
  const { business } = data;
  const features = Array.isArray(service.features) ? service.features : [];
  const projects = relatedProjects(data, service, 3);
  const others = data.services.filter((s) => s.id !== service.id).slice(0, 3);
  const category = ICON_TO_CATEGORY[service.icon];
  const relatedLabel = category ? `${label(category)} work` : 'Related work';

  // The seeded descriptions are prose. Break on blank lines if the editor used
  // them, otherwise render the whole thing as a single paragraph.
  const paragraphs = String(service.description ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const serviceUrl = new URL(`/services/${service.slug}`, config.publicUrl).href;
  const lead = projects[0] ?? data.projects[0];
  const social = lead?.images?.[0]?.url;

  const body = `${pageHero({
    eyebrow: 'Service',
    title: service.title,
    lede: service.tagline ?? '',
    trail: [
      { label: 'Home', href: '/' },
      { label: 'Services', href: '/services' },
      { label: service.title },
    ],
    actions: [{ label: 'Request a quote', href: `/contact?service=${service.id}`, large: true }],
  })}

      <section class="section">
        <div class="container service-detail">
          <div class="service-detail-main">
            <span class="service-icon service-icon--lg" aria-hidden="true">${icon(safeIcon(service.icon))}</span>

            <div class="prose">
              ${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n              ')}
            </div>

            ${
              features.length
                ? `<div class="feature-block">
              <h2>What is included</h2>
              <ul class="feature-list">
                ${features
                  .map(
                    (f) => `<li>
                  <span class="point-mark" aria-hidden="true">${icon('check')}</span>
                  <span>${esc(f)}</span>
                </li>`,
                  )
                  .join('\n                ')}
              </ul>
            </div>`
                : ''
            }
          </div>

          <aside class="service-aside">
            <div class="aside-card">
              ${
                service.priceFrom
                  ? `<p class="aside-price">From <strong>${esc(service.priceFrom)}</strong></p>`
                  : '<p class="aside-price">Priced after a free site visit</p>'
              }
              <p class="aside-note">Fixed, itemised quote — no day-rate guessing and no surprise extras.</p>
              <a class="btn btn--lg btn--block" href="/contact?service=${esc(service.id)}">Request a quote ${icon('arrow')}</a>
              <a class="btn btn--ghost btn--block" href="${esc(quoteWhatsApp(business))}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp us</a>
              <a class="aside-phone" href="${esc(telHref(business.phone))}">${icon('phone')} ${esc(business.phone)}</a>
            </div>

            <div class="aside-card aside-card--quiet">
              <h3>Good to know</h3>
              <ul class="aside-list">
                <li>${icon('ruler')} Free site survey and measurement</li>
                <li>${icon('shield')} Written warranty on every installation</li>
                <li>${icon('clock')} Typical build: 3–8 weeks</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      ${
        projects.length
          ? `<section class="section section--tint">
        <div class="container">
          ${sectionHead({
            eyebrow: 'Recently completed',
            title: relatedLabel,
            lede: 'A few of the jobs we have handed over in and around Kampala.',
            href: '/work',
            linkLabel: 'All work',
          })}
          <div class="gallery">
${projects.map((p) => projectCard(p, { quickLook: true })).join('\n')}
          </div>
        </div>
      </section>`
          : ''
      }

      ${
        others.length
          ? `<section class="section">
        <div class="container">
          ${sectionHead({ eyebrow: 'Also available', title: 'Other services', href: '/services', linkLabel: 'All services' })}
          <div class="service-grid">
${others.map((s) => serviceCard(s, { complete: false })).join('\n')}
          </div>
        </div>
      </section>`
          : ''
      }

${ctaBand(data, {
    title: `Ready to price your ${service.title.toLowerCase()}?`,
    primary: { label: 'Request a quote', href: `/contact?service=${service.id}` },
  })}`;

  return {
    active: 'services',
    path: `/services/${service.slug}`,
    title: `${service.title} — ${business.name}`,
    description: service.tagline ?? service.description?.slice(0, 155) ?? '',
    image: social,
    ogType: 'article',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: new URL('/', config.publicUrl).href },
          { '@type': 'ListItem', position: 2, name: 'Services', item: new URL('/services', config.publicUrl).href },
          { '@type': 'ListItem', position: 3, name: service.title, item: serviceUrl },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: service.title,
        description: service.tagline ?? undefined,
        serviceType: service.title,
        url: serviceUrl,
        areaServed: 'Kampala, Uganda',
        provider: {
          '@type': 'HomeAndConstructionBusiness',
          name: business.name,
          telephone: business.phone,
          address: business.address,
        },
        offers: service.priceFrom
          ? { '@type': 'Offer', priceCurrency: 'UGX', description: `From ${service.priceFrom}` }
          : undefined,
        image: projects.flatMap((p) => p.images ?? []).slice(0, 4).map((i) => absolute(i.url)),
      },
    ],
    body,
  };
}

export default servicesPage;
