// Images: the lead image of the matching Wikipedia article (free licences only,
// via Wikimedia Commons), plus optional AI image generation (Gemini or OpenAI).
// Generated images are always labelled as AI-generated in the UI.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { fetchJson, ttlCache } from '../lib/http.js';
import { geminiGenerate } from '../ai/geminiModels.js';
import { wikiLeadImage, wikiImageForQuery } from '../../../shared/wikiImage.js';
import { buildSafeImagePrompt } from '../../../shared/imagePolicy.js';

const searchCache = ttlCache(24 * 3600 * 1000, 300);

/** `q` may be an exact article title (wiki:Title) or free text. */
export async function searchImages(q) {
  const query = String(q || '').trim().slice(0, 100);
  if (!query) return [];
  const hit = searchCache.get(query.toLowerCase());
  if (hit) return hit;
  const img = query.startsWith('wiki:') ? await wikiLeadImage(query.slice(5)) : await wikiImageForQuery(query);
  return searchCache.set(query.toLowerCase(), img ? [img] : []);
}

export function imageGenerationEnabled() {
  const { provider: p, geminiKey, openaiKey } = config.images;
  return (p === 'gemini' && Boolean(geminiKey)) || (p === 'openai' && Boolean(openaiKey));
}

export async function generateImage(prompt) {
  if (!imageGenerationEnabled()) throw new Error('Image generation is not configured');
  const clean = String(prompt || '').slice(0, 400);
  const full = buildSafeImagePrompt(clean);
  if (!full) return null;
  const hash = crypto.createHash('sha256').update(`${config.images.provider}|${full}`).digest('hex').slice(0, 24);
  const dir = path.join(config.dataDir, 'generated');
  const file = path.join(dir, `${hash}.png`);
  const publicUrl = `/generated/${hash}.png`;
  try {
    await fs.access(file);
    return { url: publicUrl, prompt: clean, provider: config.images.provider, aiGenerated: true, cached: true };
  } catch {
    /* not cached */
  }

  let b64;
  if (config.images.provider === 'gemini') {
    const d = await geminiGenerate({
      kind: 'image',
      configured: config.images.geminiModel,
      key: config.images.geminiKey,
      timeout: 90000,
      maxBytes: 30_000_000,
      body: { contents: [{ parts: [{ text: full }] }], generationConfig: { responseModalities: ['IMAGE'] } },
    });
    b64 = (d.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data)?.inlineData.data;
  } else {
    const d = await fetchJson('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      timeout: 120000,
      maxBytes: 30_000_000,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.images.openaiKey}` },
      body: JSON.stringify({ model: config.images.openaiModel, prompt: full, size: '1536x1024', n: 1 }),
    });
    b64 = d.data?.[0]?.b64_json;
  }
  if (!b64) throw new Error('The image provider returned no image');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, Buffer.from(b64, 'base64'));
  return { url: publicUrl, prompt: clean, provider: config.images.provider, aiGenerated: true, cached: false };
}
