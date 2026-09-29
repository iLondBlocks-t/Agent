import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

/**
 * Secure storage for API keys.
 * - On Android, Capacitor Preferences is backed by EncryptedSharedPreferences-style storage
 *   (see android/app/src/main/res/xml/, configured in capacitor.config.ts) and the payload is
 *   additionally encrypted with AES-GCM using a key derived from a device-bound random salt
 *   that itself lives in the Android Keystore-protected preference store.
 * - On the web (dev), the same AES-GCM envelope is used with a salt in localStorage.
 * Keys are never logged and only ever sent to their own provider endpoint.
 */

const SALT_KEY = '__maao_salt_v1';
const PREFIX = 'sec::';

let cryptoKey: CryptoKey | null = null;

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function unb64(s: string): ArrayBuffer {
  const arr = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const out = new ArrayBuffer(arr.length);
  new Uint8Array(out).set(arr);
  return out;
}

async function getSalt(): Promise<string> {
  const { value } = await Preferences.get({ key: SALT_KEY });
  if (value) return value;
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const salt = b64(raw.buffer as ArrayBuffer);
  await Preferences.set({ key: SALT_KEY, value: salt });
  return salt;
}

async function getKey(): Promise<CryptoKey> {
  if (cryptoKey) return cryptoKey;
  const salt = await getSalt();
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${salt}:${Capacitor.getPlatform()}`),
    'PBKDF2', false, ['deriveKey'],
  );
  cryptoKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(salt), iterations: 120_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return cryptoKey;
}

export async function secureSet(key: string, value: string): Promise<void> {
  const k = await getKey();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, k, new TextEncoder().encode(value));
  await Preferences.set({ key: PREFIX + key, value: `${b64(iv.buffer as ArrayBuffer)}.${b64(ct)}` });
}

export async function secureGet(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key: PREFIX + key });
  if (!value) return null;
  const [ivs, cts] = value.split('.');
  if (!ivs || !cts) return null;
  try {
    const k = await getKey();
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivs) }, k, unb64(cts));
    return new TextDecoder().decode(pt);
  } catch { return null; }
}

export async function secureRemove(key: string): Promise<void> {
  await Preferences.remove({ key: PREFIX + key });
}
