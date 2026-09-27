import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SVG_PATH = join(ROOT, 'assets', 'logo.svg');
const ICONS_DIR = join(ROOT, 'assets', 'icons');

if (!existsSync(ICONS_DIR)) {
  mkdirSync(ICONS_DIR, { recursive: true });
}

const svgBuffer = readFileSync(SVG_PATH);

// Manifest and store icon sizes
// Edge/Chrome stores require:
// 16x16, 32x32, 48x48: transparent background
// 128x128: solid background variant for MS Store surfaces that fail with transparency
// 300x300: Edge Add-ons store listing logo (square, high-res)

const targets = [
  { size: 16, solid: false },
  { size: 32, solid: false },
  { size: 48, solid: false },
  { size: 128, solid: true, background: '#0F172A' },
  { size: 300, solid: true, background: '#0F172A' },
];

for (const target of targets) {
  const { size, solid, background } = target;
  const outPath = join(ICONS_DIR, `${size}.png`);

  if (solid) {
    // Composite rendered SVG over solid square canvas
    const renderedSvg = await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain' })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: background || '#0F172A',
      },
    })
      .composite([{ input: renderedSvg, top: 0, left: 0 }])
      .png()
      .toFile(outPath);
  } else {
    // Transparent PNG
    await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain' })
      .png()
      .toFile(outPath);
  }

  console.log(`✓ Generated ${size}x${size} icon -> assets/icons/${size}.png (${solid ? 'solid' : 'transparent'})`);
}

console.log('✓ All icons generated successfully.');
