export function uploadType(bytes: Uint8Array) {
  const start = Buffer.from(bytes.subarray(0, 12));
  if (start.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (start[0] === 255 && start[1] === 216 && start[2] === 255) return 'image/jpeg';
  if (start.toString('ascii', 0, 4) === 'RIFF' && start.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 16 && start.toString('ascii', 4, 8) === 'ftyp') {
    const buffer = Buffer.from(bytes);
    const size = buffer.readUInt32BE(0);
    if (size < 16 || size > bytes.length || size > 4096 || size % 4 !== 0) return '';
    const brands = [buffer.toString('ascii', 8, 12)];
    for (let offset = 16; offset < size; offset += 4) brands.push(buffer.toString('ascii', offset, offset + 4));
    if (brands.some(brand => ['avif', 'avis', 'heic', 'heix', 'mif1', 'msf1', 'qt  '].includes(brand))) return '';
    if (brands.some(brand => ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V '].includes(brand))) return 'video/mp4';
  }
  return '';
}
