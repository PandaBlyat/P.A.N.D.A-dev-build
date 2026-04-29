import { deflateSync } from 'node:zlib';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const sourceDir = join(repoRoot, 'P.A.N.D.A DEV', 'gamedata', 'textures', 'ui');
const outputDir = join(repoRoot, 'tools', 'editor', 'public', 'emoji');

mkdirSync(outputDir, { recursive: true });

for (const filename of readdirSync(sourceDir).filter(name => /^panda_emoji_.*\.dds$/i.test(name))) {
  const shortcode = basename(filename, '.dds').replace(/^panda_emoji_/, '');
  const png = ddsBgra8ToPng(readFileSync(join(sourceDir, filename)));
  writeFileSync(join(outputDir, `${shortcode}.png`), png);
}

function ddsBgra8ToPng(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'DDS ') {
    throw new Error('Not a DDS file.');
  }
  const height = bytes.readUInt32LE(12);
  const width = bytes.readUInt32LE(16);
  const fourCc = bytes.toString('ascii', 84, 88);
  const hasDx10Header = fourCc === 'DX10';
  const pixelOffset = hasDx10Header ? 148 : 128;
  if (hasDx10Header) {
    const dxgiFormat = bytes.readUInt32LE(128);
    if (dxgiFormat !== 87 && dxgiFormat !== 91) {
      throw new Error(`Unsupported DDS DXGI format ${dxgiFormat}.`);
    }
  }
  const needed = width * height * 4;
  if (bytes.length < pixelOffset + needed) {
    throw new Error('DDS pixel payload too small.');
  }

  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      const src = pixelOffset + (y * width + x) * 4;
      const dst = 1 + x * 4;
      row[dst] = bytes[src + 2];
      row[dst + 1] = bytes[src + 1];
      row[dst + 2] = bytes[src];
      row[dst + 3] = bytes[src + 3];
    }
    rows.push(row);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr(width, height)),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBytes.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return out;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
