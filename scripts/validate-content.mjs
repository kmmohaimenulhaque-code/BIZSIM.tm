// Runs the deterministic quality gates over all curated cases.
// Usage: npm run check        (add --urls to also check that source links resolve)
import { CASES } from '../shared/cases/index.js';
import { validateCase } from '../shared/validate.js';
import { seasonShape } from '../shared/episodes.js';
import { noEmDash } from '../shared/text.js';

let failed = 0;
for (const c of CASES) {
  const r = validateCase(c, { requireHistorical: true, episodes: 4 });
  const text = JSON.stringify(c);
  if (noEmDash(text) !== text) r.errors.push('contains an em dash');
  const status = r.ok ? 'OK  ' : 'FAIL';
  console.log(`${status} ${c.id} (${seasonShape(c)})`);
  r.errors.forEach((e) => console.log('   error:', e));
  r.warnings.forEach((w) => console.log('   warn: ', w));
  if (!r.ok || r.warnings.length) failed++;
}

if (process.argv.includes('--urls')) {
  const urls = [...new Set(CASES.flatMap((c) => c.sources.map((s) => s.url)))];
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'BIZSIM content check' } });
      console.log(res.ok ? 'OK  ' : `${res.status} `, url);
      if (!res.ok) failed++;
    } catch (e) {
      console.log('ERR ', url, e.message);
      failed++;
    }
  }
}

console.log(failed ? `\n${failed} problem(s) found.` : '\nAll curated content passed.');
process.exit(failed ? 1 : 0);
