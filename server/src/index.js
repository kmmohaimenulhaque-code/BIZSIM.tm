import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config, llmModel, requestKeys, KEY_NAMES } from './config.js';
import { testKey, saveSettings, loadSavedSettings, describeKeys, updateChain, PROVIDERS } from './ai/keys.js';
import { runResearch, STAGES } from './research/pipeline.js';
import { chatTurn } from './ai/chatBuilder.js';
import { startJob, getJob, streamJob } from './jobs.js';
import { searchImages, generateImage, imageGenerationEnabled } from './images/index.js';
import { llmEnabled } from './ai/llm.js';
import { currentGeminiModel } from './ai/geminiModels.js';
import { fetchJson, rateLimiter, redactSecrets, redactSecretsDeep, ttlCache } from './lib/http.js';
import { createConcurrencyLimiter, checkPublicAiToken } from './lib/netSafety.js';
import { CASES } from '../../shared/cases/index.js';
import { cleanLocale } from '../../shared/locales.js';
import { BOOKS, PRINCIPLES } from '../../shared/books.js';
import { CATALOGUE } from '../../shared/catalogue.js';
import { enableShare, disableShare, shareState, initPairingStore, revokeDevice, revokeAll, newPairingCode } from './share.js';
import { open as openSealed } from '../../shared/sealed.js';
import { DEFAULT_UPDATE_REPO, normalizeRelease } from '../../shared/updateCheck.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

