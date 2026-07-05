/**
 * JARVIS Encryption Utilities
 * Lightweight client-side encryption for sensitive data
 * Uses Web Crypto API (AES-GCM) — no external dependencies
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

/**
 * Generate a new encryption key
 */
export async function generateEncryptionKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
  const exported = await crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(exported);
}

/**
 * Encrypt a string using AES-GCM
 */
export async function encrypt(plaintext: string, keyBase64: string): Promise<string> {
  const keyData = base64ToArrayBuffer(keyBase64);
  const key = await crypto.subtle.importKey("raw", keyData, { name: ALGORITHM }, false, ["encrypt"]);

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  // Combine IV + ciphertext for storage
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypt a string using AES-GCM
 */
export async function decrypt(encryptedBase64: string, keyBase64: string): Promise<string> {
  const combined = base64ToArrayBuffer(encryptedBase64);
  const keyData = base64ToArrayBuffer(keyBase64);
  const key = await crypto.subtle.importKey("raw", keyData, { name: ALGORITHM }, false, ["decrypt"]);

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: new Uint8Array(iv) },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Hash a string (SHA-256) — one-way, for verification
 */
export async function hashString(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return arrayBufferToBase64(hash);
}

// ─── Helpers ───────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}