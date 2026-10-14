// Shared error handling. Keeps responses consistent and stops internal
// details leaking to clients in production.

import { ZodError } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import config, { ROOT_DIR } from '../config.js';
import { asset } from '../lib/asset-version.js';

const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

/// Throw this from anywhere to return a specific status + message.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Authentication required.') => new HttpError(401, msg);
export const forbidden = (msg = 'Not allowed.') => new HttpError(403, msg);
export const notFound = (msg = 'Resource not found.') => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);

/// Wraps an async route handler so rejected promises reach the error handler.
/// Express 5 does this natively, but wrapping keeps intent explicit and makes
/// the code portable.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// The plain 404 page is a static file rather than a rendered view, so its
// stylesheet link has to be versioned by hand — otherwise a browser that had
// cached `/styles.css` from a previous deploy would pair that old file with
// this markup. It is read once and memoised; it only changes on a redeploy.
let cachedNotFoundPage;

function notFoundPage() {
  if (cachedNotFoundPage === undefined) {
    try {
      cachedNotFoundPage = fs
        .readFileSync(path.join(PUBLIC_DIR, '404.html'), 'utf8')
        .replace('href="/styles.css"', `href="${asset('/styles.css')}"`);
    } catch {
      cachedNotFoundPage = '';
    }
  }
  return cachedNotFoundPage;
}

export function notFoundHandler(req, res) {
  // Unknown API routes get JSON so clients can parse the failure.
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: `No API route for ${req.method} ${req.path}` });
  }

  // A 404 must never be cached, or a URL that starts working after a deploy
  // would keep showing the error page to that visitor.
  res.setHeader('Cache-Control', 'no-store');

  const page = notFoundPage();
  if (!page) return res.type('text/plain').send('404 — Not found');
  return res.status(404).type('html').send(page);
}

// eslint-disable-next-line no-unused-vars -- Express identifies handlers by arity
export function errorHandler(err, req, res, _next) {
  // Validation failures from Zod become a tidy 400 with field-level detail.
  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    return res.status(400).json({ error: 'Please check the highlighted fields.', fields });
  }

  // Prisma "record not found"
  if (err?.code === 'P2025') {
    return res.status(404).json({ error: 'That record no longer exists.' });
  }
  // Prisma unique-constraint violation
  if (err?.code === 'P2002') {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'value';
    return res.status(409).json({ error: `That ${target} is already in use.` });
  }

  const status = Number.isInteger(err?.status) ? err.status : 500;

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  const body = {
    error: status >= 500 && config.isProd ? 'Something went wrong on our side.' : err.message,
  };
  if (err.details) body.details = err.details;
  if (!config.isProd && status >= 500) body.stack = err.stack;

  return res.status(status).json(body);
}
