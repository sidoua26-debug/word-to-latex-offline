import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROMO_DIR = join(ROOT, 'assets', 'promo');
const LOGO_SVG = join(ROOT, 'assets', 'logo.svg');

if (!existsSync(PROMO_DIR)) {
  mkdirSync(PROMO_DIR, { recursive: true });
}

// 1. Small Promotional Tile: 440x280
// High impact, bold typography, clear value prop, crisp logo
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

  <!-- Background -->
  <rect width="440" height="280" fill="url(#bgGrad)" />

  <!-- Subtle ambient glow circle behind logo -->
  <circle cx="105" cy="140" r="110" fill="url(#glowGrad)" />

  <!-- Abstract decorative grid lines -->
  <path d="M 0,70 L 440,70 M 0,140 L 440,140 M 0,210 L 440,210" stroke="#334155" stroke-width="1" opacity="0.3" />
  <path d="M 110,0 L 110,280 M 220,0 L 220,280 M 330,0 L 330,280" stroke="#334155" stroke-width="1" opacity="0.2" />

  <!-- Logo (Rendered icon at 120x120) -->
  <g transform="translate(45, 80) scale(0.234)">
    ${readFileSync(LOGO_SVG, 'utf8')
      .replace(/<\?xml[\s\S]*?\?>/i, '')
      .replace(/<svg[^>]*>/i, '')
      .replace(/<\/svg>/i, '')}
  </g>

  <!-- Title & Taglines -->
  <text x="180" y="115" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="800" fill="#F8FAFC" letter-spacing="-0.5">Word to LaTeX</text>
  
  <rect x="180" y="132" width="128" height="24" rx="12" fill="#2563EB" fill-opacity="0.25" stroke="#3B82F6" stroke-width="1" />
  <text x="192" y="148" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#60A5FA" letter-spacing="0.5">OFFLINE WASM</text>

  <text x="180" y="182" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#94A3B8">Convert docs, tables &amp; pasted text</text>
  <text x="180" y="202" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#38BDF8">Paste-ready LaTeX fragments</text>

  <!-- Bottom micro-badge -->
  <text x="410" y="260" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#64748B" text-anchor="end">Microsoft Edge Add-ons</text>
</svg>
`;

await sharp(Buffer.from(smallPromoSvg))
  .png()
  .toFile(join(PROMO_DIR, 'promo-tile-small.png'));

console.log('✓ Generated assets/promo/promo-tile-small.png (440x280)');

// 2. Large Promotional Tile: 920x680
// Spacious layout featuring document transformation motif and feature highlights
const largePromoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="920" height="680" viewBox="0 0 920 680">
  <defs>
    <linearGradient id="bgGradL" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B1120" />
      <stop offset="60%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <linearGradient id="accentGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#0EA5E9" stop-opacity="0.0" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0F172A" stop-opacity="0.9" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="920" height="680" fill="url(#bgGradL)" />

  <!-- Ambient light -->
  <circle cx="260" cy="300" r="320" fill="url(#accentGlow)" />
  <circle cx="780" cy="500" r="280" fill="url(#accentGlow)" />

  <!-- Grid overlay -->
  <path d="M 0,170 L 920,170 M 0,340 L 920,340 M 0,510 L 920,510" stroke="#334155" stroke-width="1" opacity="0.2" />
  <path d="M 230,0 L 230,680 M 460,0 L 460,680 M 690,0 L 690,680" stroke="#334155" stroke-width="1" opacity="0.15" />

  <!-- Logo (Rendered icon at 200x200) -->
  <g transform="translate(80, 110) scale(0.39)">
    ${readFileSync(LOGO_SVG, 'utf8')
      .replace(/<\?xml[\s\S]*?\?>/i, '')
      .replace(/<svg[^>]*>/i, '')
      .replace(/<\/svg>/i, '')}
  </g>

  <!-- Hero Titles -->
  <text x="310" y="165" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="800" fill="#F8FAFC" letter-spacing="-1">Word to LaTeX</text>
  <text x="310" y="210" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="600" fill="#38BDF8">Offline Document &amp; Table Converter</text>

  <rect x="310" y="232" width="168" height="32" rx="16" fill="#2563EB" fill-opacity="0.3" stroke="#3B82F6" stroke-width="1.5" />
  <text x="330" y="253" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#93C5FD" letter-spacing="1">100% PRIVATE &amp; LOCAL</text>

  <!-- Feature Cards Container -->
  <g transform="translate(80, 360)">
    <!-- Card 1: DOCX Upload -->
    <rect x="0" y="0" width="235" height="220" rx="16" fill="url(#cardGrad)" stroke="#334155" stroke-width="1" />
    <text x="24" y="48" font-size="28">📄</text>
    <text x="24" y="90" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#FFFFFF">DOCX Upload</text>
    <text x="24" y="122" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="400" fill="#94A3B8" width="180">
      <tspan x="24" dy="0">Instant local conversion</tspan>
      <tspan x="24" dy="20">of Word documents to</tspan>
      <tspan x="24" dy="20">clean LaTeX fragments.</tspan>
    </text>

    <!-- Card 2: Rich Paste Mode -->
    <rect x="262" y="0" width="235" height="220" rx="16" fill="url(#cardGrad)" stroke="#334155" stroke-width="1" />
    <text x="286" y="48" font-size="28">📋</text>
    <text x="286" y="90" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#FFFFFF">Rich Paste Mode</text>
    <text x="286" y="122" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="400" fill="#94A3B8">
      <tspan x="286" dy="0">Paste tables &amp; styled text</tspan>
      <tspan x="286" dy="20">from Docs, Word, or web.</tspan>
      <tspan x="286" dy="20">Preserves table structure.</tspan>
    </text>

    <!-- Card 3: Pandoc WASM Engine -->
    <rect x="525" y="0" width="235" height="220" rx="16" fill="url(#cardGrad)" stroke="#334155" stroke-width="1" />
    <text x="549" y="48" font-size="28">⚡</text>
    <text x="549" y="90" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#FFFFFF">Pandoc WASM</text>
    <text x="549" y="122" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="400" fill="#94A3B8">
      <tspan x="549" dy="0">Zero network queries.</tspan>
      <tspan x="549" dy="20">Auto-cleans \tightlist</tspan>
      <tspan x="549" dy="20">and detects packages.</tspan>
    </text>
  </g>

  <!-- Footer Brand -->
  <text x="840" y="635" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#64748B" text-anchor="end">Designed for Microsoft Edge</text>
</svg>
`;

await sharp(Buffer.from(largePromoSvg))
  .png()
  .toFile(join(PROMO_DIR, 'promo-tile-large.png'));

console.log('✓ Generated assets/promo/promo-tile-large.png (920x680)');
console.log('✓ Promotional tiles completed.');
