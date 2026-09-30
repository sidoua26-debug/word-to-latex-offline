import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const fixturesDir = path.resolve('tests/fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// 1. Math equation image: E = mc^2 and f(x) = x^2 + 2x + 1
const mathSvg = `
<svg width="600" height="180" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="50" y="70" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="36" font-weight="bold" fill="black">E = mc²</text>
  <text x="50" y="130" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="32" fill="black">f(x) = x² + 2x + 1</text>
</svg>
`;

// 2. French text image with accents
const frenchSvg = `
<svg width="700" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="40" y="60" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="28" font-weight="bold" fill="black">Théorème fondamental</text>
  <text x="40" y="110" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="24" fill="black">Voici des caractères accentués : é, è, à, ç, œ, ù.</text>
  <text x="40" y="150" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="22" fill="#333333">Calculer la dérivée de la fonction f sur cet intervalle.</text>
</svg>
`;

// 3. Math fraction image: (x + 1) / (x - 1)
const fractionSvg = `
<svg width="500" height="160" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="60" y="90" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="32" fill="black">(x + 1) / (x - 1)</text>
</svg>
`;

// 4. Matrix image
const matrixSvg = `
<svg width="500" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="50" y="70" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="28" fill="black">[ 1   2 ]</text>
  <text x="50" y="130" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="28" fill="black">[ 3   4 ]</text>
</svg>
`;

// 5. Table image
const tableSvg = `
<svg width="600" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="40" y="60" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="24" font-weight="bold" fill="black">Item        Quantity    Price</text>
  <text x="40" y="100" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="22" fill="black">Apples      10          $5.00</text>
  <text x="40" y="140" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="22" fill="black">Oranges     8           $4.50</text>
</svg>
`;

async function generate() {
  await sharp(Buffer.from(mathSvg)).png().toFile(path.join(fixturesDir, 'math_equation.png'));
  await sharp(Buffer.from(frenchSvg)).png().toFile(path.join(fixturesDir, 'french_sample.png'));
  await sharp(Buffer.from(fractionSvg)).png().toFile(path.join(fixturesDir, 'math_fraction.png'));
  await sharp(Buffer.from(matrixSvg)).png().toFile(path.join(fixturesDir, 'math_matrix.png'));
  await sharp(Buffer.from(tableSvg)).png().toFile(path.join(fixturesDir, 'table_sample.png'));

  // Also create a dummy large file (> 15MB) buffer test in memory or file for validation test
  console.log('✓ All image fixtures successfully generated in tests/fixtures/');
}

generate().catch(console.error);
