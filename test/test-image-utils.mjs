/**
 * Test Image Utilities
 *
 * Creates test images for VLLM API testing. Generates valid PNGs
 * programmatically (no external deps) at sizes APIs accept.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { deflateSync } from 'zlib';

/**
 * Create a valid PNG buffer of specified dimensions.
 * Builds raw PNG from scratch: IHDR + IDAT (deflated scanlines) + IEND.
 * Produces a gradient pattern so VLMs have something to evaluate.
 */
function createValidTestPNG(width = 100, height = 100) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk: width, height, bit depth 8, color type 2 (RGB)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // Raw image data: filter byte (0 = None) + RGB pixels per row
  const rowBytes = 1 + width * 3; // filter byte + RGB
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const offset = y * rowBytes;
    raw[offset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 3;
      // Gradient: blue-to-white horizontally, darker top to lighter bottom
      const r = Math.floor((x / width) * 200 + (y / height) * 55);
      const g = Math.floor((y / height) * 200 + 40);
      const b = Math.floor(180 - (x / width) * 100 + (y / height) * 75);
      raw[px] = Math.min(255, r);
      raw[px + 1] = Math.min(255, g);
      raw[px + 2] = Math.min(255, b);
    }
  }

  const compressed = deflateSync(raw);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

/**
 * Build a PNG chunk: length (4) + type (4) + data + CRC (4)
 */
function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
 * CRC-32 for PNG (ISO 3309 / ITU-T V.42)
 */
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
    }
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Create a test image at the given path.
 * Tries Playwright first (800x600 realistic HTML page),
 * falls back to programmatic PNG (100x100 gradient).
 */
export async function createTestImage(path, options = {}) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Try Playwright for a realistic screenshot
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 800, height: 600 });

    if (options.htmlContent) {
      await page.setContent(options.htmlContent);
    } else {
      await page.setContent(`<!DOCTYPE html>
<html><head><style>
  body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
  h1 { color: #333; } button { padding: 10px 20px; background: #007bff; color: white; border: none; }
</style></head><body>
  <h1>Test Page for Visual Validation</h1>
  <p>Realistic test page for visual validation testing.</p>
  <button>Test Button</button>
</body></html>`);
    }

    await page.screenshot({ path, fullPage: false });
    await browser.close();
    return;
  } catch {
    // Playwright not available -- fall through to programmatic PNG
  }

  // Fallback: 100x100 gradient PNG (valid for all VLM APIs)
  const width = options.width || 100;
  const height = options.height || 100;
  writeFileSync(path, createValidTestPNG(width, height));
}

/**
 * Create a realistic test image (programmatic, no Playwright).
 */
export function createRealisticTestImage(path, options = {}) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const width = options.width || 100;
  const height = options.height || 100;
  writeFileSync(path, createValidTestPNG(width, height));
}

/** @deprecated Use createTestImage instead */
export const createTempImage = createTestImage;
