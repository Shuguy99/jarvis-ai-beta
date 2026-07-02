/**
 * JARVIS Icon Generator
 * Generates a 256x256 PNG of the JARVIS arc reactor icon using zero external dependencies.
 * Output: icon.png (valid PNG) + icon.ico (placeholder — renamed PNG)
 *
 * For production ICO with proper multi-resolution support, run on a machine with ImageMagick:
 *   convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
 */

import { createWriteStream } from 'fs';
import { deflateSync } from 'zlib';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIZE = 256;
const CX = SIZE / 2;
const CY = SIZE / 2;

// ─── Color helpers ─────────────────────────────────────────────────────────

const CYAN = [0, 229, 255];      // #00e5ff
const WHITE = [255, 255, 255];
const BG_DARK = [5, 10, 18];     // #050a12
const BG_CENTER = [10, 22, 40];  // #0a1628

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
  return c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
}

// ─── Pixel buffer ──────────────────────────────────────────────────────────

const pixels = new Uint8Array(SIZE * SIZE * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const idx = (y * SIZE + x) * 4;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
  pixels[idx + 3] = a;
}

function alphaBlend(x, y, r, g, b, a) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const idx = (y * SIZE + x) * 4;
  const srcA = a / 255;
  const dstA = pixels[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA === 0) return;
  pixels[idx] = Math.round((r * srcA + pixels[idx] * dstA * (1 - srcA)) / outA);
  pixels[idx + 1] = Math.round((g * srcA + pixels[idx + 1] * dstA * (1 - srcA)) / outA);
  pixels[idx + 2] = Math.round((b * srcA + pixels[idx + 2] * dstA * (1 - srcA)) / outA);
  pixels[idx + 3] = Math.round(outA * 255);
}

// ─── Drawing primitives ────────────────────────────────────────────────────

function drawCircle(cx, cy, radius, color, width, opacity = 1) {
  const r = Math.round(color[0] * opacity);
  const g = Math.round(color[1] * opacity);
  const b = Math.round(color[2] * opacity);
  const a = Math.round(255 * opacity);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const innerEdge = radius - width / 2;
      const outerEdge = radius + width / 2;

      if (dist >= innerEdge && dist <= outerEdge) {
        const centerDist = Math.abs(dist - radius);
        const edgeFade = Math.min(centerDist / (width / 2), 1);
        const aa = Math.max(0, 1 - edgeFade * 1.5);
        alphaBlend(x, y, r, g, b, Math.round(a * aa));
      }
    }
  }
}

function drawFilledCircle(cx, cy, radius, color, opacity = 1) {
  const r = Math.round(color[0] * opacity);
  const g = Math.round(color[1] * opacity);
  const b = Math.round(color[2] * opacity);
  const a = Math.round(255 * opacity);

  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= radius) {
        alphaBlend(x, y, r, g, b, a);
      }
    }
  }
}

function drawRadialGlow(cx, cy, radius, color, intensity = 1) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= radius) {
        const t = 1 - dist / radius;
        const alpha = t * t * intensity * 255;
        alphaBlend(x, y, color[0], color[1], color[2], Math.round(alpha));
      }
    }
  }
}

function drawLine(x1, y1, x2, y2, color, width, opacity = 1) {
  const r = Math.round(color[0] * opacity);
  const g = Math.round(color[1] * opacity);
  const b = Math.round(color[2] * opacity);
  const a = Math.round(255 * opacity);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(len * 2);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;

    for (let oy = -width; oy <= width; oy++) {
      for (let ox = -width; ox <= width; ox++) {
        if (ox * ox + oy * oy <= width * width) {
          alphaBlend(Math.round(px + ox), Math.round(py + oy), r, g, b, a);
        }
      }
    }
  }
}

function drawArc(cx, cy, radius, startAngle, endAngle, color, width, opacity = 1) {
  const r = Math.round(color[0] * opacity);
  const g = Math.round(color[1] * opacity);
  const b = Math.round(color[2] * opacity);
  const a = Math.round(255 * opacity);

  const steps = Math.ceil((endAngle - startAngle) * radius * 2);
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / steps);
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;

    for (let oy = -width; oy <= width; oy++) {
      for (let ox = -width; ox <= width; ox++) {
        if (ox * ox + oy * oy <= width * width) {
          alphaBlend(Math.round(px + ox), Math.round(py + oy), r, g, b, a);
        }
      }
    }
  }
}

// ─── Render the icon ───────────────────────────────────────────────────────

