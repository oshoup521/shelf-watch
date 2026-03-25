#!/usr/bin/env node
// Generates PWA icons using pure Node.js (no canvas dependency)
// Creates PNG files with green background and white shelf symbol

const fs = require("fs");
const path = require("path");

function createPNG(size) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let c = 0xffffffff;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let v = i;
      for (let j = 0; j < 8; j++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
      table[i] = v;
    }
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, "ascii");
    const crcBuf = Buffer.concat([typeB, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcBuf), 0);
    return Buffer.concat([len, typeB, data, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Green background: #16a34a = rgb(22, 163, 74)
  const bg = [22, 163, 74];
  const white = [255, 255, 255];

  // Create pixel grid
  const pixels = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      row.push([...bg]);
    }
    pixels.push(row);
  }

  // Draw a simple shelf/box symbol in white
  // Scale based on size
  const scale = size / 192;
  const cx = size / 2;
  const cy = size / 2;

  function setPixel(px, py, color) {
    const xi = Math.round(px);
    const yi = Math.round(py);
    if (xi >= 0 && xi < size && yi >= 0 && yi < size) {
      pixels[yi][xi] = color;
    }
  }

  function fillRect(x1, y1, w, h, color) {
    for (let y = Math.round(y1); y < Math.round(y1 + h); y++) {
      for (let x = Math.round(x1); x < Math.round(x1 + w); x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) {
          pixels[y][x] = color;
        }
      }
    }
  }

  // Draw shelf symbol:
  // - Outer box outline
  // - Two horizontal shelf lines inside
  const thick = Math.max(4, Math.round(8 * scale));
  const boxW = Math.round(120 * scale);
  const boxH = Math.round(100 * scale);
  const bx = Math.round(cx - boxW / 2);
  const by = Math.round(cy - boxH / 2);

  // Top bar
  fillRect(bx, by, boxW, thick, white);
  // Bottom bar
  fillRect(bx, by + boxH - thick, boxW, thick, white);
  // Left bar
  fillRect(bx, by, thick, boxH, white);
  // Right bar
  fillRect(bx + boxW - thick, by, thick, boxH, white);

  // Two shelves (horizontal lines at 1/3 and 2/3)
  const shelf1Y = by + Math.round(boxH / 3);
  const shelf2Y = by + Math.round((2 * boxH) / 3);
  fillRect(bx, shelf1Y, boxW, thick, white);
  fillRect(bx, shelf2Y, boxW, thick, white);

  // Small items on shelves (little rectangles)
  const itemH = Math.round(18 * scale);
  const itemW = Math.round(14 * scale);
  const gap = Math.round(6 * scale);

  // Top shelf items
  fillRect(bx + thick + gap, by + thick + gap, itemW, itemH, white);
  fillRect(bx + thick + gap * 2 + itemW, by + thick + gap, itemW, Math.round(itemH * 0.7), white);
  fillRect(bx + thick + gap * 3 + itemW * 2, by + thick + gap, Math.round(itemW * 0.8), itemH, white);

  // Middle shelf items
  fillRect(bx + thick + gap, shelf1Y + thick + gap, Math.round(itemW * 1.2), itemH, white);
  fillRect(bx + thick + gap * 2 + Math.round(itemW * 1.2), shelf1Y + thick + gap, itemW, Math.round(itemH * 0.8), white);

  // Bottom shelf items
  fillRect(bx + thick + gap, shelf2Y + thick + gap, itemW, itemH, white);
  fillRect(bx + thick + gap * 2 + itemW, shelf2Y + thick + gap, Math.round(itemW * 0.9), Math.round(itemH * 0.9), white);
  fillRect(bx + thick + gap * 3 + Math.round(itemW * 1.9), shelf2Y + thick + gap, itemW, itemH, white);

  // Compress raw image data using zlib deflate
  const zlib = require("zlib");
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter type None
    for (let x = 0; x < size; x++) {
      row[1 + x * 3] = pixels[y][x][0];
      row[2 + x * 3] = pixels[y][x][1];
      row[3 + x * 3] = pixels[y][x][2];
    }
    rawRows.push(row);
  }
  const raw = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const idat = chunk("IDAT", compressed);
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, chunk("IHDR", ihdr), idat, iend]);
}

const publicDir = path.join(__dirname, "..", "public");

fs.writeFileSync(path.join(publicDir, "icon-192.png"), createPNG(192));
console.log("Created icon-192.png");

fs.writeFileSync(path.join(publicDir, "icon-512.png"), createPNG(512));
console.log("Created icon-512.png");
