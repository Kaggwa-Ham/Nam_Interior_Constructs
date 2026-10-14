// Central configuration. Every environment variable the app needs is read,
// validated and defaulted here so the rest of the codebase never touches
// `process.env` directly.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');

// ── Tiny .env loader ─────────────────────────────────────────────────────────
// Node 20+ can do this natively with `node --env-file`, but loading it here
// means `npm start` just works with no extra flags.
function loadDotEnv() {
  const file = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip matching surrounding quotes
    if (value.length > 1 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

const bool = (v, fallback = false) =>
  v === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

const int = (v, fallback) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';

const sessionSecret = process.env.SESSION_SECRET || '';
const weakSecret = !sessionSecret || sessionSecret.length < 32 || sessionSecret.startsWith('change-me');

// In production a weak secret is a hard stop: it would let anyone forge an
// admin session cookie. In development we generate one so the app still runs.
let effectiveSecret = sessionSecret;
if (weakSecret) {
  if (isProd && !isTest) {
    console.error(
      '\n\x1b[31m✖ FATAL: SESSION_SECRET is missing or too weak.\x1b[0m\n' +
        '  Generate one with:\n' +
        '    node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n' +
        '  then set it in your hosting provider\'s environment variables.\n',
    );
    process.exit(1);
  }
  const { randomBytes } = await import('node:crypto');
  effectiveSecret = randomBytes(48).toString('hex');
  if (!isTest) {
    console.warn('[config] Using a temporary SESSION_SECRET. Admin sessions reset on restart.');
  }
}

export const config = {
  env,
  isProd,
  isTest,
  port: int(process.env.PORT, 3000),
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${int(process.env.PORT, 3000)}`).replace(/\/$/, ''),

  databaseUrl: process.env.DATABASE_URL || '',

  session: {
    secret: effectiveSecret,
    hours: int(process.env.SESSION_HOURS, 12),
    cookieName: 'nic_session',
  },

  seed: {
    email: process.env.ADMIN_EMAIL || 'admin@naminteriorconstructs.com',
    password: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
    name: process.env.ADMIN_NAME || 'Site Administrator',
  },

  mail: {
    enabled: bool(process.env.MAIL_ENABLED, false),
    host: process.env.SMTP_HOST || '',
    port: int(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Nam Interior Constructs <no-reply@example.com>',
    to: process.env.MAIL_TO || process.env.BUSINESS_EMAIL || '',
  },

  business: {
    name: 'Nam Interior Constructs',
    phone: process.env.BUSINESS_PHONE || '+256 700 000 000',
    whatsapp: process.env.BUSINESS_WHATSAPP || '256700000000',
    email: process.env.BUSINESS_EMAIL || 'info@naminteriorconstructs.com',
    address: process.env.BUSINESS_ADDRESS || 'Kampala, Uganda',
  },

  uploads: {
    dir: path.join(ROOT_DIR, 'uploads'),
    maxBytes: 8 * 1024 * 1024, // 8 MB per image
  },
};

if (!config.databaseUrl && !isTest) {
  console.error(
    '\n\x1b[31m✖ FATAL: DATABASE_URL is not set.\x1b[0m\n' +
      '  Copy .env.example to .env and fill in your Postgres connection string.\n',
  );
  process.exit(1);
}

export default config;
