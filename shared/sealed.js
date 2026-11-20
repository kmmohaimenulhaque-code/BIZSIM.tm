// Authenticated encryption for the AI keys a paired phone sends to the
// computer over Wi-Fi. Phone browsers on a plain http:// Wi-Fi address have no
// WebCrypto, so this uses the standard encrypt-then-MAC construction built only
// from HMAC-SHA-256:
//   keystream block i = HMAC(encKey, iv || i)       (HMAC as a PRF in counter mode)
//   tag               = HMAC(macKey, iv || ciphertext)
// encKey and macKey are derived from the session key, which never crosses the
// network. A fresh random 16-byte IV is used per message.
import { hmac, toB64url, fromB64url, utf8, safeEqual, toHex } from './sha256.js';

function derive(keyB64) {
  const k = fromB64url(keyB64);
  return { enc: hmac(k, 'bizsim-seal-enc'), mac: hmac(k, 'bizsim-seal-mac') };
}

function keystreamXor(encKey, iv, data) {
  const out = new Uint8Array(data.length);
  const ctr = new Uint8Array(iv.length + 4);
  ctr.set(iv);
  for (let block = 0; block * 32 < data.length; block++) {
    new DataView(ctr.buffer).setUint32(iv.length, block);
    const ks = hmac(encKey, ctr);
    for (let j = 0; j < 32 && block * 32 + j < data.length; j++) out[block * 32 + j] = data[block * 32 + j] ^ ks[j];
  }
  return out;
}

function randomBytes(n) {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

export function seal(keyB64, text, iv = randomBytes(16)) {
  const { enc, mac } = derive(keyB64);
  const ct = keystreamXor(enc, iv, utf8(text));
  const body = new Uint8Array(iv.length + ct.length);
  body.set(iv);
  body.set(ct, iv.length);
  const tag = hmac(mac, body);
  const out = new Uint8Array(body.length + 32);
  out.set(body);
  out.set(tag, body.length);
  return toB64url(out);
}

/** Returns the plaintext, or null if the message was altered or the key is wrong. */
export function open(keyB64, sealed) {
  let all;
  try {
    all = fromB64url(sealed);
  } catch {
    return null;
  }
  if (all.length < 16 + 32) return null;
  const { enc, mac } = derive(keyB64);
  const body = all.slice(0, all.length - 32);
  const tag = all.slice(all.length - 32);
  if (!safeEqual(toHex(hmac(mac, body)), toHex(tag))) return null;
  const pt = keystreamXor(enc, body.slice(0, 16), body.slice(16));
  return new TextDecoder().decode(pt);
}
