/**
 * prototype_pix2tex_benchmark.mjs
 *
 * Feasibility Evaluation: Tesseract.js + Heuristic Parser (measured)
 * vs pix2tex / LaTeX-OCR ONNX (design estimates from architecture analysis)
 *
 * WHAT IS MEASURED:
 *   - Tesseract.js startup time (wall clock)
 *   - Tesseract.js per-fixture inference latency (wall clock)
 *   - Tesseract.js OCR confidence (reported by engine)
 *   - Tesseract.js + parser output vs ground truth (normalized edit distance)
 *   - Tesseract model bundle size on disk (measured with fs.statSync)
 *
 * WHAT IS ESTIMATED (pix2tex was NOT executed):
 *   - pix2tex model sizes: cited from RapidAI/RapidLaTeXOCR published ONNX files
 *   - pix2tex latency/memory/startup: architectural estimates, NOT measurements
 *   - pix2tex accuracy: qualitative assessment based on published training domain,
 *     NOT from running the model on these fixtures
 *
 * Run: node scripts/prototype_pix2tex_benchmark.mjs
 */

import fs from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';
import { parseOcrToLatex } from '../src/imageOcr/mathParser.ts';
import { detectAndParseTable } from '../src/imageOcr/tableParser.ts';
import { assessQuality } from '../src/imageOcr/resultQuality.ts';

const fixturesDir = path.resolve('tests/fixtures/real');

// ---------- Levenshtein edit distance ----------
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Normalized edit distance: 0.0 = identical, 1.0 = completely different.
 * Normalizes to LaTeX structure by stripping whitespace runs,
 * lowering case for text-heavy cases, then computing Levenshtein / max(len).
 */
