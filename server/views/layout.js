// The document shell shared by every page.
//
// The site is deliberately server-rendered: crawlers, link-preview bots (this
// site gets shared over WhatsApp a lot) and visitors on slow connections all
// see the real content immediately. `public/app.js` only layers enhancements on
// top, so every page here must read correctly with JavaScript disabled.
//
// NOTE: the Content-Security-Policy forbids inline scripts. The only inline
// `<script>` allowed is the `application/ld+json` block, which carries the
// per-response nonce generated in `server/index.js`.

import config from '../config.js';
import { asset } from '../lib/asset-version.js';
import {
  esc,
  json,
  icon,
  NAV,
  businessGraph,
  businessInitials,
  quoteWhatsApp,
  telHref,
} from './components.js';

// ── Header ───────────────────────────────────────────────────────────────────

function renderHeader(data, { active }) {
  const { business } = data;

  return `
        <header class="site-header" id="siteHeader">
          <div class="scroll-progress" id="scrollProgress" aria-hidden="true"><span></span></div>
          <div class="container header-inner">
            <a class="brand" href="/" aria-label="${esc(business.name)} — home">
              <span class="brand-mark" aria-hidden="true">${esc(businessInitials(business.name))}</span>
              <span class="brand-text">
                <strong>${esc(business.name)}</strong>
                <span>Interior Fit-out · Kampala</span>
              </span>
            </a>

            <nav class="nav" id="primaryNav" aria-label="Primary">
              ${NAV.map(
                (item) =>
                  `<a class="nav-link" href="${esc(item.href)}"${
                    item.key === active ? ' aria-current="page"' : ''
                  }>${esc(item.label)}</a>`,
              ).join('\n              ')}
            </nav>

            <div class="header-actions">
              <button class="theme-toggle icon-btn" type="button" id="themeToggle" aria-label="Switch colour theme" title="Switch colour theme">
                ${icon('sun', 'icon i-sun')}
                ${icon('moon', 'icon i-moon')}
              </button>
              <a class="btn btn--sm header-cta" href="${esc(quoteWhatsApp(business))}" target="_blank" rel="noopener">
                ${icon('whatsapp')}
                <span>WhatsApp</span>
              </a>
              <button class="menu-toggle icon-btn" type="button" id="menuToggle" aria-label="Open menu" aria-expanded="false" aria-controls="primaryNav">
                ${icon('menu')}
              </button>
            </div>
          </div>
        </header>`;
}

// ── Footer ───────────────────────────────────────────────────────────────────

function renderFooter(data) {
  const { business, settings, services, projects } = data;
  const contact = settings.contact ?? {};
  const year = new Date().getFullYear();
  const company = NAV.filter((n) => n.key !== 'home');

  return `
      <footer class="site-footer">
        <div class="container footer-grid">
          <div class="footer-brand">
            <a class="brand" href="/">
              <span class="brand-mark" aria-hidden="true">${esc(businessInitials(business.name))}</span>
              <span class="brand-text">
                <strong>${esc(business.name)}</strong>
                <span>Interior Fit-out · Kampala</span>
              </span>
            </a>
            <p>${esc((settings.about?.body ?? '').split('. ')[0])}.</p>
            <p class="footer-social">
              <a href="${esc(quoteWhatsApp(business))}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('whatsapp')}</a>
              <a href="mailto:${esc(business.email)}" aria-label="Email">${icon('mail')}</a>
              <a href="${esc(telHref(business.phone))}" aria-label="Call">${icon('phone')}</a>
            </p>
          </div>

          <nav class="footer-col" aria-label="Services">
            <h4>Services</h4>
            ${services
              .slice(0, 6)
              .map((s) => `<a href="/services/${esc(s.slug)}">${esc(s.title)}</a>`)
              .join('\n            ')}
            <a href="/services">All services ${icon('arrow')}</a>
          </nav>

          <nav class="footer-col" aria-label="Company">
            <h4>Company</h4>
            ${company
              .map((n) => `<a href="${esc(n.href)}">${esc(n.label)}</a>`)
              .join('\n            ')}
            <a href="/admin/">Staff login</a>
          </nav>

          <div class="footer-col">
            <h4>Visit &amp; call</h4>
            <p>${esc(business.address)}</p>
            <p><a href="${esc(telHref(business.phone))}">${esc(business.phone)}</a></p>
            <p><a href="mailto:${esc(business.email)}">${esc(business.email)}</a></p>
            <p>${esc(contact.hours ?? '')}</p>
          </div>
        </div>

        <div class="container footer-bottom">
          <p>© ${year} ${esc(business.name)}. All rights reserved.</p>
          <p>${projects.length} projects · ${services.length} services · Built in Kampala 🇺🇬</p>
        </div>
      </footer>`;
}

// ── Overlays ─────────────────────────────────────────────────────────────────
// Rendered on every page: the photo viewer is used by the work index and by
// individual project pages.

