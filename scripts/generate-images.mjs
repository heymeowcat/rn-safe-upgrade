#!/usr/bin/env node
/**
 * Generates the social preview image and the app icons from the vector
 * source, so every asset is reproducible and stays compressed.
 *
 *   node scripts/generate-images.mjs
 */
import { readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SVG = resolve(ROOT, "assets/og-image.svg");
const OUT_DIR = resolve(ROOT, "public");
const APP_DIR = resolve(ROOT, "src/app");

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="m" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#5b8def"/>
      <stop offset="100%" stop-color="#2f5fd8"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#m)"/>
  <g stroke="#ffffff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M32 46V19"/>
    <path d="M21 30l11-11 11 11"/>
  </g>
</svg>`;

async function main() {
  const svg = await readFile(SVG);

  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(APP_DIR, { recursive: true });

  // The social preview image: 1200x630, palette optimised for the size.
  await sharp(svg, { density: 144 })
    .resize(1200, 630, { fit: "cover" })
    .png({ quality: 88, compressionLevel: 9, palette: true, effort: 10 })
    .toFile(resolve(OUT_DIR, "og-image.png"));
  console.log("public/og-image.png");

  // The app icon.
  await sharp(Buffer.from(MARK), { density: 384 })
    .resize(512, 512)
    .png({ compressionLevel: 9, palette: true, effort: 10 })
    .toFile(resolve(APP_DIR, "icon.png"));
  console.log("src/app/icon.png");

  // The apple touch icon.
  await sharp(Buffer.from(MARK), { density: 384 })
    .resize(180, 180)
    .png({ compressionLevel: 9, palette: true, effort: 10 })
    .toFile(resolve(APP_DIR, "apple-icon.png"));
  console.log("src/app/apple-icon.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
