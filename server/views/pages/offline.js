// Standalone 503 page shown when the database cannot be reached.
//
// Deliberately self-contained: no imports from the view layer, no nonce, and
// no data beyond `config.business`, because if we are here then `loadSiteData`
// has already failed. Inline `style=` attributes are used so the page still
// looks right when the stylesheet is unavailable.

import config from '../../config.js';

export function offlinePage() {
  const { business } = config;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>We are having a moment — ${business.name}</title>
<meta name="robots" content="noindex" />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background: #faf7f3;
    color: #191512;
    font: 16px/1.65 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
  .card {
    width: 100%;
    max-width: 560px;
    background: #fff;
    border: 1px solid #e4dbd0;
    border-radius: 20px;
    padding: 40px 32px;
    box-shadow: 0 18px 50px rgba(28, 20, 12, .10);
    text-align: center;
  }
  .mark {
    display: inline-grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: #a75f27;
    color: #fff;
    font-weight: 700;
    font-size: 20px;
    letter-spacing: .02em;
    margin-bottom: 20px;
  }
  h1 { font-size: 26px; line-height: 1.25; margin: 0 0 12px; letter-spacing: -.02em; }
  p { margin: 0 0 8px; color: #473e36; }
  .muted { color: #756a5f; font-size: 14px; }
  .actions { margin-top: 26px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
  a { text-decoration: none; }
  .btn {
    display: inline-block;
    padding: 12px 20px;
    border-radius: 999px;
    background: #a75f27;
    color: #fff;
    font-weight: 600;
    font-size: 15px;
  }
  .btn--ghost { background: transparent; color: #191512; border: 1px solid #e4dbd0; }
  @media (prefers-color-scheme: dark) {
    body { background: #17140f; color: #f5efe7; }
    .card { background: #211c17; border-color: #3a3129; box-shadow: none; }
    p { color: #cec4b8; }
    .muted { color: #9b9084; }
    .btn--ghost { color: #f5efe7; border-color: #3a3129; }
  }
</style>
</head>
<body>
  <div class="card">
    <div class="mark" aria-hidden="true">NIC</div>
    <h1>We are having a moment</h1>
    <p>Our project library is temporarily unavailable, so this page cannot load right now.</p>
    <p class="muted">Nothing is lost. Please try again in a few minutes, or reach us directly and we will help straight away.</p>
    <div class="actions">
      <a class="btn" href="tel:${business.phone.replace(/[^\d+]/g, '')}">Call ${business.phone}</a>
      <a class="btn btn--ghost" href="mailto:${business.email}">${business.email}</a>
    </div>
  </div>
</body>
</html>
`;
}

export default offlinePage;
