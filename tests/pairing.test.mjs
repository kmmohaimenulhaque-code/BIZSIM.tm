import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { sha256, hmac, toHex, claimProof, sessionKey, rotatedKey, sign, safeEqual } from '../shared/sha256.js';
import { seal, open } from '../shared/sealed.js';
import * as share from '../server/src/share.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bizsim-pair-'));

test('pure-JS SHA-256 and HMAC match Node crypto', () => {
  for (const len of [0, 1, 55, 56, 63, 64, 65, 119, 1000, 70000]) {
    const buf = crypto.randomBytes(len);
    assert.equal(toHex(sha256(new Uint8Array(buf))), crypto.createHash('sha256').update(buf).digest('hex'), `sha256 len ${len}`);
    const key = crypto.randomBytes(len % 100);
    assert.equal(toHex(hmac(new Uint8Array(key), new Uint8Array(buf))), crypto.createHmac('sha256', key).update(buf).digest('hex'), `hmac len ${len}`);
  }
  assert.equal(toHex(sha256('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const longKey = crypto.randomBytes(200);
  assert.equal(toHex(hmac(new Uint8Array(longKey), 'x')), crypto.createHmac('sha256', longKey).update('x').digest('hex'));
});

test('sealed keys round trip and detect tampering', () => {
  const key = sessionKey(crypto.randomBytes(24).toString('base64url'), 'abc');
  const msg = JSON.stringify({ AI_KEYS: 'AIzaSyFAKE' + 'x'.repeat(300) });
  const s = seal(key, msg);
  assert.equal(open(key, s), msg);
  assert.ok(!s.includes('AIza'), 'ciphertext must not contain the key');
  const bytes = Buffer.from(s, 'base64url');
  bytes[20] ^= 1;
  assert.equal(open(key, bytes.toString('base64url')), null, 'flipped bit rejected');
  assert.equal(open(sessionKey(crypto.randomBytes(24).toString('base64url'), 'abc'), s), null, 'wrong key rejected');
  assert.equal(open(key, 'short'), null);
  assert.notEqual(seal(key, msg), seal(key, msg), 'fresh IV each time');
});

function doClaim(over = {}) {
  const p = share._test.pending();
  const ts = Date.now();
  const nonce = crypto.randomBytes(8).toString('hex');
  const body = { code: p.code, ts, nonce, device: 'Test phone <script>', proof: claimProof(p.secret, p.code, ts, nonce), ...over };
  return { p, r: share.claim(body, '192.168.1.9') };
}

test('claim: valid, single use, expired, invalid proof, replay, clock skew', () => {
  share.initPairingStore(tmp);
  share._test.reset();
  share.newPairingCode();
  const { p, r } = doClaim();
  assert.equal(r.status, 200);
  assert.ok(r.body.sessionId);
  const s = share._test.store().sessions.get(r.body.sessionId);
  assert.equal(s.key, sessionKey(p.secret, r.body.sessionId), 'both sides derive the same key');
  assert.equal(s.device, 'Test phone script', 'device name sanitised');
  assert.equal(r.body.secret, undefined);

  // the same code cannot be used twice (rotated after success)
  const ts = Date.now();
  const again = share.claim({ code: p.code, ts, nonce: 'n2', proof: claimProof(p.secret, p.code, ts, 'n2') });
  assert.equal(again.status, 410);

  // wrong secret
  const bad = doClaim({ proof: claimProof(crypto.randomBytes(24).toString('base64url'), share._test.pending().code, Date.now(), 'x') });
  assert.equal(bad.r.status, 401);

  // expired code
  share._test.pending().expiresAt = Date.now() - 1;
  assert.equal(doClaim().r.status, 410);

  // clock skew
  share.newPairingCode();
  const q = share._test.pending();
  const old = Date.now() - 10 * 60_000;
  assert.equal(share.claim({ code: q.code, ts: old, nonce: 'z', proof: claimProof(q.secret, q.code, old, 'z') }).status, 400);

  // malformed
  assert.equal(share.claim(null).status, 400);
  assert.equal(share.claim({ code: 1, ts: 'x' }).status, 400);
});

function signed(session, method, p, body = '', over = {}) {
  const ts = Date.now();
  const nonce = crypto.randomBytes(8).toString('hex');
  return {
    method,
    path: p,
    body,
    headers: { 'x-bizsim-session': session.id, 'x-bizsim-ts': String(ts), 'x-bizsim-nonce': nonce, 'x-bizsim-sig': sign(session.key, { method, path: p, ts, nonce, body }), ...over },
  };
}

test('signed requests: valid, replayed, altered, unknown, expired, revoked, rotation', () => {
  share.initPairingStore(tmp);
  share._test.reset();
  share.newPairingCode();
  const { r } = doClaim();
  const s = share._test.store().sessions.get(r.body.sessionId);
  const req = signed(s, 'POST', '/api/jobs/research', '{"q":"Nokia"}');
  assert.equal(share.verifyRequest(req).ok, true);
  const replay = share.verifyRequest(req);
  assert.equal(replay.ok, false);
  assert.equal(replay.code, 'replay');

  const altered = signed(s, 'POST', '/api/jobs/research', '{"q":"Nokia"}');
  altered.body = '{"q":"Evil"}';
  assert.equal(share.verifyRequest(altered).code, 'signature');

  const otherPath = signed(s, 'GET', '/api/status');
  otherPath.path = '/api/keys';
  assert.equal(share.verifyRequest(otherPath).code, 'signature');

  assert.equal(share.verifyRequest({ method: 'GET', path: '/api/status', headers: {}, body: '' }).code, 'unpaired');
  assert.equal(share.verifyRequest(signed({ id: 'nope', key: s.key }, 'GET', '/api/status')).code, 'revoked');

  const stale = signed(s, 'GET', '/api/status', '', { 'x-bizsim-ts': String(Date.now() - 5 * 60_000) });
  assert.equal(share.verifyRequest(stale).code, 'clock');

  // rotation: new key works, old key keeps working briefly, then retires
  const next = share.rotateSession(s);
  assert.equal(next.key, rotatedKey(s.key, next.id));
  assert.equal(share.verifyRequest(signed(next, 'GET', '/api/status')).ok, true);
  assert.equal(share.verifyRequest(signed(s, 'GET', '/api/status')).ok, true, 'grace period');
  s.retireAt = Date.now() - 1;
  assert.equal(share.verifyRequest(signed(s, 'GET', '/api/status')).ok, false, 'retired after grace');

  // idle expiry
  next.lastSeen = Date.now() - share.SESSION_IDLE_MS - 1000;
  assert.equal(share.verifyRequest(signed(next, 'GET', '/api/status')).code, 'expired');

  // revocation from the computer
  share.newPairingCode();
  const { r: r2 } = doClaim();
  const s2 = share._test.store().sessions.get(r2.body.sessionId);
  assert.ok(share.revokeDevice(s2.id));
  assert.equal(share.verifyRequest(signed(s2, 'GET', '/api/status')).code, 'revoked');
});

test('sessions persist across restarts with private file permissions', () => {
  share.initPairingStore(tmp);
  share.newPairingCode();
  const { r } = doClaim();
  const file = path.join(tmp, 'pairing.json');
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o077, 0, 'not readable by other users');
  const reloaded = share.initPairingStore(tmp);
  assert.ok(reloaded.sessions.has(r.body.sessionId));
  share.revokeAll();
  assert.equal(share.initPairingStore(tmp).sessions.size, 0);
});

test('private address check', () => {
  for (const ip of ['192.168.0.4', '10.1.2.3', '172.16.0.1', '172.31.255.1', '127.0.0.1', '::1', '::ffff:192.168.1.2', 'fe80::1', 'fd12::3', '100.64.1.1']) assert.ok(share.isPrivateAddress(ip), ip);
  for (const ip of ['8.8.8.8', '172.32.0.1', '172.15.0.1', '1.1.1.1', '2001:4860::8888', '::ffff:8.8.8.8', '100.128.0.1', '']) assert.ok(!share.isPrivateAddress(ip), ip);
});

test('HTTP listener end to end: pairing, signed calls, sealed keys, plain keys refused, CORS, revoke', async () => {
  share.initPairingStore(tmp);
  share._test.reset();
  share.newPairingCode();
  const express = (await import('express')).default;
  const { open: openSealed } = await import('../shared/sealed.js');
  const app = express();
  app.use(express.json());
  app.use('/api', (req, res, next) => {
    if (req.viaLan && req.lanOrigin) res.setHeader('Access-Control-Allow-Origin', req.lanOrigin);
    next();
  });
  app.post('/api/echo', (req, res) => {
    const sealed = req.headers['x-bizsim-sealed-keys'];
    res.json({ body: req.body, keys: sealed ? JSON.parse(openSealed(req.pairSession.key, sealed)) : null });
  });
  app.get('/', (req, res) => res.send('<html>app</html>'));
  const server = http.createServer(share.lanHandler(app));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/`)).status, 200, 'app shell served');
    assert.equal((await fetch(`${base}/api/echo`, { method: 'POST' })).status, 401, 'unsigned refused');

    const p = share._test.pending();
    const ts = Date.now();
    const claimRes = await fetch(`${base}/api/pair/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' }, body: JSON.stringify({ code: p.code, ts, nonce: 'abc', device: 'Pixel', proof: claimProof(p.secret, p.code, ts, 'abc') }) });
    assert.equal(claimRes.status, 200);
    assert.equal(claimRes.headers.get('access-control-allow-origin'), 'http://localhost');
    const { sessionId } = await claimRes.json();
    const key = sessionKey(p.secret, sessionId);

    const body = JSON.stringify({ q: 'Nokia' });
    const t2 = Date.now();
    const headers = { 'Content-Type': 'application/json', 'X-Bizsim-Session': sessionId, 'X-Bizsim-Ts': String(t2), 'X-Bizsim-Nonce': 'n1', 'X-Bizsim-Sig': sign(key, { method: 'POST', path: '/api/echo', ts: t2, nonce: 'n1', body }), 'X-Bizsim-Sealed-Keys': seal(key, JSON.stringify({ AI_KEYS: 'AIzaTEST' })) };
    const ok = await fetch(`${base}/api/echo`, { method: 'POST', headers, body });
    assert.equal(ok.status, 200);
    const okBody = await ok.json();
    assert.deepEqual(okBody.body, { q: 'Nokia' }, 'body reaches the app');
    assert.equal(okBody.keys.AI_KEYS, 'AIzaTEST', 'sealed keys open on the server');

    assert.equal((await fetch(`${base}/api/echo`, { method: 'POST', headers, body })).status, 401, 'exact replay refused');

    const t3 = Date.now();
    const plain = await fetch(`${base}/api/echo`, { method: 'POST', headers: { ...headers, 'X-Bizsim-Ts': String(t3), 'X-Bizsim-Nonce': 'n3', 'X-Bizsim-Sig': sign(key, { method: 'POST', path: '/api/echo', ts: t3, nonce: 'n3', body }), 'X-BizSim-Keys': 'abc' }, body });
    assert.equal(plain.status, 400, 'plain key header refused on Wi-Fi');

    assert.equal((await fetch(`${base}/api/echo`, { method: 'POST', headers: { Origin: 'https://evil.example' } })).status, 403, 'foreign origin refused');

    const big = 'x'.repeat(400_000);
    assert.equal((await fetch(`${base}/api/echo`, { method: 'POST', body: big }).catch(() => ({ status: 413 }))).status, 413, 'oversized body refused');

    // the phone ends its own session
    const t4 = Date.now();
    const del = await fetch(`${base}/api/pair/session`, { method: 'DELETE', headers: { 'X-Bizsim-Session': sessionId, 'X-Bizsim-Ts': String(t4), 'X-Bizsim-Nonce': 'n4', 'X-Bizsim-Sig': sign(key, { method: 'DELETE', path: '/api/pair/session', ts: t4, nonce: 'n4', body: '' }) } });
    assert.equal(del.status, 200);
    const t5 = Date.now();
    const after = await fetch(`${base}/api/echo`, { method: 'POST', headers: { ...headers, 'X-Bizsim-Ts': String(t5), 'X-Bizsim-Nonce': 'n5', 'X-Bizsim-Sig': sign(key, { method: 'POST', path: '/api/echo', ts: t5, nonce: 'n5', body }) }, body });
    assert.equal(after.status, 401, 'terminated session refused');
    assert.equal((await after.json()).code, 'revoked');

    // interrupted claim (connection dropped before the reply) leaves the code usable? It is consumed on success only.
    share.newPairingCode();
    const q = share._test.pending();
    const ctrl = new AbortController();
    const tsx = Date.now();
    const pr = fetch(`${base}/api/pair/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: q.code, ts: tsx, nonce: 'zz', proof: claimProof(q.secret, q.code, tsx, 'zz') }), signal: ctrl.signal });
    ctrl.abort();
    await pr.catch(() => {});
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(share._test.pending(), 'a pairing code is always available after an interrupted attempt');

    // rate limiting after repeated failures
    let last;
    for (let i = 0; i < 25; i++) last = await fetch(`${base}/api/echo`, { method: 'POST', headers: { 'X-Bizsim-Session': 'x', 'X-Bizsim-Ts': String(Date.now()), 'X-Bizsim-Nonce': `f${i}`, 'X-Bizsim-Sig': 'bad' } });
    assert.equal(last.status, 429, 'locked out after repeated failures');
  } finally {
    server.close();
    server.closeAllConnections?.();
    share._test.reset();
  }
});

test('secrets are redacted from error text', async () => {
  const { redactSecrets } = await import('../server/src/lib/http.js');
  const out = redactSecrets('Failed: key AIzaSyA1234567890abcdefghijk and sk-ant-api03-abcdefghijklmnop and https://x.test/v1?key=SECRET123&x=1 Bearer abcdefghijklmnopq');
  for (const s of ['AIzaSyA1234567890', 'sk-ant-api03', 'SECRET123', 'abcdefghijklmnopq']) assert.ok(!out.includes(s), s);
  assert.ok(safeEqual('abc', 'abc') && !safeEqual('abc', 'abd') && !safeEqual('a', 'ab'));
});
