// Contact page — the enquiry form, the aside and the FAQ.
//
// `?service=<id>` pre-selects the matching option server-side, so the link
// works without JavaScript. `public/app.js` also handles it client-side for
// the case where the visitor lands from a same-page anchor.

import config from '../../config.js';
import {
  esc,
  icon,
  label,
  CATEGORY_LABELS,
  pageHero,
  ctaBand,
  telHref,
  whatsappLink,
} from '../components.js';

/// Normalises `['a','b']` and `[{value,text}]` to the same shape. The old
/// version accepted only the latter, which silently rendered empty labels.
const normalise = (options) =>
  options.map((o) => (typeof o === 'string' ? { value: o, text: o } : o));

function select({ name, id = name, label: text, options, selected = '', required = false, hint }) {
  const opts = normalise(options)
    .map(
      (o) =>
        `<option value="${esc(o.value)}"${String(o.value) === String(selected) ? ' selected' : ''}>${esc(o.text)}</option>`,
    )
    .join('\n              ');

  return `<div class="field">
            <label for="${esc(id)}">${esc(text)}</label>
            <select class="select" id="${esc(id)}" name="${esc(name)}"${required ? ' required' : ''}>
              <option value=""${selected ? '' : ' selected'}>Please choose…</option>
              ${opts}
            </select>
            ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
          </div>`;
}

const BUDGETS = [
  'Under UGX 10m',
  'UGX 10m – 30m',
  'UGX 30m – 80m',
  'UGX 80m – 150m',
  'Above UGX 150m',
  'Not sure yet',
];

const TIMELINES = [
  'As soon as possible',
  'In 1–3 months',
  'In 3–6 months',
  'In 6–12 months',
  'Just exploring',
];

