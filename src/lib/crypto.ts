/**
 * Web Crypto API based encryption for API keys.
 * Uses AES-GCM with a key derived from a device-stable salt via PBKDF2.
 * Keys are encrypted before storing in IndexedDB — never in plaintext.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 200_000;
const SALT = new TextEncoder().encode('money-tracker-v1-salt');

let cachedKey: CryptoKey | null = null;

async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  // Derive a stable key from a device identifier + app secret
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getDeviceFingerprint()),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  cachedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  return cachedKey;
}

/** Creates a stable device fingerprint from available browser data */
function getDeviceFingerprint(): string {
  const parts = [
    navigator.userAgent || '',
    navigator.language || '',
    screen?.colorDepth?.toString() || '',
    screen?.width?.toString() || '',
    screen?.height?.toString() || '',
    new Date().getTimezoneOffset().toString(),
  ];
  return parts.join('|');
}

/** Encrypt a plaintext string. Returns base64-encoded ciphertext. */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) return '';
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );
  // Prepend IV to ciphertext for decryption
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/** Decrypt a base64-encoded ciphertext back to plaintext. */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext) return '';
  try {
    const key = await getEncryptionKey();
    const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    // If decryption fails (e.g. data from old plaintext version), return as-is
    return ciphertext;
  }
}