function renderOverlays(data) {
  const { business } = data;

  return `
      <a class="whatsapp-float" href="${esc(quoteWhatsApp(business))}" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">
        ${icon('whatsapp')}
        <span>Chat with us</span>
      </a>

      <div class="toast" id="toast" role="status" aria-live="polite"></div>

      <dialog class="lightbox" id="lightbox" aria-label="Project photo viewer">
        <div class="lightbox-inner">
          <div class="lightbox-bar">
            <p class="lightbox-caption" id="lightboxCaption"></p>
            <p class="lb-counter" id="lightboxCounter"></p>
            <button class="lb-btn lb-close" type="button" id="lightboxClose" aria-label="Close viewer">${icon('close')}</button>
          </div>
          <div class="lightbox-stage">
            <button class="lb-btn lb-prev" type="button" id="lightboxPrev" aria-label="Previous photo">${icon('chevronLeft')}</button>
            <img class="lightbox-img" id="lightboxImg" alt="">
            <button class="lb-btn lb-next" type="button" id="lightboxNext" aria-label="Next photo">${icon('chevronRight')}</button>
          </div>
          <div class="lightbox-thumbs" id="lightboxThumbs"></div>
        </div>
      </dialog>`;
}

// ── Document ─────────────────────────────────────────────────────────────────

/**
 * Assemble a complete HTML document.
 *
 * @param {object}   data            Payload from `loadSiteData()`.
 * @param {string}   nonce           Per-response CSP nonce.
 * @param {string}   path            Root-relative path, used for the canonical URL.
 * @param {string}   title           `<title>` and `og:title`.
 * @param {string}   description     Meta description.
 * @param {string}   image           Absolute or root-relative social image.
 * @param {string}   active          Key from `NAV` to mark as the current page.
 * @param {string}   body            Inner HTML for `<main>`.
 * @param {Array}    structuredData  Extra JSON-LD nodes appended to the graph.
 * @param {boolean}  noindex         Ask search engines to skip the page.
 * @param {string}   ogType          `website` (default) or `article`.
 */
export function renderPage({
  data,
  nonce = '',
  path = '/',
  title,
  description,
  image,
  active = '',
  body = '',
  structuredData = [],
  noindex = false,
  ogType = 'website',
}) {
  const { business, settings } = data;
  const seo = settings.seo ?? {};
  const docTitle = title ?? seo.title ?? `${business.name} — Interior Fit-out in Kampala`;
  const docDescription = description ?? seo.description ?? '';
  const canonical = new URL(path, config.publicUrl).href;
  const ogImage = image
    ? new URL(image, config.publicUrl).href
    : data.projects[0]?.images?.[0]?.url
      ? new URL(data.projects[0].images[0].url, config.publicUrl).href
      : '';

  const graphs = [businessGraph(data), ...structuredData].filter(Boolean);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(docTitle)}</title>
    <meta name="description" content="${esc(docDescription)}">
    <link rel="canonical" href="${esc(canonical)}">
    ${noindex ? '<meta name="robots" content="noindex, follow">\n    ' : ''}<meta name="theme-color" content="#faf7f3" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#131110" media="(prefers-color-scheme: dark)">
    <meta name="format-detection" content="telephone=no">

    <meta property="og:type" content="${esc(ogType)}">
    <meta property="og:site_name" content="${esc(business.name)}">
    <meta property="og:title" content="${esc(docTitle)}">
    <meta property="og:description" content="${esc(docDescription)}">
    <meta property="og:url" content="${esc(canonical)}">
    <meta property="og:locale" content="en_UG">
    ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">\n    ` : ''}<meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(docTitle)}">
    <meta name="twitter:description" content="${esc(docDescription)}">
    ${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">\n    ` : ''}
    <link rel="icon" href="${asset('/favicon.svg')}" type="image/svg+xml">
    <link rel="apple-touch-icon" href="${asset('/favicon.svg')}">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap">
    <link rel="stylesheet" href="${asset('/styles.css')}">

${graphs
  .map((g) => `    <script type="application/ld+json" nonce="${esc(nonce)}">${json(g)}</script>`)
  .join('\n')}

    <noscript>
      <style>
        /* Without JavaScript the gallery filter has nothing to filter with, and
           scroll-driven reveals may not be supported. Show everything. */
        .filter-bar { display: none !important; }
        .project-quick { display: none !important; }
        .lightbox { display: none !important; }
        .reveal { opacity: 1 !important; transform: none !important; animation: none !important; }
      </style>
    </noscript>
  </head>
  <body data-page="${esc(active || 'page')}">
    <a class="skip-link" href="#main">Skip to content</a>
${renderHeader(data, { active })}
    <main id="main">
${body}
    </main>
${renderFooter(data)}
${renderOverlays(data)}
    <script src="${asset('/app.js')}" defer></script>
  </body>
</html>
`;
}

export default renderPage;
