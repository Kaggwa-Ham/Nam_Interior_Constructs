// Home page — a curated overview. Deliberately short: it introduces the
// business and hands off to the deeper pages rather than duplicating them.

import {
  heroSection,
  marquee,
  servicesSection,
  sectionHead,
  featuredProjects,
  projectGrid,
  processList,
  testimonialCard,
  ctaBand,
} from '../components.js';

export function homePage(data) {
  const { business, settings, meta, testimonials } = data;
  const seo = settings.seo ?? {};
  const featured = featuredProjects(data, 3);
  const quotes = testimonials.slice(0, 3);

  const body = `${heroSection(data)}
${marquee(data)}
${servicesSection(data, { limit: 4 })}

      <section class="section section--tint">
        <div class="container">
          ${sectionHead({
            eyebrow: 'Selected projects',
            title: 'Work you can stand inside',
            lede: `Real installations, photographed on handover day — ${meta.projectCount} projects documented so far.`,
            href: '/work',
            linkLabel: 'All work',
          })}
          <div class="gallery">
${projectGrid(featured, { quickLook: false, priorityFirst: true })}
          </div>
        </div>
      </section>

${processList(data)}

      ${
        quotes.length
          ? `<section class="section section--surface">
        <div class="container">
          ${sectionHead({
            eyebrow: 'Client feedback',
            title: 'What it is like to work with us',
            lede: 'Every review is from a client in Kampala who let us photograph the finished job.',
            href: '/about',
            linkLabel: 'More about us',
          })}
          <div class="quote-grid">
${quotes.map(testimonialCard).join('\n')}
          </div>
        </div>
      </section>`
          : ''
      }

${ctaBand(data)}`;

  return {
    active: 'home',
    path: '/',
    title: seo.title ?? `${business.name} — Interior fit-out in Kampala`,
    description: seo.description ?? '',
    image: featured[0]?.images?.[0]?.url ?? data.projects[0]?.images?.[0]?.url,
    // The homepage carries the full business graph (address, offers, ratings)
    // rather than a bare WebSite node — the router supplies it.
    structuredData: [],
    body,
    home: true,
  };
}

export default homePage;
