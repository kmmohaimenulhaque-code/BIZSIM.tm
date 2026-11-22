// bizsim/tests/security.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { gzipSync } from 'fflate';
import {
  isPrivateIp,
  assertPublicUrl,
  fetchSafeText,
  createPinnedLookup,
  createBoundedRateLimiter,
  createConcurrencyLimiter,
  checkPublicAiToken,
} from '../server/src/lib/netSafety.js';
import {
  isSafeImageText,
  sanitizeImageUrl,
  buildSafeImagePrompt,
  buildCoverAlt,
} from '../shared/imagePolicy.js';
import { CASES } from '../shared/cases/index.js';
import { SEASON_IMAGES } from '../shared/seasonImages.js';
import {
  gunzipBounded,
  stripPoisonKeys,
  assertNoSecretsInPayload,
} from '../shared/package.js';
import { detectProvider } from '../server/src/ai/keys.js';
import { fetchText, redactSecrets, redactSecretsDeep } from '../server/src/lib/http.js';
import { pageText } from '../server/src/research/sources.js';
import { parseTrustProxy } from '../server/src/config.js';

test('SSRF: blocks private, loopback, metadata, CGNAT, and IPv4-mapped IPv6 addresses', () => {
  const blocked = [
    '127.0.0.1',
    '10.0.0.1',
    '172.16.5.4',
    '192.168.1.10',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
    'fe80::1',
    'fc00::1',
    'ff02::1',
  ];
  for (const ip of blocked) {
    assert.equal(isPrivateIp(ip), true, `Expected ${ip} to be blocked`);
  }

  const allowed = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111'];
  for (const ip of allowed) {
    assert.equal(isPrivateIp(ip), false, `Expected ${ip} to be allowed`);
  }
});

test('SSRF: rejects localhost, credentials, non-http schemes, and numeric IP tricks', async () => {
  const badUrls = [
    'http://127.0.0.1:8787/api/keys',
    'http://localhost:11434/v1/models',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::ffff:127.0.0.1]/admin',
    'http://2130706433/',
    'file:///etc/passwd',
    'https://user:pass@example.com/v1',
  ];
  for (const u of badUrls) {
    await assert.rejects(() => assertPublicUrl(u), `Expected rejection for ${u}`);
  }
});

test('SSRF: blocks redirect to loopback target', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(302, { Location: 'http://127.0.0.1:8787/secret' });
    res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    await assert.rejects(() => fetchSafeText(`http://127.0.0.1:${port}/start`));
  } finally {
    server.close();
  }
});

test('Rate limiter enforces window cap and stays bounded', () => {
  const limit = createBoundedRateLimiter({ windowMs: 1000, max: 2, maxKeys: 5 });
  assert.equal(limit('ip1').ok, true);
  assert.equal(limit('ip1').ok, true);
  assert.equal(limit('ip1').ok, false);
  for (let i = 0; i < 20; i++) limit(`flood-${i}`);
  assert.equal(limit('fresh').ok, true);
});

test('Package security: rejects zip bombs, prototype pollution, and leaked API keys', () => {
  const huge = new Uint8Array(1024 * 1024).fill(65);
  const gz = gzipSync(huge);
  assert.throws(() => gunzipBounded(gz, 64 * 1024), /exceeds limit/i);

  const polluted = JSON.parse('{"__proto__":{"isAdmin":true},"title":"ok"}');
  const cleaned = stripPoisonKeys(polluted);
  assert.equal(Object.prototype.hasOwnProperty.call(cleaned, '__proto__'), false);
  assert.equal(({}).isAdmin, undefined);

  assert.throws(
    () => assertNoSecretsInPayload({ note: 'leaked sk-1234567890abcdefghijklmnop' }),
    /API key/i
  );
  assert.throws(
    () => assertNoSecretsInPayload({ note: 'leaked AQ.Ab8RN61234567890abcdefghijklmnop' }),
    /API key/i
  );
  assert.doesNotThrow(() => assertNoSecretsInPayload({ title: 'Clean Case' }));
});

