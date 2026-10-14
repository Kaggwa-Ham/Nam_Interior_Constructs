// Admin: image uploads.
//
// Files are normalised through sharp (resized, re-encoded to WebP) so an admin
// can drop in a 6 MB phone photo and get a fast-loading asset. Uploads land in
// ./uploads and are served from /uploads.

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import config from '../config.js';
import { asyncHandler, badRequest, notFound } from '../middleware/errors.js';
import { requireRole } from '../middleware/auth.js';
import { randomId } from '../lib/auth.js';

const router = express.Router();

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/tiff']);

// Keep the file in memory first — nothing touches disk until sharp has
// confirmed it really is an image.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxBytes, files: 12 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(badRequest(`Unsupported file type "${file.mimetype}". Use JPEG, PNG, WebP, AVIF or GIF.`));
    }
    return cb(null, true);
  },
});

/// Lazily imported so the app still boots if sharp's native binary is missing.
async function getSharp() {
  try {
    const mod = await import('sharp');
    return mod.default;
  } catch {
    return null;
  }
}

async function ensureUploadDir() {
  await fs.mkdir(config.uploads.dir, { recursive: true });
}

/// Processes one buffer into a WebP at up to 2000px on the long edge.
async function processImage(sharp, buffer, originalName) {
  const base = path
    .basename(originalName, path.extname(originalName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'image';

  const filename = `${Date.now()}-${base}-${randomId(4)}.webp`;

  if (!sharp) {
    // No sharp: store the original bytes untouched rather than failing.
    const fallback = `${Date.now()}-${base}-${randomId(4)}${path.extname(originalName).toLowerCase()}`;
    await fs.writeFile(path.join(config.uploads.dir, fallback), buffer);
    return { url: `/uploads/${fallback}`, width: null, height: null, bytes: buffer.length, optimised: false };
  }

  const output = await sharp(buffer, { failOn: 'none' })
    .rotate() // honour EXIF orientation
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  await fs.writeFile(path.join(config.uploads.dir, filename), output.data);
  return {
    url: `/uploads/${filename}`,
    width: output.info.width,
    height: output.info.height,
    bytes: output.data.length,
    optimised: true,
  };
}

// Single image
router.post(
  '/image',
  requireRole('OWNER', 'ADMIN'),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No image was uploaded.');
    await ensureUploadDir();
    const sharp = await getSharp();
    const result = await processImage(sharp, req.file.buffer, req.file.originalname);
    res.status(201).json({ file: result });
  }),
);

// Multiple images (up to 12 per request)
router.post(
  '/images',
  requireRole('OWNER', 'ADMIN'),
  upload.array('images', 12),
  asyncHandler(async (req, res) => {
    if (!req.files?.length) throw badRequest('No images were uploaded.');
    await ensureUploadDir();
    const sharp = await getSharp();
    const files = await Promise.all(req.files.map((f) => processImage(sharp, f.buffer, f.originalname)));
    res.status(201).json({ files });
  }),
);

router.delete(
  '/:filename',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    // path.basename strips any directory components, defeating traversal.
    const safe = path.basename(req.params.filename);
    const target = path.join(config.uploads.dir, safe);
    if (!target.startsWith(config.uploads.dir)) throw badRequest('Invalid filename.');

    try {
      await fs.unlink(target);
      res.json({ ok: true });
    } catch (error) {
      if (error.code === 'ENOENT') throw notFound('That file does not exist.');
      throw error;
    }
  }),
);

export default router;
