import { Buffer } from 'buffer';
import { sha256 } from '@noble/hashes/sha2.js';
import { scrypt } from '@noble/hashes/scrypt.js';

export function createHash() {
  let input: string | Uint8Array = '';
  return {
    update(value: string | Uint8Array) { input = value; return this; },
    digest() { return Buffer.from(sha256(typeof input === 'string' ? new TextEncoder().encode(input) : input)).toString('hex'); },
  };
}
export function randomBytes(size: number) { return Buffer.from(crypto.getRandomValues(new Uint8Array(size))); }
export function scryptSync(password: string, salt: string, length: number) {
  return Buffer.from(scrypt(password, salt, { N: 16384, r: 8, p: 1, dkLen: length }));
}
export function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