test('Image safety policy blocks prohibited covers, unsafe URLs, and unsafe prompts', () => {
  assert.equal(sanitizeImageUrl('/covers/season-c056.webp'), null);
  assert.equal(sanitizeImageUrl('/covers/season-c058.webp'), null);
  assert.equal(sanitizeImageUrl('/covers/season-c190.webp'), null);
  assert.equal(sanitizeImageUrl('https://evil.example.com/photo.jpg'), null);
  assert.equal(sanitizeImageUrl('http://localhost:8787/generated/abc123.png'), 'http://localhost:8787/generated/abc123.png');
  assert.equal(sanitizeImageUrl('http://localhost:8787/api/keys'), null);
  assert.equal(sanitizeImageUrl('http://localhost:8787/generated/swimsuit_model.png'), null);
  assert.equal(sanitizeImageUrl('javascript:alert(1)'), null);
  assert.equal(
    sanitizeImageUrl('https://upload.wikimedia.org/wikipedia/commons/a/a1/Factory.jpg'),
    'https://upload.wikimedia.org/wikipedia/commons/a/a1/Factory.jpg'
  );
  assert.equal(isSafeImageText('swimsuit_model_shoot.jpg'), false);
  assert.equal(buildSafeImagePrompt('lingerie photoshoot'), null);
  assert.ok(buildSafeImagePrompt('1920s steel mill architecture').includes('No human figures'));
});

test('Gemini API keys: recognizes both AIza... and AQ.... prefixes and redacts them', () => {
  const aqKey = 'AQ.Ab8RN61234567890abcdefghijklmnop';
  const aizaKey = 'AIzaSyA1234567890abcdefghijklmnop';
  assert.equal(detectProvider(aqKey), 'gemini');
  assert.equal(detectProvider(aizaKey), 'gemini');
  assert.equal(redactSecrets(`Error with ${aqKey}`), 'Error with [redacted]');
  assert.equal(redactSecrets(`Error with ${aizaKey}`), 'Error with [redacted]');
});

test('NetSafety: createPinnedLookup supports Node 18 single mode and Node 20/22 { all: true } mode', async () => {
  const lookup = createPinnedLookup([
    { address: '2606:4700:4700::1111', family: 6 },
    { address: '1.1.1.1', family: 4 },
  ]);

  // Node 20/22 Happy Eyeballs passes { all: true } and expects an array of { address, family }
  const allResult = await new Promise((resolve, reject) => {
    lookup('api.openai.com', { all: true }, (err, list) => (err ? reject(err) : resolve(list)));
  });
  assert.ok(Array.isArray(allResult));
  assert.equal(allResult.length, 2);
  assert.deepEqual(allResult[0], { address: '1.1.1.1', family: 4 });
  assert.deepEqual(allResult[1], { address: '2606:4700:4700::1111', family: 6 });

  // Node 18 / non-all mode expects (null, address, family)
  const singleResult = await new Promise((resolve, reject) => {
    lookup('api.openai.com', {}, (err, address, family) => (err ? reject(err) : resolve({ address, family })));
  });
  assert.deepEqual(singleResult, { address: '1.1.1.1', family: 4 });

  // Callback as second argument
  const twoArgResult = await new Promise((resolve, reject) => {
    lookup('api.openai.com', (err, address, family) => (err ? reject(err) : resolve({ address, family })));
  });
  assert.deepEqual(twoArgResult, { address: '1.1.1.1', family: 4 });
});

test('Provider detection: recognizes all supported API key prefixes', () => {
  assert.equal(detectProvider('AQ.Ab8RN61234567890abcdefghijklmnop'), 'gemini');
  assert.equal(detectProvider('AIzaSyA1234567890abcdefghijklmnop'), 'gemini');
  assert.equal(detectProvider('sk-ant-api03-1234567890abcdefghij'), 'anthropic');
  assert.equal(detectProvider('nvapi-1234567890abcdefghijklmnop'), 'nvidia');
  assert.equal(detectProvider('sk-or-v1-1234567890abcdefghijklmnop'), 'openrouter');
  assert.equal(detectProvider('gsk_1234567890abcdefghijklmnop'), 'groq');
  assert.equal(detectProvider('xai-1234567890abcdefghijklmnop'), 'xai');
  assert.equal(detectProvider('sk-proj-1234567890abcdefghijklmnop'), 'openai');
  assert.equal(detectProvider('custom-key', 'https://api.example.com/v1'), 'custom');
});

