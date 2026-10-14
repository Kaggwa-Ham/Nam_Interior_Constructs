// Content-derived cache-buster for the front-end assets.
//
// There is no build step on this project, so `/styles.css` and `/app.js` keep
// the same URL for the life of the site. If those files are served with a long
// `max-age` and the visitor already has a copy, the browser will keep using its
// cached version for the whole max-age — so after a deploy people would see the
// new HTML styled with the old CSS. Deriving a short hash from the file
// contents fixes that properly: any edit changes the URL, and anything that did
// not change stays cached for as long as we like.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { ROOT_DIR } from '../config.js';

const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

/// Files whose contents decide the version string. `app.js` pulls in nothing
/// else, so tracking these three is enough.
const TRACKED = ['styles.css', 'app.js', 'favicon.svg'];

function hashFile(relative) {
  try {
    const contents = fs.readFileSync(path.join(PUBLIC_DIR, relative));
    return crypto.createHash('sha256').update(contents).digest('hex').slice(0, 12);
  } catch {
    // A missing (or unreadable) file must never stop the server booting.
    // Falling back to the clock still guarantees the URL changes on restart.
    return String(Date.now());
  }
}

const digest = TRACKED.map((file) => `${file}:${hashFile(file)}`).join('|');

/// Short, stable-per-content version string, e.g. `?v=9f2a41c8`.
export const ASSET_VERSION = crypto.createHash('sha256').update(digest).digest('hex').slice(0, 10);

/// Appends the version query string to a root-relative asset path.
///   asset('/styles.css') -> '/styles.css?v=9f2a41c8'
export function asset(pathname) {
  return `${pathname}?v=${ASSET_VERSION}`;
}

export default asset;
