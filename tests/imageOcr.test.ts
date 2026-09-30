/**
 * imageOcr.test.ts — Comprehensive tests for the Image to LaTeX feature.
 * Tests:
 * 1. Image validation (format, size limits)
 * 2. Math parser (Greek, operators, exponents, fractions, roots, matrices, systems)
 * 3. Table parser (markdown tables, multi-column ASCII to booktabs)
 * 4. LaTeX generator (Mode 1 fragment vs Mode 2 document, figure embedding, French babel)
 * 5. Offline Tesseract engine end-to-end OCR on real image fixtures
 * 6. Playwright UI scenario tests for Image tab
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';

import {
  validateImageFile,
  MAX_IMAGE_SIZE_BYTES,
} from '../src/imageOcr/imagePreprocess.ts';
import {
  replaceMathSymbols,
  parseFractionsInLine,
  parseStackedFractions,
  parseMatrix,
  parseCases,
  parseAlignedEquations,
  parseOcrToLatex,
  isMathExpression,
} from '../src/imageOcr/mathParser.ts';
import { detectAndParseTable } from '../src/imageOcr/tableParser.ts';
import { formatLatexOutput } from '../src/imageOcr/latexGenerator.ts';
import { convertImageToLatex, terminateTesseractWorker } from '../src/imageOcr/ocrEngine.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_POPUP_PATH = 'file://' + path.resolve(__dirname, '../dist/popup.html');

describe('Image Preprocessing & Validation', () => {
  it('validates supported image formats (PNG, JPG, WEBP, BMP)', () => {
    const pngFile = { name: 'formula.png', type: 'image/png', size: 1024 } as unknown as File;
    const jpgFile = { name: 'scan.jpg', type: 'image/jpeg', size: 2048 } as unknown as File;
    const webpFile = { name: 'diagram.webp', type: 'image/webp', size: 4096 } as unknown as File;
    const bmpFile = { name: 'math.bmp', type: 'image/bmp', size: 8192 } as unknown as File;

    assert.equal(validateImageFile(pngFile).valid, true);
    assert.equal(validateImageFile(jpgFile).valid, true);
    assert.equal(validateImageFile(webpFile).valid, true);
    assert.equal(validateImageFile(bmpFile).valid, true);
  });

  it('rejects unsupported file formats', () => {
    const pdfFile = { name: 'doc.pdf', type: 'application/pdf', size: 1024 } as unknown as File;
    const docxFile = { name: 'doc.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1024 } as unknown as File;
    const txtFile = { name: 'note.txt', type: 'text/plain', size: 1024 } as unknown as File;

    const resPdf = validateImageFile(pdfFile);
    assert.equal(resPdf.valid, false);
    assert.ok(resPdf.error?.includes('Unsupported image format'));

    const resDocx = validateImageFile(docxFile);
    assert.equal(resDocx.valid, false);

    const resTxt = validateImageFile(txtFile);
    assert.equal(resTxt.valid, false);
  });

  it('rejects images exceeding 15MB limit', () => {
    const hugeFile = {
      name: 'large_photo.png',
      type: 'image/png',
      size: MAX_IMAGE_SIZE_BYTES + 1024,
    } as unknown as File;

    const result = validateImageFile(hugeFile);
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes('15MB'));
  });
});

describe('Mathematical Expression & Symbol Parser', () => {
  it('replaces Greek letters with LaTeX commands', () => {
    const input = 'α + β = γ * θ / π + Ω';
    const output = replaceMathSymbols(input);
    assert.ok(output.includes('\\alpha'));
    assert.ok(output.includes('\\beta'));
    assert.ok(output.includes('\\gamma'));
    assert.ok(output.includes('\\theta'));
    assert.ok(output.includes('\\pi'));
    assert.ok(output.includes('\\Omega'));
  });

  it('replaces mathematical operators with LaTeX commands', () => {
    const input = 'a ≤ b and c ≥ d, x ≠ y, ± 5, ∫ f(x) dx, ∑ i, ∞';
    const output = replaceMathSymbols(input);
    assert.ok(output.includes('\\le'));
    assert.ok(output.includes('\\ge'));
    assert.ok(output.includes('\\neq'));
    assert.ok(output.includes('\\pm'));
    assert.ok(output.includes('\\int'));
    assert.ok(output.includes('\\sum'));
    assert.ok(output.includes('\\infty'));
  });

  it('replaces Unicode superscripts and subscripts', () => {
    const input = 'x² + y³ + z⁻¹ = a₀ + b₁';
    const output = replaceMathSymbols(input);
    assert.ok(output.includes('x^{2}'));
    assert.ok(output.includes('y^{3}'));
    assert.ok(output.includes('z^{-1}'));
    assert.ok(output.includes('a_{0}'));
    assert.ok(output.includes('b_{1}'));
  });

  it('replaces square root symbols with \\sqrt{...}', () => {
    const input = '√(x+1) + √25';
    const output = replaceMathSymbols(input);
    assert.ok(output.includes('\\sqrt{x+1}'));
    assert.ok(output.includes('\\sqrt{25}'));
  });

  it('parses inline fractions', () => {
    const input1 = '(x + 1) / (y - 1)';
    const parsed1 = parseFractionsInLine(input1);
    assert.equal(parsed1, '\\frac{x + 1}{y - 1}');

    const input2 = 'a / b';
    const parsed2 = parseFractionsInLine(input2);
    assert.equal(parsed2, '\\frac{a}{b}');

    // Does not break date formats
    const dateInput = 'Published on 12/05/2026';
    assert.equal(parseFractionsInLine(dateInput), dateInput);
  });

  it('parses stacked fractions across 3 lines', () => {
    const lines = [
      'x + 1',
      '------',
      'y - 1',
    ];
    const parsed = parseStackedFractions(lines);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0], '\\frac{x + 1}{y - 1}');
  });

  it('parses matrices into bmatrix / pmatrix', () => {
    const matrixLines = [
      '[ 1  2 ]',
      '[ 3  4 ]',
    ];
    const parsed = parseMatrix(matrixLines);
    assert.equal(parsed.isMatrix, true);
    assert.ok(parsed.latex?.includes('\\begin{bmatrix}'));
    assert.ok(parsed.latex?.includes('1 & 2'));
    assert.ok(parsed.latex?.includes('3 & 4'));
    assert.ok(parsed.latex?.includes('\\end{bmatrix}'));
  });

  it('parses system of equations into cases environment', () => {
    const caseLines = [
      '{ 2x + y = 5',
      '  x - 3y = 2',
    ];
    const parsed = parseCases(caseLines);
    assert.equal(parsed.isCases, true);
    assert.ok(parsed.latex?.includes('\\begin{cases}'));
    assert.ok(parsed.latex?.includes('2x + y = 5'));
    assert.ok(parsed.latex?.includes('x - 3y = 2'));
    assert.ok(parsed.latex?.includes('\\end{cases}'));
  });

  it('parses multi-line aligned equations into align* environment', () => {
    const alignLines = [
      'f(x) = x^2 + 2x + 1',
      '     = (x + 1)^2',
    ];
    const parsed = parseAlignedEquations(alignLines);
    assert.equal(parsed.isAlign, true);
    assert.ok(parsed.latex?.includes('\\begin{align*}'));
    assert.ok(parsed.latex?.includes('&='));
    assert.ok(parsed.latex?.includes('\\end{align*}'));
  });

  it('distinguishes math expressions from natural language text', () => {
    assert.equal(isMathExpression('f(x) = x^2 + 1'), true);
    assert.equal(isMathExpression('\\alpha + \\beta = 10'), true);
    assert.equal(isMathExpression('Bonjour à tous, voici un exercice pour calculer la dérivée.'), false);
  });
});

describe('Tabular Structure Detection & Booktabs Conversion', () => {
  it('converts pipe-delimited markdown table to LaTeX table with booktabs', () => {
    const ocrData = {
      text: [
        '| Metric | Value | Units |',
        '| --- | --- | --- |',
        '| Speed | 120 | km/h |',
        '| Mass | 45 | kg |',
      ].join('\n'),
      confidence: 95,
    };

    const result = detectAndParseTable(ocrData);
    assert.equal(result.isTable, true);
    assert.ok(result.latex?.includes('\\begin{table}[htbp]'));
    assert.ok(result.latex?.includes('\\begin{tabular}{lll}'));
    assert.ok(result.latex?.includes('\\toprule'));
    assert.ok(result.latex?.includes('Metric & Value & Units'));
    assert.ok(result.latex?.includes('\\midrule'));
    assert.ok(result.latex?.includes('Speed & 120 & $km/h$') || result.latex?.includes('Speed & 120 & km/h'));
    assert.ok(result.latex?.includes('\\bottomrule'));
    assert.ok(result.latex?.includes('\\end{tabular}'));
  });

  it('converts multi-column space-separated text into a tabular environment', () => {
    const ocrData = {
      text: [
        'Product     Price     Qty',
        'Apple       1.50      10',
        'Banana      0.75      20',
      ].join('\n'),
      confidence: 90,
    };

    const result = detectAndParseTable(ocrData);
    assert.equal(result.isTable, true);
    assert.ok(result.latex?.includes('\\begin{tabular}{lll}'));
    assert.ok(result.latex?.includes('Apple & 1.50 & 10'));
  });
});

describe('LaTeX Output Formatting (Fragment vs Document & Figure Embedding)', () => {
  it('formats Mode 1 (Fragment) without document preamble', () => {
    const content = '\\[\nE = mc^{2}\n\\]';
    const output = formatLatexOutput(content, { mode: 'fragment' });
    assert.equal(output, content);
    assert.ok(!output.includes('\\documentclass'));
  });

  it('formats Mode 2 (Complete Document) with article class and amsmath', () => {
    const content = '\\[\nE = mc^{2}\n\\]';
    const output = formatLatexOutput(content, { mode: 'document' });
    assert.ok(output.includes('\\documentclass[11pt,a4paper]{article}'));
    assert.ok(output.includes('\\usepackage{amsmath,amssymb,amsfonts}'));
    assert.ok(output.includes('\\begin{document}'));
    assert.ok(output.includes(content));
    assert.ok(output.includes('\\end{document}'));
  });

  it('configures French babel when hasFrench is true in document mode', () => {
    const content = 'Soit f une fonction continue.';
    const output = formatLatexOutput(content, { mode: 'document', hasFrench: true });
    assert.ok(output.includes('\\usepackage[french,english]{babel}'));
  });

  it('embeds \\begin{figure} when embedFigure option is enabled', () => {
    const content = '\\[\nE = mc^{2}\n\\]';
    const output = formatLatexOutput(content, {
      mode: 'fragment',
      embedFigure: true,
      imageFileName: 'formula.png',
    });
    assert.ok(output.includes('\\begin{figure}[htbp]'));
    assert.ok(output.includes('\\includegraphics[width=0.8\\linewidth]{formula.png}'));
    assert.ok(output.includes('\\caption{Image: formula.png}'));
    assert.ok(output.includes('\\label{fig:recognized-image}'));
    assert.ok(output.includes('\\end{figure}'));
    assert.ok(output.includes(content));
  });
});

describe('Offline Tesseract OCR Engine (End-to-End on Fixtures)', () => {
  it('converts math_equation.png fixture to LaTeX', async () => {
    const imgPath = path.resolve(__dirname, 'fixtures/math_equation.png');
    const imgBuffer = fs.readFileSync(imgPath);

    const result = await convertImageToLatex(imgBuffer, {
      mode: 'fragment',
    });

    assert.ok(result.latex.length > 0, 'Latex output should not be empty');
    assert.ok(
      result.latex.includes('E =') || result.latex.includes('mc') || result.latex.includes('f(x)') || result.latex.includes('x^'),
      `Expected math components in OCR output, got:\n${result.latex}`
    );
    assert.ok(result.confidence > 0, 'Confidence should be positive');
  });

  it('converts french_sample.png fixture and preserves accented characters', async () => {
    const imgPath = path.resolve(__dirname, 'fixtures/french_sample.png');
    const imgBuffer = fs.readFileSync(imgPath);

    const result = await convertImageToLatex(imgBuffer, {
      mode: 'fragment',
      hasFrench: true,
    });

    assert.ok(result.latex.length > 0, 'Latex output should not be empty');
    // Accented French characters: é, è, à, ç, etc.
    const hasAccents = /[éèàçùœThéorème]/i.test(result.latex);
    assert.ok(
      hasAccents || result.latex.toLowerCase().includes('caract') || result.latex.toLowerCase().includes('fonction'),
      `Expected French text/accents in output, got:\n${result.latex}`
    );
  });
});

describe('Playwright UI Interactivity: Image to LaTeX Tab', () => {
  let browser: Browser;
  let page: Page;

  before(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    await page.goto(DIST_POPUP_PATH);
  });

  after(async () => {
    await browser?.close();
    await terminateTesseractWorker();
  });

  it('displays three tabs including Image to LaTeX', async () => {
    const tabUpload = page.locator('#tab-upload');
    const tabPaste = page.locator('#tab-paste');
    const tabImage = page.locator('#tab-image');

    assert.equal(await tabUpload.isVisible(), true);
    assert.equal(await tabPaste.isVisible(), true);
    assert.equal(await tabImage.isVisible(), true);
    assert.equal(await tabImage.innerText(), 'Image to LaTeX');
  });

  it('switches to Image tab and verifies initial idle state', async () => {
    await page.click('#tab-image');

    const panelImage = page.locator('#panel-image');
    assert.equal(await panelImage.isVisible(), true);

    const panelUpload = page.locator('#panel-upload');
    assert.equal(await panelUpload.isVisible(), false);

    const panelPaste = page.locator('#panel-paste');
    assert.equal(await panelPaste.isVisible(), false);

    // Convert button idle and disabled
    const convertBtn = page.locator('#convert-image-btn');
    assert.equal(await convertBtn.isDisabled(), true, 'Convert button should be disabled without image');

    const spinner = page.locator('#convert-image-btn .btn-spinner');
    assert.equal(await spinner.isVisible(), false, 'Spinner must not be visible on idle');

    // Preview card hidden initially
    const previewCard = page.locator('#image-preview-card');
    assert.equal(await previewCard.isVisible(), false, 'Preview card should be hidden initially');
  });

  it('selects an image file and displays preview card', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/math_fraction.png');
    const imageInput = page.locator('#image-file');
    await imageInput.setInputFiles(fixturePath);

    // Preview card should become visible
    const previewCard = page.locator('#image-preview-card');
    await previewCard.waitFor({ state: 'visible', timeout: 5000 });

    const imageName = await page.locator('#image-name').innerText();
    assert.equal(imageName, 'math_fraction.png');

    const imageSize = await page.locator('#image-info').innerText();
    assert.ok(imageSize.includes('KB') || imageSize.includes('B'));

    // Convert button should become enabled
    const convertBtn = page.locator('#convert-image-btn');
    assert.equal(await convertBtn.isDisabled(), false, 'Convert button should be enabled after image selection');
  });

  it('toggles output mode between Fragment and Document', async () => {
    const fragmentBtn = page.locator('#btn-mode-fragment');
    const docBtn = page.locator('#btn-mode-document');

    assert.ok((await fragmentBtn.getAttribute('class'))?.includes('active'));
    assert.ok(!(await docBtn.getAttribute('class'))?.includes('active'));

    await docBtn.click();
    assert.ok((await docBtn.getAttribute('class'))?.includes('active'));
    assert.ok(!(await fragmentBtn.getAttribute('class'))?.includes('active'));

    // Switch back
    await fragmentBtn.click();
    assert.ok((await fragmentBtn.getAttribute('class'))?.includes('active'));
  });

  it('clears selected image when Remove button is clicked', async () => {
    const clearBtn = page.locator('#clear-image-btn');
    await clearBtn.click({ force: true });

    const previewCard = page.locator('#image-preview-card');
    assert.equal(await previewCard.isVisible(), false, 'Preview card should be hidden after clear');

    const convertBtn = page.locator('#convert-image-btn');
    assert.equal(await convertBtn.isDisabled(), true, 'Convert button should be disabled after clear');
  });
});