export function contactPage(data, { serviceId = '' } = {}) {
  const { settings, business, services } = data;
  const contact = settings.contact ?? {};
  const hours = contact.hours ?? 'Monday – Saturday, 8:00 – 18:00';
  const hoursNote = contact.hoursNote ?? '';

  const serviceOptions = [
    ...services.map((s) => ({ value: s.id, text: s.title })),
    { value: 'other', text: 'Something else / not sure yet' },
  ];

  const body = `${pageHero({
    eyebrow: 'Get in touch',
    title: 'Tell us about the space',
    lede: 'Send us the rooms and roughly what you have in mind. You will get a call back within one working day, and a fixed written quote after a free site visit.',
    trail: [{ label: 'Home', href: '/' }, { label: 'Contact' }],
  })}

      <section class="section">
        <div class="container contact-grid">
          <div class="contact-form">
            <form id="enquiryForm" method="post" action="/api/leads" novalidate>
              <input type="hidden" name="type" value="QUOTE" />
              <input type="hidden" name="consent" value="on" />
              <div class="hp" aria-hidden="true">
                <label for="website">Website</label>
                <input id="website" name="website" type="text" tabindex="-1" autocomplete="off" />
              </div>

              <h2 class="form-heading">Project enquiry</h2>

              <div class="form-row form-row--2">
                <div class="field" data-field="name">
                  <label for="name">Your name <span aria-hidden="true">*</span></label>
                  <input class="input" id="name" name="name" type="text" autocomplete="name" required placeholder="e.g. Sarah Nakato" />
                  <p class="field-error" data-error="name"></p>
                </div>
                <div class="field" data-field="phone">
                  <label for="phone">Phone or WhatsApp <span aria-hidden="true">*</span></label>
                  <input class="input" id="phone" name="phone" type="tel" autocomplete="tel" required placeholder="+256 7xx xxx xxx" />
                  <p class="field-error" data-error="phone"></p>
                </div>
              </div>

              <div class="form-row form-row--2">
                <div class="field" data-field="email">
                  <label for="email">Email <span aria-hidden="true">*</span></label>
                  <input class="input" id="email" name="email" type="email" autocomplete="email" required placeholder="you@example.com" />
                  <p class="field-error" data-error="email"></p>
                </div>
                <div class="field">
                  <label for="location">Where is the property?</label>
                  <input class="input" id="location" name="location" type="text" autocomplete="address-level2" placeholder="e.g. Kololo, Kampala" />
                </div>
              </div>

              <div class="form-row form-row--2">
                ${select({
                  name: 'serviceId',
                  label: 'What do you need done?',
                  options: serviceOptions,
                  selected: serviceId,
                })}
                ${select({
                  name: 'projectType',
                  label: 'Type of space',
                  options: Object.values(CATEGORY_LABELS),
                })}
              </div>

              <div class="form-row form-row--2">
                ${select({ name: 'budgetRange', label: 'Budget range', options: BUDGETS })}
                ${select({ name: 'timeline', label: 'When should it start?', options: TIMELINES })}
              </div>

              <div class="field" data-field="message">
                <label for="message">What are you trying to achieve? <span aria-hidden="true">*</span></label>
                <textarea class="textarea" id="message" name="message" rows="5" required placeholder="Room sizes if you have them, what you dislike about the current space, and any deadline you are working to."></textarea>
                <p class="hint">The more detail you give, the more accurate the first quote will be.</p>
                <p class="field-error" data-error="message"></p>
              </div>

              <div class="form-foot">
                <button class="btn btn--lg" id="submitBtn" type="submit" data-label="Request a quote">
                  <span id="submitLabel">Request a quote</span>
                </button>
                <p class="form-note">No spam, ever. We only use these details to prepare your quote.</p>
              </div>
              <p class="form-status" id="formStatus" role="status" aria-live="polite"></p>
            </form>
          </div>

          <aside class="contact-aside">
            <div class="aside-card">
              <h3>Prefer to talk?</h3>
              <div class="info-list">
                <a class="info-row" href="${esc(telHref(business.phone))}">
                  <span class="info-icon" aria-hidden="true">${icon('phone')}</span>
                  <span class="info-body">
                    <span class="info-label">Call us</span>
                    <span class="info-value">${esc(business.phone)}</span>
                  </span>
                </a>
                <a class="info-row" href="${esc(whatsappLink(business.whatsapp, `Hello ${business.name}, I would like a quote.`))}" target="_blank" rel="noopener">
                  <span class="info-icon" aria-hidden="true">${icon('whatsapp')}</span>
                  <span class="info-body">
                    <span class="info-label">WhatsApp</span>
                    <span class="info-value">Fastest reply</span>
                  </span>
                </a>
                <a class="info-row" href="mailto:${esc(business.email)}">
                  <span class="info-icon" aria-hidden="true">${icon('mail')}</span>
                  <span class="info-body">
                    <span class="info-label">Email</span>
                    <span class="info-value">${esc(business.email)}</span>
                  </span>
                </a>
                <div class="info-row">
                  <span class="info-icon" aria-hidden="true">${icon('pin')}</span>
                  <span class="info-body">
                    <span class="info-label">Workshop</span>
                    <span class="info-value">${esc(business.address)}</span>
                  </span>
                </div>
              </div>
            </div>

            <div class="aside-card hours-card">
              <h3>Opening hours</h3>
              <p>${esc(hours)}</p>
              ${hoursNote ? `<p class="hint">${esc(hoursNote)}</p>` : ''}
              <p class="hint">Site visits are booked Monday to Friday.</p>
            </div>
          </aside>
        </div>
      </section>

${ctaBand(data, {
    title: 'Still deciding what you need?',
    body: 'Look through the finished work first — it is usually the fastest way to work out what you want.',
    primary: { label: 'See our work', href: '/work' },
  })}`;

  return {
    active: 'contact',
    path: '/contact',
    title: `Contact — ${business.name}`,
    description: 'Request a free site visit and a fixed, itemised quote for your interior fit-out in Kampala.',
    image: data.projects[0]?.images?.[0]?.url,
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: new URL('/', config.publicUrl).href },
          { '@type': 'ListItem', position: 2, name: 'Contact' },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: `Contact ${business.name}`,
        url: new URL('/contact', config.publicUrl).href,
      },
    ],
    body,
  };
}

export default contactPage;