function renderIcon() {
  // 1. Background with radial gradient
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dist = Math.sqrt((x - CX) ** 2 + (y - CY) ** 2) / (SIZE / 2);
      const t = Math.min(dist, 1);
      const color = lerpColor(BG_CENTER, BG_DARK, t);
      setPixel(x, y, color[0], color[1], color[2], 255);
    }
  }

  // 2. Outer glow circle (very subtle)
  drawCircle(CX, CY, 100, CYAN, 1, 0.15);

  // 3. Outer ring
  drawCircle(CX, CY, 90, CYAN, 2.5, 0.9);
  drawCircle(CX, CY, 90, CYAN, 5, 0.2);

  // 4. Tick marks (8 directions)
  const tickAngles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (3 * Math.PI) / 2, (7 * Math.PI) / 4];
  for (const angle of tickAngles) {
    const innerR = 82;
    const outerR = 92;
    drawLine(
      CX + Math.cos(angle) * innerR,
      CY + Math.sin(angle) * innerR,
      CX + Math.cos(angle) * outerR,
      CY + Math.sin(angle) * outerR,
      CYAN, 1, 0.7
    );
  }

  // 5. Middle ring (dashed effect — draw arc segments)
  const dashCount = 24;
  const dashArc = (2 * Math.PI) / (dashCount * 2);
  for (let i = 0; i < dashCount; i++) {
    const start = i * dashArc * 2;
    const end = start + dashArc;
    drawArc(CX, CY, 68, start, end, CYAN, 1.5, 0.6);
  }

  // 6. Highlight arcs on middle ring
  drawArc(CX, CY, 68, -Math.PI / 2, 0, CYAN, 3, 0.5);
  drawArc(CX, CY, 68, Math.PI / 2, Math.PI, CYAN, 3, 0.5);

  // 7. Inner ring
  drawCircle(CX, CY, 48, CYAN, 1.5, 0.8);
  drawCircle(CX, CY, 48, CYAN, 3, 0.15);

  // 8. Inner detail ring
  drawCircle(CX, CY, 30, CYAN, 1, 0.5);

  // 9. Core radial glow
  drawRadialGlow(CX, CY, 28, CYAN, 0.6);

  // 10. Core circle
  drawFilledCircle(CX, CY, 10, CYAN, 1.0);
  drawRadialGlow(CX, CY, 14, CYAN, 0.4);

  // 11. Central white hot spot
  drawFilledCircle(CX, CY, 5, WHITE, 0.9);
  drawRadialGlow(CX, CY, 8, WHITE, 0.3);
}

// ─── PNG encoder (raw, no deps) ───────────────────────────────────────────

function createPNG(width, height, pixelData) {
  // Build raw image data with filter byte (0 = None) per row
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // Filter: None
    const rowStart = y * width * 4;
    const rowEnd = (y + 1) * width * 4;
    for (let i = rowStart; i < rowEnd; i++) {
      rawData[y * (1 + width * 4) + 1 + (i - rowStart)] = pixelData[i];
    }
  }

  const compressed = deflateSync(rawData);

  // CRC32 lookup table
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcInput = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT
  const idat = compressed;

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', iend),
  ]);
}

// ─── Main ──────────────────────────────────────────────────────────────────

console.log('JARVIS Icon Generator');
console.log('   Rendering 256x256 arc reactor icon...');

renderIcon();

const pngBuffer = createPNG(SIZE, SIZE, pixels);
const pngPath = join(__dirname, 'icon.png');
const icoPath = join(__dirname, 'icon.ico');

// Write PNG
const pngStream = createWriteStream(pngPath);
pngStream.write(pngBuffer);
pngStream.end();
await new Promise((resolve) => pngStream.on('finish', resolve));
console.log('   Saved: ' + pngPath + ' (' + pngBuffer.length + ' bytes)');

// Write ICO placeholder (renamed PNG — works for many build tools, but real ICO conversion recommended)
const icoStream = createWriteStream(icoPath);
icoStream.write(pngBuffer);
icoStream.end();
await new Promise((resolve) => icoStream.on('finish', resolve));
console.log('   Saved: ' + icoPath + ' (PNG-placeholder, ' + pngBuffer.length + ' bytes)');

console.log('');
console.log('Note: icon.ico is a PNG file renamed to .ico as a placeholder.');
console.log('For a proper Windows ICO with multiple resolutions, run on a machine with ImageMagick:');
console.log('  convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico');
console.log('');
console.log('Done!');