// bizsim/scripts/audit-and-clean-images.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOCKED_SEASON_COVERS, isSafeImageText } from '../shared/imagePolicy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const seasonImagesPath = path.join(root, 'shared', 'seasonImages.js');
const coversDir = path.join(root, 'client', 'public', 'covers');
const apply = process.argv.includes('--apply');

// Heuristic to surface human portraits for manual confirmation alongside hard policy blocks
const PORTRAIT_REVIEW_RE =
  /\b(portrait|headshot|actress|singer|woman|women|lady|queen|princess|female|girl|model|miss|mrs|ms)\b/i;

const mod = await import(`file://${seasonImagesPath}`);
const seasonImages = mod.SEASON_IMAGES || mod.default || {};
const entries = Object.entries(seasonImages);

const blocked = [];
const reviewQueue = [];

for (const [id, meta] of entries) {
  if (!meta) continue;
  const text = [
    id,
    meta.file,
    meta.title,
    meta.credit,
    meta.creator,
    meta.caption,
    meta.article,
    meta.landingUrl,
    meta.url,
    meta.src,
    meta.remote,
  ]
    .filter(Boolean)
    .join(' ');

  if (BLOCKED_SEASON_COVERS.has(id) || !isSafeImageText(text)) {
    blocked.push({ id, file: meta.file || meta.title || meta.url || meta.src || '' });
  } else if (PORTRAIT_REVIEW_RE.test(text.replace(/[_\-]+/g, ' '))) {
    reviewQueue.push({ id, file: meta.file || meta.title || meta.url || meta.src || '' });
  }
}

console.log(`Audited ${entries.length} season entries.`);
console.log(`Blocked (${blocked.length}):`, blocked);
console.log(`Flagged for manual portrait review (${reviewQueue.length}):`, reviewQueue);

if (apply) {
  let source = fs.readFileSync(seasonImagesPath, 'utf8');
  for (const { id } of blocked) {
    // Replace `"season-cXXX": { ... },` with `"season-cXXX": null,`
    const re = new RegExp(`(['"]${id}['"]\\s*:\\s*)\\{[\\s\\S]*?\\}(?=\\s*,?\\s*\\n)`, 'm');
    if (re.test(source)) {
      source = source.replace(re, '$1null');
    }
    for (const ext of ['webp', 'jpg', 'jpeg', 'png']) {
      const coverFile = path.join(coversDir, `${id}.${ext}`);
      if (fs.existsSync(coverFile)) {
        fs.unlinkSync(coverFile);
        console.log(`Deleted cover asset: ${path.relative(root, coverFile)}`);
      }
    }
  }
  fs.writeFileSync(seasonImagesPath, source, 'utf8');
  console.log('Updated shared/seasonImages.js successfully.');
} else {
  console.log('\nDry run complete. Re-run with --apply to clean blocked assets.');
}
