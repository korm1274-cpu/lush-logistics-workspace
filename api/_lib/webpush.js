// api/_lib/webpush.js
// Web Push 발송(외부 라이브러리 없이 표준 Web Crypto만 사용)
//   - 내용 암호화: RFC 8291(Message Encryption for Web Push) + RFC 8188(aes128gcm)
//   - 발신 서버 인증: RFC 8292(VAPID, ES256 JWT)
// 서버(Vercel Node 18+)와 브라우저에서 같은 코드가 동작하도록 globalThis.crypto.subtle 만 사용합니다.

// Node 18 일부 환경은 globalThis.crypto 가 없을 수 있어 내장 모듈(webcrypto)로 대체
const wc = (globalThis.crypto && globalThis.crypto.subtle) ? globalThis.crypto : require('crypto').webcrypto;
const subtle = wc.subtle;
const te = new TextEncoder();

function b64u(bytes) {
  let s = '';
  const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(str) {
  const s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  parts.forEach(p => { out.set(p, o); o += p.length; });
  return out;
}
async function hmac(key, data) {
  const k = await subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', k, data));
}
// HKDF(SHA-256)에서 출력 길이 32바이트 이하만 쓰므로 Expand는 한 블록(T(1))이면 충분
async function hkdf(salt, ikm, info, len) {
  const prk = await hmac(salt, ikm);
  const t1 = await hmac(prk, concat(info, new Uint8Array([1])));
  return t1.slice(0, len);
}

// 받는 기기 공개키(p256dh)·인증값(auth)으로 payload 암호화 → 요청 본문(Uint8Array)
// opts.salt / opts.serverKeys 는 시험용(고정값 검증)으로만 사용
async function encrypt(keys, payload, opts = {}) {
  const uaPublic = unb64u(keys.p256dh);
  const authSecret = unb64u(keys.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error('구독 키 형식이 올바르지 않습니다.');
  const serverKeys = opts.serverKeys || await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await subtle.exportKey('raw', serverKeys.publicKey));
  const uaKey = await subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: uaKey }, serverKeys.privateKey, 256));
  const keyInfo = concat(te.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const salt = opts.salt || wc.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const plain = concat(typeof payload === 'string' ? te.encode(payload) : payload, new Uint8Array([2])); // 마지막 레코드 구분자 0x02
  const aesKey = await subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const cipher = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, plain));
  const rs = 4096;
  const header = concat(salt, new Uint8Array([(rs >>> 24) & 255, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255]), new Uint8Array([asPublic.length]), asPublic);
  return concat(header, cipher);
}

// VAPID 키 새로 만들기 → { publicKey: 공개키(raw, base64url), privateJwk }
async function generateVapidKeys() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  const jwk = await subtle.exportKey('jwk', kp.privateKey);
  return { publicKey: b64u(pub), privateJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d } };
}
// 공개키(raw base64url) + 개인키 d(base64url) 형식(환경변수용)을 JWK로
function vapidFromRaw(publicKey, privateD) {
  const p = unb64u(publicKey);
  return { publicKey, privateJwk: { kty: 'EC', crv: 'P-256', x: b64u(p.slice(1, 33)), y: b64u(p.slice(33, 65)), d: privateD } };
}

async function vapidAuthorization(endpoint, vapid, subject) {
  const aud = new URL(endpoint).origin;
  const header = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await subtle.importKey('jwk', { ...vapid.privateJwk, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(header + '.' + claims))); // Web Crypto 서명은 JWT가 쓰는 r||s(64바이트) 형식
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${vapid.publicKey}`;
}

// 구독 1건에 발송 → { status, ok, gone }  gone=true(404/410)면 만료된 구독이므로 지워야 함
async function sendPush(subscription, payloadObj, vapid, opts = {}) {
  const body = await encrypt(subscription.keys, JSON.stringify(payloadObj));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || 8000);
  try {
    const r = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidAuthorization(subscription.endpoint, vapid, opts.subject || 'https://lush-logistics-workspace.vercel.app'),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(opts.ttl || 86400),
        Urgency: opts.urgency || 'high',
      },
      body,
      signal: ctrl.signal,
    });
    return { status: r.status, ok: r.status >= 200 && r.status < 300, gone: r.status === 404 || r.status === 410 };
  } catch (e) {
    return { status: 0, ok: false, gone: false, error: String((e && e.message) || e) };
  } finally { clearTimeout(timer); }
}

module.exports = { b64u, unb64u, encrypt, generateVapidKeys, vapidFromRaw, vapidAuthorization, sendPush };
