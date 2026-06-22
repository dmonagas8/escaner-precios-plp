const fs = require('fs');
const zlib = require('zlib');

const NAVY = [26, 26, 46];    // #1a1a2e
const RED  = [230, 57, 70];   // #e63946

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createIcon(size, stripesFn) {
  // Build raw RGBA → RGB scanlines
  const rows = [];
  for (let y = 0; y < size; y++) {
    const color = stripesFn(y, size);
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      row[1 + x * 3]     = color[0];
      row[1 + x * 3 + 1] = color[1];
      row[1 + x * 3 + 2] = color[2];
    }
    rows.push(row);
  }

  const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Stripe pattern: navy bg with 3 red horizontal bars (barcode motif)
function stripes(y, size) {
  const t = y / size;
  if (t >= 0.31 && t < 0.42) return RED;
  if (t >= 0.49 && t < 0.57) return RED;
  if (t >= 0.64 && t < 0.73) return RED;
  return NAVY;
}

fs.mkdirSync('icons', { recursive: true });
fs.writeFileSync('icons/icon-192.png', createIcon(192, stripes));
fs.writeFileSync('icons/icon-512.png', createIcon(512, stripes));
console.log('Icons generated: icons/icon-192.png (192x192), icons/icon-512.png (512x512)');
