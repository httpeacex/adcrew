import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { uploadType } from '../src/lib/upload-type.ts';
function container(brand: string) { const bytes = Buffer.alloc(24); bytes.writeUInt32BE(24); bytes.write('ftyp', 4); bytes.write(brand, 8); bytes.write('isom', 16); return bytes; }
test('MP4 detection rejects image containers even with a compatible isom brand', () => {
  assert.equal(uploadType(readFileSync('fixtures/creative.mp4')), 'video/mp4');
  for (const brand of ['avif', 'avis', 'heic', 'qt  ']) assert.equal(uploadType(container(brand)), '');
  const truncated = container('mp42'); truncated.writeUInt32BE(1024); assert.equal(uploadType(truncated), '');
  assert.equal(uploadType(readFileSync('fixtures/creative.png')), 'image/png');
});
