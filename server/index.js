// Nam Interior Constructs — application entry point.
//
// Serves the static frontend from ./public and the JSON API from /api.
// Everything runs from this one process, which keeps deployment simple:
// one service, one URL, no CORS configuration needed.

import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

import config, { ROOT_DIR } from './config.js';
import { assertDatabaseConnection } from './db.js';
import { attachUser } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { verifyMailTransport } from './lib/mailer.js';

import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import leadRoutes from './routes/leads.js';
import projectRoutes from './routes/projects.js';
import contentRoutes from './routes/content.js';
import uploadRoutes from './routes/uploads.js';
import userRoutes from './routes/users.js';
import pageRoutes from './routes/pages.js';

const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const app = express();

// Behind a reverse proxy (Render, Fly, nginx) this makes req.ip and
// secure-cookie detection see the real client rather than the proxy.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ── Security headers ─────────────────────────────────────────────────────────
// Each response gets a fresh CSP nonce. Server-rendered pages use it on the
// few `<script>` elements they legitimately need (structured data), which lets
// the policy stay strict instead of reaching for 'unsafe-inline'.
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(
  helmet({
    // A strict Content-Security-Policy. Google Fonts is allowed for the
    // typography; everything else must be same-origin.
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    // Allow images to be hot-linked by same-origin pages and emails.
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: config.isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  }),
);

app.use(compression());
app.use(cookieParser());

// ── Body parsing ─────────────────────────────────────────────────────────────
// A modest limit: no legitimate JSON payload here is anywhere near this big,
// and it removes a cheap memory-exhaustion vector.
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// ── Logging ──────────────────────────────────────────────────────────────────
if (!config.isTest) {
  app.use(morgan(config.isProd ? 'combined' : 'dev'));
}

app.use(attachUser);

// ── Uploaded media ───────────────────────────────────────────────────────────
app.use(
  '/uploads',
  express.static(config.uploads.dir, {
    maxAge: '30d',
    immutable: false,
    fallthrough: true,
    index: false,
  }),
);

// ── API ──────────────────────────────────────────────────────────────────────
// A tiny no-store default for API responses — lead data must never be cached
// by a CDN or the browser.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin/leads', leadRoutes);
app.use('/api/admin/projects', projectRoutes);
app.use('/api/admin/content', contentRoutes);
app.use('/api/admin/uploads', uploadRoutes);
app.use('/api/admin/users', userRoutes);

// ── Static frontend ──────────────────────────────────────────────────────────
// HTML is revalidated on every load so a deploy is picked up immediately,
// while hashed/static assets are cached aggressively.
app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    index: ['index.html'],
    setHeaders(res, filePath) {
      // Pieces of a page must never be cached, or a deploy would show new
      // markup beside old assets.
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
        return;
      }

      // During development nothing is cached at all. A seven-day max-age here
      // used to mean an edited stylesheet looked like it had not been applied,
      // which is a very expensive way to lose an afternoon.
      if (!config.isProd) {
        res.setHeader('Cache-Control', 'no-store');
        return;
      }

      // `styles.css`, `app.js` and `favicon.svg` are linked with a `?v=<hash>`
      // suffix (see lib/asset-version.js), so their URL changes whenever their
      // contents do and they can be cached essentially forever.
      if (/\.(css|js|mjs)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return;
      }

      // Images, fonts and icons are referenced by a fixed filename, so a
      // replaced photo has to be able to show up — one day is the compromise.
      if (/\.(woff2?|jpe?g|png|webp|avif|gif|svg|ico)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    },
  }),
);

// ── Server-rendered pages ────────────────────────────────────────────────────
// Placed after the static middleware so a real file on disk always wins, and
// before the clean-URL handler below so `GET /` is never mistaken for a page.
app.use(pageRoutes);

// Clean URLs: /services → /services.html, /admin → /admin/
app.get('/:page', (req, res, next) => {
  const candidate = path.join(PUBLIC_DIR, `${req.params.page}.html`);
  if (!/^[a-z0-9-]+$/i.test(req.params.page) || !fs.existsSync(candidate)) return next();
  return res.sendFile(candidate);
});

app.use(notFoundHandler);
app.use(errorHandler);

// ── Boot ─────────────────────────────────────────────────────────────────────
async function start() {
  const dbOk = await assertDatabaseConnection();
  if (!dbOk) {
    console.error(
      '\x1b[33m→ Check DATABASE_URL in your .env file, and that Postgres is running.\x1b[0m\n' +
        '\x1b[33m→ First time here? Run: npm run setup\x1b[0m\n',
    );
    process.exit(1);
  }

  if (config.mail.enabled) await verifyMailTransport();

  const server = app.listen(config.port, () => {
    console.log('');
    console.log(`  \x1b[1mNam Interior Constructs\x1b[0m`);
    console.log(`  \x1b[2m───────────────────────────────────────\x1b[0m`);
    console.log(`  Website   \x1b[36m${config.publicUrl}\x1b[0m`);
    console.log(`  Dashboard \x1b[36m${config.publicUrl}/admin/\x1b[0m`);
    console.log(`  API       \x1b[36m${config.publicUrl}/api/health\x1b[0m`);
    console.log(`  Mode      ${config.env}`);
    console.log(`  Email     ${config.mail.enabled ? 'enabled' : '\x1b[2mdisabled (set MAIL_ENABLED=true)\x1b[0m'}`);
    console.log('');
  });

  // Graceful shutdown so in-flight requests finish before the process exits.
  const shutdown = (signal) => {
    console.log(`\n[${signal}] Shutting down…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();

export default app;