test('HTML extraction: pageText strips nested/malformed tags, scripts, comments, and caps length', () => {
  const hostile = [
    '<html><head><style>.x{color:red}</style><script>alert("xss")</script   ></head><body>',
    '<!-- hidden secret comment should not appear -->',
    '<nav><p>Navigation menu text that must be ignored completely here.</p></nav>',
    '<h1>Acme Industrial Corporation Strategic Overview</h1>',
    '<p>Acme expanded into <b>European <script>stealCookies()</script > rail logistics</b> with <i>42 depots</i> across six countries.</p>',
    '<p>Malformed <div data-x="1>2">nested <b>tags stay plain text only and never emit raw markup</b>.</p>',
    '<noscript><p>Enable JavaScript fallback text should be skipped here.</p></noscript>',
    '<p>Unclosed script tail <script>evilPayload() should never leak into output',
    '</body></html>',
  ].join('\n');

  const out = pageText(hostile);
  assert.ok(out.includes('Acme Industrial Corporation Strategic Overview'));
  assert.ok(out.includes('Acme expanded into European'));
  assert.ok(out.includes('42 depots'));
  assert.equal(/[<>]/.test(out), false, `Expected no raw tag markup, got: ${out}`);
  assert.equal(/alert|stealCookies|evilPayload|hidden secret comment|Navigation menu/i.test(out), false);

  // Length cap enforcement (4000 chars max)
  const hugeParagraph = `<p>${'Long strategic analysis sentence about industrial operations. '.repeat(200)}</p>`;
  const capped = pageText(hugeParagraph);
  assert.ok(capped.length > 0 && capped.length <= 4000, `Expected <= 4000 chars, got ${capped.length}`);
});

test('Config: parseTrustProxy defaults to loopback and parses hop counts, booleans, and subnets', () => {
  assert.equal(parseTrustProxy(undefined), 'loopback');
  assert.equal(parseTrustProxy(''), 'loopback');
  assert.equal(parseTrustProxy('1'), 1);
  assert.equal(parseTrustProxy('2'), 2);
  assert.equal(parseTrustProxy('false'), false);
  assert.equal(parseTrustProxy('0'), false);
  assert.equal(parseTrustProxy('true'), true);
  assert.equal(parseTrustProxy('10.0.0.0/8'), '10.0.0.0/8');
});

test('Zero-key-logging: redactSecrets and redactSecretsDeep scrub all provider keys, headers, and query tokens', () => {
  const secrets = [
    'AIzaSyA1234567890abcdefghijklmnop',
    'AQ.Ab8RN61234567890abcdefghijklmnop',
    'sk-proj-1234567890abcdefghijklmnop',
    'sk-ant-api03-1234567890abcdefghij',
    'nvapi-1234567890abcdefghijklmnop',
    'gsk_1234567890abcdefghijklmnop',
    'xai-1234567890abcdefghijklmnop',
    'SUPERSECRETBEARERTOKEN12345',
    'QUERYSECRET999',
  ];
  const sample =
    `Err: ${secrets[0]} ${secrets[1]} ${secrets[2]} ${secrets[3]} ${secrets[4]} ${secrets[5]} ${secrets[6]} ` +
    `Authorization: Bearer ${secrets[7]} https://api.test/v1?key=${secrets[8]}&token=${secrets[8]}`;
  const clean = redactSecrets(sample);
  for (const s of secrets) {
    assert.equal(clean.includes(s), false, `Secret survived redaction: ${s}`);
  }
  const nested = redactSecretsDeep({ message: sample, nested: [{ err: `key=${secrets[0]}` }] });
  for (const s of secrets) {
    assert.equal(JSON.stringify(nested).includes(s), false, `Secret survived deep redaction: ${s}`);
  }
});

test('Public AI token gate: allows when unset, enforces timing-safe header/Bearer match when set', () => {
  assert.deepEqual(checkPublicAiToken({}, ''), { ok: true, required: false });
  assert.deepEqual(checkPublicAiToken({}, 'my-public-secret'), { ok: false, required: true });
  assert.deepEqual(checkPublicAiToken({ 'x-bizsim-public-token': 'wrong' }, 'my-public-secret'), { ok: false, required: true });
  assert.deepEqual(checkPublicAiToken({ 'x-bizsim-public-token': 'my-public-secret' }, 'my-public-secret'), { ok: true, required: true });
  assert.deepEqual(checkPublicAiToken({ authorization: 'Bearer my-public-secret' }, 'my-public-secret'), { ok: true, required: true });
});