export function createApp({ clientDist = config.clientDist } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  const logSecurityEvent = (event, req, detail = '') => {
    const ip = req?.ip || 'unknown';
    const pathOnly = String(req?.path || '').slice(0, 120);
    const note = detail ? ` (${redactSecrets(detail).slice(0, 120)})` : '';
    console.warn(`[security] ${event} ip=${ip} path=${pathOnly}${note}`);
  };

  // Reject overly long URLs/query strings early (DDoS / log-bloat defense).
  app.use((req, res, next) => {
    if (String(req.url || '').length > 2048) {
      logSecurityEvent('uri_too_long', req);
      return res.status(414).json({ error: 'Request URI too long.' });
    }
    next();
  });
  app.use(express.json({ limit: '200kb' }));

  app.use((req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body) => json(body && typeof body.error === 'string' ? { ...body, error: redactSecrets(body.error) } : body);
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' https://upload.wikimedia.org https://thumb.wikimedia.org https://commons.wikimedia.org http://localhost:* http://127.0.0.1:* data: blob:; " +
        "style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; " +
        "connect-src 'self' https: http://localhost:* http://127.0.0.1:*; " +
        "object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
    );
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    if (req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // CORS for the API, so mobile (Capacitor) and other front-ends can call it.
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    // The Wi-Fi listener sets its own, narrower CORS policy (see share.js).
    if (req.viaLan) {
      if (req.lanOrigin) res.setHeader('Access-Control-Allow-Origin', req.lanOrigin);
      return next();
    }
    const allowAll = config.corsOrigins.includes('*');
    const isLocalPortOrigin =
      !config.corsOriginsExplicit &&
      typeof origin === 'string' &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    if (origin && (allowAll || config.corsOrigins.includes(origin) || isLocalPortOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', allowAll ? '*' : origin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-BizSim-Keys, X-BizSim-Admin, X-BizSim-Public-Token, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Global bounded rate limit across all /api/* traffic (120 req/min/IP).
  // Stricter per-route limiters remain in force on expensive/sensitive endpoints below.
  app.use('/api', rateLimiter({ windowMs: 60_000, max: 120 }));

  // Device keys: a user's own API keys sent with their requests (never stored on the server).
  // Over Wi-Fi they arrive sealed with the pairing session key (shared/sealed.js);
  // plain key headers are refused there by share.js. Keys are never logged.
  app.use('/api', (req, res, next) => {
    let json = null;
    if (req.viaLan) {
      const sealed = req.headers['x-bizsim-sealed-keys'];
      if (sealed && req.pairSession) json = openSealed(req.pairSession.key, String(sealed));
      if (sealed && json == null) return res.status(400).json({ error: 'Could not read the keys sent by this device. Pair again.' });
    } else if (req.headers['x-bizsim-keys']) {
      try {
        json = decodeURIComponent(Buffer.from(String(req.headers['x-bizsim-keys']), 'base64').toString('utf8'));
      } catch {
        json = null;
      }
    }
    if (!json) return next();
    let keys = {};
    try {
      const parsed = JSON.parse(json);
      for (const k of KEY_NAMES) if (typeof parsed?.[k] === 'string' && parsed[k].length < (k === 'AI_KEYS' ? 24000 : 400)) keys[k] = parsed[k];
    } catch {
      keys = {};
    }
    requestKeys.run(keys, next);
  });

  // A web page open in the user's browser can send requests to localhost. Only
  // the BIZSIM page itself (same origin, a localhost Host header, so DNS
  // rebinding fails) may use the management endpoints.
  const sameOriginLocal = (req) => {
    const host = String(req.headers.host || '');
    if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host)) return false;
    const origin = req.headers.origin;
    if (origin && origin !== `http://${host}`) return false;
    const site = req.headers['sec-fetch-site'];
    return !site || site === 'same-origin' || site === 'none';
  };

  // Who may change the keys saved on this server: the computer itself, or an admin token.
  const timingSafeEq = (a, b) => {
    const ba = Buffer.from(String(a || ''), 'utf8');
    const bb = Buffer.from(String(b || ''), 'utf8');
    return ba.length > 0 && ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  };

  const canManage = (req) => {
    if (config.adminToken && timingSafeEq(req.headers['x-bizsim-admin'], config.adminToken)) return true;
    if (!sameOriginLocal(req)) return false;
    const ip = req.ip || '';
    const loop = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
    return loop && !req.viaLan;
  };

  app.get('/api/keys', (req, res) => {
    res.json({ manage: canManage(req), providers: PROVIDERS, ...(canManage(req) ? describeKeys() : {}) });
  });

  app.post('/api/keys/test', rateLimiter({ windowMs: 60_000, max: 12 }), async (req, res) => {
    try {
      res.json(await testKey({ key: req.body?.key, baseUrl: req.body?.baseUrl }));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  const keysLimit = rateLimiter({ windowMs: 60_000, max: 30 });
  app.post('/api/keys', keysLimit, async (req, res) => {
    if (!canManage(req)) {
      logSecurityEvent('admin_denied', req, 'POST /api/keys');
      return res.status(403).json({ error: 'Keys can only be saved on the server from the computer it runs on.' });
    }
    try {
      await saveSettings(req.body?.settings || {});
      res.json({ ok: true, ...describeKeys() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/keys/chain', keysLimit, async (req, res) => {
    if (!canManage(req)) {
      logSecurityEvent('admin_denied', req, 'POST /api/keys/chain');
      return res.status(403).json({ error: 'Keys can only be changed on the computer BIZSIM runs on.' });
    }
    try {
      res.json({ ok: true, ...(await updateChain(req.body?.op)) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/status', (req, res) => {
    res.json({
      name: 'BIZSIM',
      version: pkg.version,
      ai: {
        enabled: llmEnabled(),
        provider: config.llm.provider,
        model: (config.llm.provider === 'gemini' && config.llm.model === 'auto' && currentGeminiModel('text', config.llm.chain[0]?.key)) || llmModel(),
        fallbacks: Math.max(0, config.llm.chain.reduce((n, e) => n + Math.max(1, e.models.length), 0) - 1),
      },
      images: { search: 'Wikipedia', generation: imageGenerationEnabled() ? config.images.provider : null },
      sec: Boolean(config.secUserAgent),
      desktop: process.env.BIZSIM_DESKTOP === '1',
      stages: STAGES,
    });
  });

  // Universal release update checker (cached 30 min, SSRF-safe, zero tracking).
  const updateCache = ttlCache(30 * 60_000, 4);
  const updateLimit = rateLimiter({ windowMs: 60_000, max: 12 });
  app.get('/api/update/check', updateLimit, async (req, res) => {
    if (process.env.BIZSIM_DISABLE_UPDATE_CHECK === '1') {
      return res.json({ ok: false, disabled: true, currentVersion: pkg.version });
    }
    const rawRepo = String(process.env.BIZSIM_UPDATE_REPO || DEFAULT_UPDATE_REPO).trim();
    const repo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(rawRepo) ? rawRepo : DEFAULT_UPDATE_REPO;
    const cached = updateCache.get(repo);
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.json(cached);
    }
    try {
      const raw = await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`, {
        timeout: 8000,
        maxBytes: 512_000,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      const norm = normalizeRelease(raw, pkg.version, 'web', repo);
      if (!norm) return res.status(502).json({ ok: false, error: 'Invalid release metadata.' });
      const payload = { ok: true, ...norm, checkedAt: new Date().toISOString() };
      updateCache.set(repo, payload);
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.json(payload);
    } catch {
      return res.status(502).json({ ok: false, offline: true, currentVersion: pkg.version, error: 'Could not reach GitHub Releases.' });
    }
  });

  // Wi-Fi sharing controls, only from the computer itself (desktop app).
  const loopbackOnly = (req, res, next) => {
    const ip = req.socket.remoteAddress || '';
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip) && !req.viaLan;
    if (!local || !sameOriginLocal(req) || process.env.BIZSIM_DESKTOP !== '1') return res.status(403).json({ error: 'Only available in the desktop app on this computer' });
    next();
  };
  const shareLimit = rateLimiter({ windowMs: 60_000, max: 30 });
  app.use('/api/share', shareLimit);
  app.get('/api/share', loopbackOnly, (req, res) => res.json(shareState()));
  app.post('/api/share', loopbackOnly, async (req, res) => {
    try {
      res.json(req.body?.enabled ? await enableShare(app, config.dataDir) : await disableShare());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post('/api/share/code', loopbackOnly, (req, res) => {
    newPairingCode();
    res.json(shareState());
  });
  app.post('/api/share/revoke', loopbackOnly, (req, res) => {
    if (req.body?.all) revokeAll();
    else if (typeof req.body?.id === 'string') revokeDevice(req.body.id);
    res.json(shareState());
  });

  // Pre-serialize & gzip static catalog endpoints once to cut egress bandwidth (~75-80%)
  // and prevent repeated heavy JSON downloads from exhausting server bandwidth.
  const makeStaticJsonResponder = (data) => {
    const raw = Buffer.from(JSON.stringify(data), 'utf8');
    const gz = zlib.gzipSync(raw, { level: 6 });
    return (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Vary', 'Accept-Encoding');
      if (/\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''))) {
        res.setHeader('Content-Encoding', 'gzip');
        return res.send(gz);
      }
      return res.send(raw);
    };
  };
  const catalogLimit = rateLimiter({ windowMs: 60_000, max: 30 });
  app.get('/api/cases', catalogLimit, makeStaticJsonResponder(CASES));
  app.get('/api/library', catalogLimit, makeStaticJsonResponder({ books: BOOKS, principles: PRINCIPLES }));
  app.get('/api/catalogue', catalogLimit, makeStaticJsonResponder(CATALOGUE));

  // Optional public-web AI gate: active only when BIZSIM_PUBLIC_AI_TOKEN is set.
  const publicAiGate = (req, res, next) => {
    const check = checkPublicAiToken(req.headers, config.publicAiToken);
    if (!check.ok) {
      logSecurityEvent('public_ai_token_denied', req);
      return res.status(401).json({ error: 'Public AI access token required.' });
    }
    next();
  };

  // Cap concurrent long-lived SSE streams per IP (prevents connection exhaustion).
  const sseSlot = createConcurrencyLimiter({ maxPerKey: 3, maxKeys: 5_000 });
  const SSE_IDLE_MS = 300_000;
  const SSE_MAX_MS = 600_000;

  const researchLimit = rateLimiter({ windowMs: 60_000, max: 8 });

  // Server-Sent Events: stream real stage progress and sources as they arrive.
  app.get('/api/research/stream', publicAiGate, researchLimit, async (req, res) => {
    const slot = sseSlot(req.ip || 'local');
    if (!slot.ok) {
      res.setHeader('Retry-After', '15');
      return res.status(429).json({ error: 'Too many active streams from this address. Please wait for a task to finish.' });
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    let closed = false;
    let idleTimer = null;
    let maxTimer = null;
    const finish = () => {
      if (closed) return;
      closed = true;
      clearInterval(ping);
      if (idleTimer) clearTimeout(idleTimer);
      if (maxTimer) clearTimeout(maxTimer);
      slot.release();
      res.end();
    };
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!closed) {
          res.write(`event: failure\ndata: ${JSON.stringify({ message: 'Stream closed due to inactivity.' })}\n\n`);
          res.write(`event: end\ndata: {}\n\n`);
        }
        finish();
      }, SSE_IDLE_MS);
    };
    req.on('close', finish);
    const emit = (event, data) => {
      if (!closed) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(redactSecretsDeep(data))}\n\n`);
        resetIdle();
      }
    };
    const ping = setInterval(() => !closed && res.write(': ping\n\n'), 15000);
    resetIdle();
    maxTimer = setTimeout(() => {
      if (!closed) {
        res.write(`event: failure\ndata: ${JSON.stringify({ message: 'Stream reached maximum duration.' })}\n\n`);
        res.write(`event: end\ndata: {}\n\n`);
      }
      finish();
    }, SSE_MAX_MS);
    try {
      await runResearch(req.query.q, emit, { generate: req.query.generate !== '0', locale: cleanLocale(req.query.locale) });
    } catch (e) {
      emit('failure', { message: redactSecrets(e?.message || 'Research failed') });
    } finally {
      emit('end', {});
      finish();
    }
  });

  // Background jobs: research and the chat builder keep running when the app
  // disconnects, and the app can reconnect and replay what it missed.
  app.post('/api/jobs/research', publicAiGate, researchLimit, (req, res) => {
    const q = String(req.body?.q || '').trim();
    if (q.length < 2) return res.status(400).json({ error: 'Enter a company name.' });
    try {
      const locale = cleanLocale(req.body?.locale);
      const job = startJob('research', { q, locale }, (emit) => runResearch(q, emit, { generate: req.body?.generate !== false, locale }));
      res.json({ id: job.id });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });
  const chatLimit = rateLimiter({ windowMs: 60_000, max: 10 });
  app.post('/api/jobs/chat', publicAiGate, chatLimit, (req, res) => {
    if (!llmEnabled()) return res.status(400).json({ error: 'The chat builder needs an AI key. Add one in Settings > AI keys.' });
    try {
      const job = startJob('chat', {}, (emit) => chatTurn({ messages: req.body?.messages, userPrinciples: req.body?.userPrinciples, locale: cleanLocale(req.body?.locale) }, emit));
      res.json({ id: job.id });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });
  const eventsLimit = rateLimiter({ windowMs: 60_000, max: 60 });
  app.get('/api/jobs/:id/events', eventsLimit, (req, res) => {
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'This task is no longer on the server (it may have restarted). Please run it again.' });
    const slot = sseSlot(req.ip || 'local');
    if (!slot.ok) {
      res.setHeader('Retry-After', '15');
      return res.status(429).json({ error: 'Too many active streams from this address. Please wait for a task to finish.' });
    }
    streamJob(job, req.query.from, req, res, { onClose: () => slot.release(), idleMs: SSE_IDLE_MS, maxMs: SSE_MAX_MS });
  });

  // Chat season builder: natural language in, playable seasons out (streamed).
  app.post('/api/chat', publicAiGate, chatLimit, async (req, res) => {
    if (!llmEnabled()) return res.status(400).json({ error: 'The chat builder needs an AI key. Add one in Settings > AI keys.' });
    const slot = sseSlot(req.ip || 'local');
    if (!slot.ok) {
      res.setHeader('Retry-After', '15');
      return res.status(429).json({ error: 'Too many active streams from this address. Please wait for a task to finish.' });
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    let closed = false;
    let idleTimer = null;
    let maxTimer = null;
    const finish = () => {
      if (closed) return;
      closed = true;
      clearInterval(ping);
      if (idleTimer) clearTimeout(idleTimer);
      if (maxTimer) clearTimeout(maxTimer);
      slot.release();
      res.end();
    };
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!closed) {
          res.write(`event: failure\ndata: ${JSON.stringify({ message: 'Stream closed due to inactivity.' })}\n\n`);
          res.write(`event: end\ndata: {}\n\n`);
        }
        finish();
      }, SSE_IDLE_MS);
    };
    res.on('close', finish);
    const emit = (event, data) => {
      if (!closed) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(redactSecretsDeep(data))}\n\n`);
        resetIdle();
      }
    };
    const ping = setInterval(() => !closed && res.write(': ping\n\n'), 15000);
    resetIdle();
    maxTimer = setTimeout(() => {
      if (!closed) {
        res.write(`event: failure\ndata: ${JSON.stringify({ message: 'Stream reached maximum duration.' })}\n\n`);
        res.write(`event: end\ndata: {}\n\n`);
      }
      finish();
    }, SSE_MAX_MS);
    try {
      await chatTurn({ messages: req.body?.messages, userPrinciples: req.body?.userPrinciples, locale: cleanLocale(req.body?.locale) }, emit);
    } catch (e) {
      emit('failure', { message: redactSecrets(e?.message || 'The chat builder failed') });
    } finally {
      emit('end', {});
      finish();
    }
  });

  app.post('/api/research', publicAiGate, researchLimit, async (req, res) => {
    try {
      res.json(await runResearch(req.body?.query, undefined, { generate: req.body?.generate !== false, locale: cleanLocale(req.body?.locale) }));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  const imageSearchLimit = rateLimiter({ windowMs: 60_000, max: 30 });
  app.get('/api/images/search', imageSearchLimit, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json(await searchImages(req.query.q));
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });

  app.post('/api/images/generate', publicAiGate, rateLimiter({ windowMs: 60_000, max: 4 }), async (req, res) => {
    try {
      const img = await generateImage(req.body?.prompt);
      if (!img) return res.status(400).json({ error: 'Image prompt rejected by content safety policy.', blocked: true });
      res.json(img);
    } catch (e) {
      res.status(imageGenerationEnabled() ? 502 : 412).json({ error: e.message });
    }
  });

  app.use('/generated', express.static(path.join(config.dataDir, 'generated'), { maxAge: '30d', immutable: true, dotfiles: 'deny' }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built client (single-page app) from memory with rate limiting (CodeQL clean).
  const indexFile = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexFile)) {
    const indexHtml = fs.readFileSync(indexFile, 'utf8');
    app.use(express.static(clientDist, { index: false, maxAge: '1h', dotfiles: 'deny' }));
    app.get('*', rateLimiter({ windowMs: 60_000, max: 120 }), (_req, res) => {
      res.type('html').send(indexHtml);
    });
  }

  // Final Express error handler: always redact secrets and never expose stack traces.
  app.use((err, _req, res, _next) => {
    const status = err?.status || err?.statusCode || 500;
    const msg = status === 413 ? 'Request payload too large.' : redactSecrets(err?.message || 'Internal server error');
    res.status(status).json({ error: msg });
  });

  return app;
}

export async function startServer({ port = config.port, host = config.host, clientDist } = {}) {
  await loadSavedSettings();
  initPairingStore(config.dataDir);
  const app = createApp({ clientDist });
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.headersTimeout = 15_000;
    server.keepAliveTimeout = 65_000;
    server.maxHeadersCount = 64;
    server.maxConnections = Number(process.env.MAX_CONNECTIONS || 512);
    server.once('error', reject);
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', redactSecrets(err?.message || String(err)));
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', redactSecrets(err?.message || String(err)));
  });
  const server = await startServer();
  const { port } = server.address();
  console.log(`BIZSIM server running on http://localhost:${port}`);
  console.log(`  AI case synthesis: ${llmEnabled() ? `${config.llm.provider} (${llmModel()})` : 'off (add a key in Settings, or set GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY or AI_KEYS)'}`);
  console.log(`  Image generation:  ${imageGenerationEnabled() ? config.images.provider : 'off (Wikipedia images only)'}`);
  console.log(`  SEC EDGAR:         ${config.secUserAgent ? 'on' : 'off, set SEC_USER_AGENT="Your Name your@email.com"'}`);
  if (process.env.NODE_ENV === 'production' && config.corsOrigins.includes('*')) {
    console.warn('  WARNING: CORS_ORIGINS includes "*" in production; set explicit origin(s) instead.');
  }
}
