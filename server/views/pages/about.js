// About page — the story, the process and every review we have.

import config from '../../config.js';
import {
  pageHero,
  aboutSection,
  processList,
  sectionHead,
  testimonialCard,
  ctaBand,
  esc,
} from '../components.js';

export function aboutPage(data) {
  const { settings, business, testimonials, meta } = data;
  const hero = settings.hero ?? {};
  const stats = Array.isArray(hero.stats) ? hero.stats : [];
  const services = data.services.length;
  const photos = data.projects.reduce((n, p) => n + (p.images?.length ?? 0), 0);

  const proof = [
    { value: String(meta.projectCount), label: 'Projects documented' },
    { value: String(services), label: 'Trades in house' },
    { value: String(photos), label: 'Site photographs' },
    { value: String(business.address.split(',')[0] || 'Kampala'), label: 'Based in' },
  ];

  const body = `${pageHero({
    eyebrow: 'Who we are',
    title: `${business.name}`,
    lede: `Interior fit-out in Kampala — ${services} specialist trades, one contractor, one point of contact from survey to handover.`,
    trail: [{ label: 'Home', href: '/' }, { label: 'About' }],
    actions: [
      { label: 'Talk to us', href: '/contact', large: true },
      { label: 'See our work', href: '/work', variant: 'ghost', large: true },
    ],
  })}

${aboutSection(data)}

      <section class="section">
        <div class="container">
          <div class="proof-grid">
            ${proof
              .map(
                (p) => `<div class="proof">
              <strong>${esc(p.value)}</strong>
              <span>${esc(p.label)}</span>
            </div>`,
              )
              .join('\n            ')}
          </div>
        </div>
      </section>

${processList(data)}

      ${
        stats.length
          ? `<section class="section section--tint">
        <div class="container">
          <div class="section-head section-head--center">
            <p class="eyebrow">By the numbers</p>
            <h2>What a project looks like</h2>
          </div>
          <dl class="stats stats--wide">
            ${stats
              .map(
                (s) => `<div>
              <dt class="stat-label">${esc(s.label)}</dt>
              <dd class="stat-value">${esc(s.value)}</dd>
            </div>`,
              )
              .join('\n            ')}
          </dl>
        </div>
      </section>`
          : ''
      }

      ${
        testimonials.length
          ? `<section class="section">
        <div class="container">
          ${sectionHead({
            eyebrow: 'Client feedback',
            title: 'What it is like to work with us',
            lede: 'Unedited, and every one from a client who let us photograph the finished job.',
          })}
          <div class="quote-grid">
${testimonials.map(testimonialCard).join('\n')}
          </div>
        </div>
      </section>`
          : ''
      }

${ctaBand(data, {
    title: 'Come and see a job in progress',
    body: 'Ask for a site visit and we will show you a live installation before you commit to anything.',
  })}`;

  return {
    active: 'about',
    path: '/about',
    title: `About us — ${business.name}`,
    description: `Interior fit-out in Kampala. ${services} specialist trades under one contractor, ${meta.projectCount} documented projects.`,
    image: data.projects[0]?.images?.[0]?.url,
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: new URL('/', config.publicUrl).href },
          { '@type': 'ListItem', position: 2, name: 'About' },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: `About ${business.name}`,
        url: new URL('/about', config.publicUrl).href,
      },
    ],
    body,
  };
}

export default aboutPage;
