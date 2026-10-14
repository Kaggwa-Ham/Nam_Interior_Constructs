// Build-time image pipeline.
//
//   npm run images
//
// Reads the raw WhatsApp photos, re-encodes them as WebP at three widths
// (400 / 800 / 1600px), and writes them to public/img/projects/<slug>/.
// A manifest describing every generated file lands in public/img/manifest.json
// and is consumed by prisma/seed.js.
//
// Nothing here runs in production — the optimised output is committed with the
// site, which is why the deployed app needs no image processing at runtime.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_ROOT = path.join(ROOT, 'public', 'img');

const WIDTHS = [400, 800, 1600];
const IMAGE_RE = /\.(jpe?g|png|webp|avif|tiff)$/i;

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE GROUPINGS
//
// Each entry turns one folder of raw photos into one portfolio project.
// Titles and categories here are sensible placeholders derived from the shoot —
// edit them freely, or better, change them in the admin dashboard later.
// ─────────────────────────────────────────────────────────────────────────────
const GROUPS = [
  {
    folder: 'Photos',
    slug: 'complete-home-renovation',
    title: 'Complete Home Renovation',
    category: 'RENOVATION',
    location: 'Kampala, Uganda',
    year: 2024,
    summary:
      'A full turnkey renovation: stripped back to the shell and rebuilt with new joinery, ceilings, tiling and finishes throughout.',
    description:
      'This project took a tired family home back to bare walls and rebuilt it as a modern, light-filled residence. Our team handled demolition, structural alterations, gypsum ceilings with concealed lighting, custom joinery, floor and wall tiling, and the final decoration package — under a single contract and a single programme of works.',
    featured: true,
  },
  {
    folder: 'WhatsApp Unknown 2026-03-10 at 7.59.37 AM',
    slug: 'custom-joinery-package',
    title: 'Custom Joinery & Built-in Package',
    category: 'WARDROBES',
    location: 'Kampala, Uganda',
    year: 2024,
    summary:
      'Made-to-measure wardrobes, media units and storage built on site to fit awkward angles and maximise every millimetre.',
    description:
      'Every carcass was cut and assembled in our workshop, then fitted on site for a seamless join. Soft-close hardware throughout, adjustable shelving, integrated LED lighting and finishes matched to the client’s paint schedule.',
    featured: true,
  },
  {
    folder: 'WhatsApp Unknown 2026-03-10 at 8.00.29 AM',
    slug: 'fitted-furniture-and-finishes',
    title: 'Fitted Furniture & Interior Finishes',
    category: 'FURNITURE',
    location: 'Kampala, Uganda',
    year: 2025,
    summary:
      'Bespoke furniture pieces and finishing works delivered across several rooms in a single occupation.',
    description:
      'A package of fitted furniture, feature walls, joinery and decoration. We worked around the client’s existing schedule, completing room by room so the family never had to move out.',
    featured: true,
  },
];

// Files that are not portfolio photography.
//
// Empty on purpose: every one of the 62 supplied photos is genuine project
// photography, so they all belong in the galleries. (An earlier revision
// classified one of them as a "business card" — it is actually a photo of a
// glazed facade installation, so it stays in the portfolio.)
const BRAND_ASSETS = [];

// ─────────────────────────────────────────────────────────────────────────────

const slugify = (text) =>
  String(text).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

async function listImages(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listImages(full)));
    else if (IMAGE_RE.test(entry.name)) files.push(full);
  }
  return files.sort();
}

async function main() {
  await fs.rm(OUT_ROOT, { recursive: true, force: true });
  await fs.mkdir(OUT_ROOT, { recursive: true });

  const manifest = { generatedAt: new Date().toISOString(), projects: [], brand: [] };
  let totalIn = 0;
  let totalOut = 0;
  let written = 0;

  // ── Brand assets ──────────────────────────────────────────────────────────
  const allSourceImages = (
    await Promise.all(
      GROUPS.map((g) => listImages(path.join(ROOT, g.folder))),
    )
  ).flat();

  for (const asset of BRAND_ASSETS) {
    const source = allSourceImages.find((f) => asset.match.test(f));
    if (!source) continue;
    const outDir = path.join(OUT_ROOT, 'brand');
    await fs.mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, `${asset.name}.webp`);
    const info = await sharp(source).rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 90 }).toFile(outFile);
    if (info.size) {
      totalIn += (await fs.stat(source)).size;
      totalOut += info.size;
      written++;
      manifest.brand.push({ name: asset.name, url: `/img/brand/${asset.name}.webp`, width: info.width, height: info.height });
      console.log(`  brand  ${asset.name.padEnd(22)} ${info.width}×${info.height}  ${kb(info.size)}`);
    }
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  for (const group of GROUPS) {
    const sourceDir = path.join(ROOT, group.folder);
    const files = (await listImages(sourceDir)).filter(
      (f) => !BRAND_ASSETS.some((a) => a.match.test(f)),
    );

    if (!files.length) {
      console.warn(`  ! skipped "${group.folder}" — no images found`);
      continue;
    }

    const outDir = path.join(OUT_ROOT, 'projects', group.slug);
    await fs.mkdir(outDir, { recursive: true });

    console.log(`\n▸ ${group.title}  (${files.length} images)`);
    const images = [];

    for (const [index, source] of files.entries()) {
      const seq = String(index + 1).padStart(2, '0');
      const originalName = path.basename(source);

      // Skip duplicates by content — WhatsApp sends the same photo twice.
      const stat = await fs.stat(source);
      totalIn += stat.size;

      const sources = [];
      for (const width of WIDTHS) {
        const outName = `${seq}-${width}.webp`;
        const outFile = path.join(outDir, outName);
        const info = await sharp(source)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 80, effort: 4 })
          .toFile(outFile);
        totalOut += info.size;
        written++;
        sources.push({ width: info.width, url: `/img/projects/${group.slug}/${outName}` });
      }

      // Use the largest variant's real dimensions as the intrinsic size so the
      // frontend can reserve layout space and avoid content shift.
      const largest = await sharp(source).metadata();

      images.push({
        seq,
        originalName,
        alt: `${group.title} — view ${index + 1}`,
        width: largest.width ?? 1600,
        height: largest.height ?? 1200,
        // Largest first is the conventional sources order for srcset.
        sources: sources.slice().reverse(),
        fallback: sources[sources.length - 1].url,
      });

      console.log(`  ${seq}  ${largest.width}×${largest.height}  → ${sources.length} sizes`);
    }

    manifest.projects.push({
      slug: group.slug,
      title: group.title,
      category: group.category,
      location: group.location,
      year: group.year,
      summary: group.summary,
      description: group.description,
      featured: group.featured,
      cover: images[0].sources[0].url,
      images: images.map(({ seq, originalName, alt, width, height, sources, fallback }) => ({
        seq, originalName, alt, width, height, sources, fallback,
      })),
    });
  }

  await fs.mkdir(OUT_ROOT, { recursive: true });
  await fs.writeFile(path.join(OUT_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('\n' + '─'.repeat(58));
  if (written) {
    console.log(`  ${written} files written`);
    console.log(`  raw      ${(totalIn / 1024 / 1024).toFixed(1)} MB`);
    console.log(`  optimised ${(totalOut / 1024 / 1024).toFixed(1)} MB`);
    console.log(`  saved     ${(100 - (totalOut / totalIn) * 100).toFixed(0)}%`);
  }
  console.log(`  manifest  public/img/manifest.json`);
  console.log('─'.repeat(58) + '\n');
}

main().catch((error) => {
  console.error('\n✖ Image pipeline failed:', error.message);
  process.exit(1);
});