test('SSE concurrency limiter: caps concurrent streams per IP and releases cleanly', () => {
  const acquire = createConcurrencyLimiter({ maxPerKey: 2, maxKeys: 5 });
  const s1 = acquire('1.2.3.4');
  const s2 = acquire('1.2.3.4');
  const s3 = acquire('1.2.3.4');
  assert.equal(s1.ok, true);
  assert.equal(s2.ok, true);
  assert.equal(s3.ok, false);
  s1.release();
  s1.release(); // idempotent
  const s4 = acquire('1.2.3.4');
  assert.equal(s4.ok, true);
  s2.release();
  s4.release();
});

test('SSRF integration: fetchText routes through safe transport and blocks private, IPv6, credential, scheme, and redirect-to-loopback targets', async () => {
  const blocked = [
    'http://127.0.0.1:8787/api/keys',
    'http://localhost:8787/api/status',
    'http://[::1]:8787/',
    'http://[::ffff:127.0.0.1]/',
    'http://169.254.169.254/latest/meta-data/',
    'file:///etc/passwd',
    'https://user:pass@example.com/',
  ];
  for (const u of blocked) {
    await assert.rejects(() => fetchText(u), `fetchText should reject ${u}`);
  }
});

test('SSE concurrency limiter: never evicts active entries under IP churn (fails closed when saturated)', () => {
  const acquire = createConcurrencyLimiter({ maxPerKey: 2, maxKeys: 3 });
  const a1 = acquire('ip-victim');
  const a2 = acquire('ip-victim');
  assert.equal(a1.ok, true);
  assert.equal(a2.ok, true);
  assert.equal(acquire('ip-victim').ok, false);

  // Fill remaining table slots with other active IPs
  const b1 = acquire('ip-other-1');
  const c1 = acquire('ip-other-2');
  assert.equal(b1.ok, true);
  assert.equal(c1.ok, true);

  // Churn many new IPs: table is saturated -> must fail closed and NEVER evict ip-victim
  for (let i = 0; i < 20; i++) {
    const churn = acquire(`churn-${i}`);
    assert.equal(churn.ok, false);
    assert.equal(churn.saturated, true);
  }

  // ip-victim MUST still be capped at 2 active streams (no bypass!)
  assert.equal(acquire('ip-victim').ok, false);

  // Releasing frees capacity cleanly
  b1.release();
  const fresh = acquire('ip-fresh');
  assert.equal(fresh.ok, true);
  a1.release();
  a2.release();
  c1.release();
  fresh.release();
});

test('ADA accessibility: every built-in season (all 200), Live Research, and Chat Builder cover gets descriptive alt text', () => {
  assert.equal(CASES.length, 200);
  for (const c of CASES) {
    const img = SEASON_IMAGES[c.id] || null;
    const alt = buildCoverAlt(c, img);
    assert.equal(typeof alt, 'string');
    assert.ok(alt.length >= 10, `Alt text too short for ${c.id}: ${alt}`);
    assert.ok(alt.includes(c.title), `Alt text should reference title for ${c.id}`);
  }
  const liveAlt = buildCoverAlt({ title: 'Nvidia AI Pivot', company: 'Nvidia' }, { title: 'Nvidia Headquarters', aiGenerated: false });
  assert.ok(liveAlt.includes('Nvidia Headquarters') && liveAlt.includes('Nvidia AI Pivot'));
  const aiAlt = buildCoverAlt({ title: 'Medici Bank', company: 'Medici' }, { aiGenerated: true });
  assert.ok(aiAlt.includes('AI-generated') && aiAlt.includes('Medici Bank'));
});

test('Anti-DoS / infinite-loop protection: stripPoisonKeys rejects excessive nesting and pageText terminates quickly on malformed HTML', () => {
  // Deeply nested object (> 32 levels) must throw instead of hanging/overflowing
  let deep = { ok: true };
  for (let i = 0; i < 45; i++) deep = { nested: deep };
  assert.throws(() => stripPoisonKeys(deep), /nesting depth/i);

  // Pathological repeated unclosed tags & comments must terminate cleanly in O(n)
  const evilHtml = '<p>' + '<!-- '.repeat(2000) + '<div '.repeat(2000) + '<script>'.repeat(500) + 'Safe strategic text over thirty characters long here.</p>';
  const t0 = Date.now();
  const out = pageText(evilHtml);
  assert.ok(Date.now() - t0 < 500, 'pageText took too long on adversarial HTML');
  assert.equal(/[<>]/.test(out), false);
});