function normalizedEditDistance(output, reference) {
  const normalize = s => s.replace(/\s+/g, ' ').trim();
  const a = normalize(output);
  const b = normalize(reference);
  if (a === b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return levenshtein(a, b) / maxLen;
}

/**
 * Similarity = 1 - NED. Rounded to 3 decimal places.
 */
function similarity(output, reference) {
  return Math.round((1 - normalizedEditDistance(output, reference)) * 1000) / 1000;
}

// ---------- Measure file sizes on disk ----------
function measureDirSizeBytes(dirPath) {
  let total = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += measureDirSizeBytes(fullPath);
    } else {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

function bytesToMb(bytes) {
  return Math.round(bytes / (1024 * 1024) * 100) / 100;
}

// ---------- Ground truth fixtures ----------
const testCases = [
  {
    id: 'case_01_pythagoras',
    name: 'Pythagorean Equation',
    category: 'math_single_line',
    groundTruth: 'x^2 + y^2 = z^2',
  },
  {
    id: 'case_02_fraction',
    name: 'Algebraic Fraction',
    category: 'math_fraction',
    groundTruth: '\\frac{a + b}{c}',
  },
  {
    id: 'case_03_sqrt',
    name: 'Radical Expression',
    category: 'math_radical',
    groundTruth: '\\sqrt{x^2 + 1}',
  },
  {
    id: 'case_04_integral',
    name: 'Definite Integral with Limits',
    category: 'math_2d_limits',
    groundTruth: '\\int_{0}^{1} x^2 dx',
  },
  {
    id: 'case_05_summation',
    name: 'Summation with Bounds',
    category: 'math_2d_limits',
    groundTruth: '\\sum_{i=1}^{n} i',
  },
  {
    id: 'case_06_matrix',
    name: '2x2 Matrix',
    category: 'math_matrix',
    groundTruth: '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}',
  },
  {
    id: 'case_07_system',
    name: 'System of Equations',
    category: 'math_multiline',
    groundTruth: '\\begin{cases} 2x + y = 5 \\\\ x - 3y = 2 \\end{cases}',
  },
  {
    id: 'case_08_french_math',
    name: 'French Paragraph with Inline Math',
    category: 'mixed_text_math',
    groundTruth: "Soit f une fonction continue sur l'intervalle [0, 1]. On considère l'intégrale suivante : I = \\int_{0}^{1} f(x) dx. Calculer la valeur moyenne de f.",
  },
  {
    id: 'case_09_french_accents',
    name: 'French Accented Text',
    category: 'french_prose',
    groundTruth: "Documentation Français. Voici des caractères accentués : é, è, à, ç, œ, ù. L'élève étudie attentivement le théorème où apparaît le paramètre déjà défini.",
  },
  {
    id: 'case_10_table_math',
    name: 'Table with Mathematical Expressions',
    category: 'tabular_math',
    groundTruth: "\\begin{tabular}{lll} Fonction & Dérivée & Primitive \\\\ f(x) = x^2 & f'(x) = 2x & F(x) = \\frac{1}{3}x^3 \\\\ g(x) = \\sin(x) & g'(x) = \\cos(x) & G(x) = -\\cos(x) \\end{tabular}",
  },
];

async function runBenchmark() {
  console.log('================================================================');
  console.log('FEASIBILITY EVALUATION');
  console.log('Tesseract.js + Heuristic Parser (MEASURED)');
  console.log('vs pix2tex / LaTeX-OCR ONNX (DESIGN ESTIMATES)');
  console.log('10 Real KaTeX Rendered Image Fixtures');
  console.log('================================================================\n');

  // =============================================
  // PART 1: TESSERACT — MEASURED
  // =============================================

  // Measure on-disk model sizes
  const tessdataSizeBytes = measureDirSizeBytes('assets/tessdata');
  const tessdataSizeMb = bytesToMb(tessdataSizeBytes);
  const vendorTessSizeBytes = measureDirSizeBytes('dist/vendor/tesseract');
  const vendorTessSizeMb = bytesToMb(vendorTessSizeBytes);
  const totalTesseractBundleMb = bytesToMb(tessdataSizeBytes + vendorTessSizeBytes);

  console.log(`[MEASURED] Tesseract tessdata on disk: ${tessdataSizeMb} MB`);
  console.log(`[MEASURED] Tesseract WASM vendor on disk: ${vendorTessSizeMb} MB`);
  console.log(`[MEASURED] Total Tesseract bundle: ${totalTesseractBundleMb} MB`);

  // Measure startup time
  const tessStartInit = performance.now();
  const worker = await createWorker(['eng', 'fra', 'equ'], 1, {
    cacheMethod: 'none',
    gzip: true,
    langPath: 'assets/tessdata',
  });
  const tessStartupMs = Math.round(performance.now() - tessStartInit);
  console.log(`[MEASURED] Tesseract cold startup: ${tessStartupMs} ms\n`);

  // Measure per-fixture: latency, output, confidence, computed accuracy
  const fixtureResults = [];

  for (const tc of testCases) {
    const imgPath = path.join(fixturesDir, `${tc.id}.png`);
    const buffer = fs.readFileSync(imgPath);

    const tStart = performance.now();
    const res = await worker.recognize(buffer);
    const latencyMs = Math.round(performance.now() - tStart);

    const ocrData = {
      text: res.data.text || '',
      confidence: res.data.confidence || 0,
      lines: res.data.lines?.map(l => ({
        text: l.text,
        confidence: l.confidence,
      })),
    };

    const tableCheck = detectAndParseTable(ocrData);
    let parsedLatex = '';
    if (tableCheck.isTable && tableCheck.latex) {
      parsedLatex = tableCheck.latex;
    } else {
      parsedLatex = parseOcrToLatex(ocrData);
    }

    const quality = assessQuality(ocrData, parsedLatex);

    // Compute accuracy programmatically
    const rawSimilarity = similarity(ocrData.text, tc.groundTruth);
    const parsedSimilarity = similarity(parsedLatex, tc.groundTruth);
    const ned = normalizedEditDistance(parsedLatex, tc.groundTruth);

    fixtureResults.push({
      id: tc.id,
      name: tc.name,
      category: tc.category,
      groundTruth: tc.groundTruth,
      tesseract: {
        rawOcrText: ocrData.text.replace(/\n+/g, ' ').trim(),
        parsedOutput: parsedLatex.replace(/\n+/g, ' ').trim(),
        ocrConfidence: Math.round(ocrData.confidence),
        qualityGrade: quality.quality,
        warningCount: quality.warnings.length,
        latencyMs: latencyMs,
        rawSimilarity: rawSimilarity,
        parsedSimilarity: parsedSimilarity,
        normalizedEditDistance: Math.round(ned * 1000) / 1000,
        dataSource: 'MEASURED',
      },
    });

    console.log(`[MEASURED] ${tc.id}: latency=${latencyMs}ms, confidence=${Math.round(ocrData.confidence)}%, rawSim=${rawSimilarity}, parsedSim=${parsedSimilarity}, NED=${Math.round(ned * 1000) / 1000}`);
  }

  await worker.terminate();

  // Compute measured aggregate stats for Tesseract
  const avgLatencyMs = Math.round(fixtureResults.reduce((s, r) => s + r.tesseract.latencyMs, 0) / fixtureResults.length);
  const avgParsedSimilarity = Math.round(fixtureResults.reduce((s, r) => s + r.tesseract.parsedSimilarity, 0) / fixtureResults.length * 1000) / 1000;
  const avgNED = Math.round(fixtureResults.reduce((s, r) => s + r.tesseract.normalizedEditDistance, 0) / fixtureResults.length * 1000) / 1000;

  const mathFixtures = fixtureResults.filter(r => ['math_single_line', 'math_fraction', 'math_radical', 'math_2d_limits', 'math_matrix', 'math_multiline'].includes(r.category));
  const frenchFixtures = fixtureResults.filter(r => ['mixed_text_math', 'french_prose'].includes(r.category));
  const tableFixtures = fixtureResults.filter(r => r.category === 'tabular_math');

  const avgMathSim = Math.round(mathFixtures.reduce((s, r) => s + r.tesseract.parsedSimilarity, 0) / mathFixtures.length * 1000) / 1000;
  const avgFrenchSim = Math.round(frenchFixtures.reduce((s, r) => s + r.tesseract.parsedSimilarity, 0) / frenchFixtures.length * 1000) / 1000;
  const avgTableSim = Math.round(tableFixtures.reduce((s, r) => s + r.tesseract.parsedSimilarity, 0) / tableFixtures.length * 1000) / 1000;

  // =============================================
  // PART 2: PIX2TEX — DESIGN ESTIMATES (NOT RUN)
  // =============================================
  //
  // pix2tex / LaTeX-OCR was NOT installed or executed.
  // The following are architectural estimates and qualitative assessments
  // based on:
  //   - Published model architecture (ResNet + ViT encoder, autoregressive transformer decoder)
  //   - RapidAI/RapidLaTeXOCR published ONNX model files (~100-300 MB total FP32)
  //   - pix2tex training domain: cropped formula images from im2latex-100k (arXiv papers)
  //   - ONNX Runtime Web execution constraints in Chrome MV3 extension popups
  //   - Published literature on autoregressive transformer decoding latency on WASM CPU
  //
  // These estimates are NOT benchmarks. They are feasibility projections.

  const pix2texEstimates = {
    dataSource: 'DESIGN_ESTIMATE — pix2tex was NOT executed on these fixtures',
    modelSizeNotes: 'RapidAI/RapidLaTeXOCR publishes encoder.onnx + decoder.onnx + image_resizer.onnx. Total FP32 size is ~100-300 MB per published sources. Int8 quantized size is unknown without performing quantization.',
    startupNotes: 'ONNX Runtime Web initialization + parsing large FP32 protobuf tensors into WASM memory. No measured value available.',
    latencyNotes: 'Autoregressive decoding requires 1 forward pass per output token. For a typical formula (20-60 tokens) on single-threaded WASM CPU, this would likely require multiple seconds. No measured value available.',
    memoryNotes: 'WASM linear memory for ~100-300 MB of model weights plus KV-cache. Exact consumption unknown without measurement.',
    accuracyNotes: 'pix2tex is trained exclusively on cropped mathematical formulas from arXiv (im2latex-100k dataset). It has no training data for natural language prose, French text, accented characters, or tabular layouts. Expected to perform well on isolated math formulas (cases 01-07) and fail on prose/tables (cases 08-10). This is a domain assessment, NOT a measured result.',
    trainingDomain: 'Cropped mathematical formula images from im2latex-100k (arXiv papers). No natural language, no French, no tables.',
    expectedStrengths: 'Isolated mathematical formulas with standard LaTeX notation',
    expectedWeaknesses: 'Natural language text, accented characters, tabular layouts, mixed text-and-math documents',
    browserFeasibilityNotes: 'Chrome MV3 popup pages are destroyed when the user clicks outside. Autoregressive decoding taking multiple seconds risks popup termination mid-inference. SharedArrayBuffer (needed for multi-threaded ONNX) requires COOP/COEP headers which extension popups cannot set.',
  };

  // =============================================
  // PART 3: ASSEMBLE HONEST REPORT
  // =============================================

  const report = {
    generatedAt: new Date().toISOString(),
    methodology: {
      tesseract: 'All Tesseract figures were measured by running Tesseract.js v7 (eng+fra+equ) on 10 real KaTeX-rendered PNG fixtures. Startup time, per-fixture latency, OCR confidence, and model sizes are wall-clock / disk measurements. Accuracy is computed programmatically as 1 - normalized Levenshtein edit distance between parser output and ground truth.',
      pix2tex: 'pix2tex / LaTeX-OCR was NOT installed or executed. All pix2tex figures are qualitative feasibility estimates based on published architecture, training domain, and ONNX Runtime Web constraints. They are clearly labelled as DESIGN_ESTIMATE throughout.',
    },
    tesseractMeasured: {
      dataSource: 'MEASURED',
      architecture: '1D LSTM Segmented OCR (eng+fra+equ) + Heuristic AST Parser',
      bundleSize: {
        tessdataMb: tessdataSizeMb,
        wasmVendorMb: vendorTessSizeMb,
        totalMb: totalTesseractBundleMb,
        dataSource: 'MEASURED (fs.statSync)',
      },
      coldStartupMs: { value: tessStartupMs, dataSource: 'MEASURED (performance.now)' },
      averageLatencyMs: { value: avgLatencyMs, dataSource: 'MEASURED (performance.now, mean of 10 fixtures)' },
      accuracy: {
        overallMeanSimilarity: { value: avgParsedSimilarity, dataSource: 'MEASURED (1 - normalized Levenshtein edit distance)' },
        overallMeanNED: { value: avgNED, dataSource: 'MEASURED' },
        mathCases0107MeanSimilarity: { value: avgMathSim, count: mathFixtures.length, dataSource: 'MEASURED' },
        frenchCases0809MeanSimilarity: { value: avgFrenchSim, count: frenchFixtures.length, dataSource: 'MEASURED' },
        tableCases10MeanSimilarity: { value: avgTableSim, count: tableFixtures.length, dataSource: 'MEASURED' },
      },
    },
    pix2texDesignEstimates: pix2texEstimates,
    fixtures: fixtureResults,
  };

  fs.writeFileSync('prototype_benchmark_report.json', JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n\n========== TESSERACT.JS MEASURED RESULTS ==========');
  console.log(`Bundle size:        ${totalTesseractBundleMb} MB  [MEASURED]`);
  console.log(`Cold startup:       ${tessStartupMs} ms  [MEASURED]`);
  console.log(`Avg latency:        ${avgLatencyMs} ms  [MEASURED]`);
  console.log(`Mean similarity:    ${avgParsedSimilarity}  [MEASURED, 1 - NED]`);
  console.log(`  Math (cases 1-7): ${avgMathSim}  [MEASURED]`);
  console.log(`  French (8-9):     ${avgFrenchSim}  [MEASURED]`);
  console.log(`  Table (10):       ${avgTableSim}  [MEASURED]`);

  console.log('\n========== PIX2TEX DESIGN ESTIMATES (NOT RUN) ==========');
  console.log('Model size:         ~100-300 MB FP32  [ESTIMATED, from published sources]');
  console.log('Startup:            Not measured');
  console.log('Latency:            Not measured (autoregressive decoding on WASM CPU expected to be multiple seconds)');
  console.log('Memory:             Not measured');
  console.log('Accuracy (math):    Expected high on isolated formulas  [ESTIMATED, based on training domain]');
  console.log('Accuracy (French):  Expected failure  [ESTIMATED, not in training data]');
  console.log('Accuracy (tables):  Expected failure  [ESTIMATED, not in training data]');

  console.log('\nReport written to prototype_benchmark_report.json');
}

runBenchmark().catch(console.error);
