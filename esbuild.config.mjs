import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist');
const SRC = join(__dirname, 'src');
const ASSETS = join(__dirname, 'assets');
const NODE_MODULES = join(__dirname, 'node_modules');

// Ensure dist directory exists
mkdirSync(DIST, { recursive: true });

// Plugin to allow importing unexported core.js from pandoc-wasm
const pandocWasmCorePlugin = {
  name: 'pandoc-wasm-core',
  setup(build) {
    build.onResolve({ filter: /^pandoc-wasm\/src\/core\.js$/ }, () => ({
      path: join(NODE_MODULES, 'pandoc-wasm', 'src', 'core.js'),
    }));
  },
};

// 1. Bundle popup.ts -> dist/popup.js (IIFE bundle containing popup logic, WASI shim, core pandoc logic, and cleanup)
await esbuild.build({
  entryPoints: [join(SRC, 'popup.ts')],
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  outfile: join(DIST, 'popup.js'),
  sourcemap: false,
  minify: false, // Keep readable for Chrome/Edge Store review
  plugins: [pandocWasmCorePlugin],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
console.log('✓ Bundled popup.js');

// 2. Copy static assets from src/ to dist/
const staticFiles = ['popup.html', 'popup.css', 'manifest.json'];
for (const file of staticFiles) {
  const srcPath = join(SRC, file);
  if (existsSync(srcPath)) {
    cpSync(srcPath, join(DIST, file));
    console.log(`✓ Copied ${file}`);
  }
}

// 3. Copy icons from assets/icons/ to dist/icons/
const iconsSrcDir = join(ASSETS, 'icons');
const iconsDestDir = join(DIST, 'icons');
if (existsSync(iconsSrcDir)) {
  mkdirSync(iconsDestDir, { recursive: true });
  cpSync(iconsSrcDir, iconsDestDir, { recursive: true });
  console.log('✓ Copied icons to dist/icons/');
}

// 4. Copy official pandoc.wasm binary into dist/wasm/
const wasmSrc = join(NODE_MODULES, 'pandoc-wasm', 'src', 'pandoc.wasm');
const wasmDestDir = join(DIST, 'wasm');
const wasmDest = join(wasmDestDir, 'pandoc.wasm');

if (existsSync(wasmSrc)) {
  mkdirSync(wasmDestDir, { recursive: true });
  cpSync(wasmSrc, wasmDest);
  console.log('✓ Bundled pandoc.wasm to dist/wasm/pandoc.wasm');
} else {
  console.error('✗ pandoc.wasm not found in node_modules/pandoc-wasm/src/ — please run npm install');
  process.exit(1);
}

console.log('✓ Build complete → dist/');
