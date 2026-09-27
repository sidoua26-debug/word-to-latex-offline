import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROMO_DIR = join(ROOT, 'assets', 'promo');
const LOGO_SVG = join(ROOT, 'assets', 'logo.svg');

if (!existsSync(PROMO_DIR)) {
  mkdirSync(PROMO_DIR, { recursive: true });
}

const logoSvgInner = readFileSync(LOGO_SVG, 'utf8')
  .replace(/<\?xml[\s\S]*?\?>/i, '')
  .replace(/<svg[^>]*>/i, '')
  .replace(/<\/svg>/i, '');

// 1. Small Promotional Tile: 440x280
const smallPromoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="50%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0B132B" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563EB" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.05" />
    </linearGradient>
  </defs>

  <rect width="440" height="280" fill="url(#bgGrad)" />
  <circle cx="105" cy="140" r="110" fill="url(#glowGrad)" />

  <path d="M 0,70 L 440,70 M 0,140 L 440,140 M 0,210 L 440,210" stroke="#334155" stroke-width="1" opacity="0.3" />
  <path d="M 110,0 L 110,280 M 220,0 L 220,280 M 330,0 L 330,280" stroke="#334155" stroke-width="1" opacity="0.2" />

  <g transform="translate(45, 80) scale(0.234)">
    ${logoSvgInner}
  </g>

  <text x="180" y="115" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="800" fill="#F8FAFC" letter-spacing="-0.5">Word to LaTeX</text>
  
  <rect x="180" y="132" width="128" height="24" rx="12" fill="#2563EB" fill-opacity="0.25" stroke="#3B82F6" stroke-width="1" />
  <text x="192" y="148" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#60A5FA" letter-spacing="0.5">OFFLINE WASM</text>

  <text x="180" y="182" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#94A3B8">Convert docs, tables &amp; pasted text</text>
  <text x="180" y="202" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#38BDF8">Paste-ready LaTeX fragments</text>

  <text x="410" y="260" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#64748B" text-anchor="end">Microsoft Edge Add-ons</text>
</svg>
`;

await sharp(Buffer.from(smallPromoSvg))
  .png()
  .toFile(join(PROMO_DIR, 'promo-tile-small.png'));

console.log('✓ Generated assets/promo/promo-tile-small.png (440x280)');

// 2. Large Promotional Tile: EXACTLY 1400x560 for Microsoft Edge Add-ons Partner Center
const largePromoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560" viewBox="0 0 1400 560">
  <defs>
    <linearGradient id="bgGradL" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B1120" />
      <stop offset="50%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <linearGradient id="accentGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#0EA5E9" stop-opacity="0.0" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#0F172A" stop-opacity="0.95" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1400" height="560" fill="url(#bgGradL)" />

  <!-- Ambient light orbs -->
  <circle cx="260" cy="240" r="340" fill="url(#accentGlow)" />
  <circle cx="1180" cy="380" r="300" fill="url(#accentGlow)" />

  <!-- Subtle grid lines -->
  <path d="M 0,140 L 1400,140 M 0,280 L 1400,280 M 0,420 L 1400,420" stroke="#334155" stroke-width="1" opacity="0.25" />
  <path d="M 280,0 L 280,560 M 560,0 L 560,560 M 840,0 L 840,560 M 1120,0 L 1120,560" stroke="#334155" stroke-width="1" opacity="0.2" />

  <!-- Left Side: Brand & Identity -->
  <g transform="translate(80, 110) scale(0.66)">
    ${logoSvgInner}
  </g>

  <!-- Hero Typography -->
  <text x="460" y="170" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="800" fill="#F8FAFC" letter-spacing="-1">Word to LaTeX (Offline)</text>
  <text x="460" y="218" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="600" fill="#38BDF8">Convert .docx, Pasted Text &amp; Tables to Clean LaTeX</text>

  <rect x="460" y="238" width="220" height="34" rx="17" fill="#2563EB" fill-opacity="0.3" stroke="#3B82F6" stroke-width="1.5" />
  <text x="480" y="260" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#93C5FD" letter-spacing="1">100% PRIVATE • LOCAL WASM</text>

  <!-- Right/Bottom Side: Feature Highlight Cards -->
  <g transform="translate(460, 310)">
    <!-- Feature 1: DOCX Upload -->
    <rect x="0" y="0" width="270" height="175" rx="14" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2" />
    <text x="22" y="44" font-size="26">📄</text>
    <text x="22" y="80" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="17" font-weight="700" fill="#FFFFFF">DOCX Upload</text>
    <text x="22" y="112" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="400" fill="#94A3B8">
      <tspan x="22" dy="0">Instant local conversion of Word</tspan>
      <tspan x="22" dy="20">documents to paste-ready LaTeX.</tspan>
    </text>

    <!-- Feature 2: Rich Paste Mode -->
    <rect x="295" y="0" width="270" height="175" rx="14" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2" />
    <text x="317" y="44" font-size="26">📋</text>
    <text x="317" y="80" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="17" font-weight="700" fill="#FFFFFF">Rich Paste Mode</text>
    <text x="317" y="112" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="400" fill="#94A3B8">
      <tspan x="317" dy="0">Paste tables &amp; formatted text</tspan>
      <tspan x="317" dy="20">from Word, Docs, or web pages.</tspan>
    </text>

    <!-- Feature 3: Pandoc WASM Engine -->
    <rect x="590" y="0" width="270" height="175" rx="14" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2" />
    <text x="612" y="44" font-size="26">⚡</text>
    <text x="612" y="80" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="17" font-weight="700" fill="#FFFFFF">Zero Server Calls</text>
    <text x="612" y="112" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="400" fill="#94A3B8">
      <tspan x="612" dy="0">Automated \\tightlist cleanup &amp;</tspan>
      <tspan x="612" dy="20">instant clipboard sync in Edge.</tspan>
    </text>
  </g>

  <!-- Edge Store Badge -->
  <text x="1320" y="525" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#64748B" text-anchor="end">Designed for Microsoft Edge</text>
</svg>
`;

await sharp(Buffer.from(largePromoSvg))
  .png()
  .toFile(join(PROMO_DIR, 'promo-tile-large.png'));

console.log('✓ Generated assets/promo/promo-tile-large.png (1400x560)');
console.log('✓ All promotional tiles generated.');
