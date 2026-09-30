/**
 * scenarios.test.ts — Verification of all 12 scenarios:
 * 1. Idle state on open (no spinner).
 * 2. DOCX with headings, bold, italic.
 * 3. DOCX with bullet and numbered lists (nested).
 * 4. DOCX with table containing lists inside cells.
 * 5. DOCX with French text and special characters.
 * 6. Paste mode with plain French text.
 * 7. Paste mode with HTML table containing lists.
 * 8. Conversion error handling (corrupted file).
 * 9. Empty state validation (buttons disabled).
 * 10. File removal/clear functionality.
 * 11. Clipboard copy confirmation.
 * 12. Tab switching state preservation.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
// @ts-ignore
import { createPandocInstance } from "../node_modules/pandoc-wasm/src/core.js";
import { runPandocConvert } from "../src/pandocCore.ts";
import { cleanupLatex } from "../src/cleanup.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_POPUP_PATH = "file://" + path.resolve(__dirname, "../dist/popup.html");

describe("Scenario 1 & 9: Idle state on open and empty state validation", () => {
  let browser: Browser;
  let page: Page;

  before(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    await page.goto(DIST_POPUP_PATH);
  });

  after(async () => {
    await browser?.close();
  });

  it("1. Idle state on open: button displays idle text, spinner is completely hidden", async () => {
    const uploadBtn = page.locator("#convert-btn");
    const uploadText = page.locator("#convert-btn .btn-text");
    const uploadSpinner = page.locator("#convert-btn .btn-spinner");

    assert.equal(await uploadText.isVisible(), true, "Upload button text should be visible");
    assert.equal(await uploadSpinner.isVisible(), false, "Upload button spinner must NOT be visible");
    const display = await uploadSpinner.evaluate((el) => window.getComputedStyle(el).display);
    assert.equal(display, "none", "Computed display of spinner must be none");

    const pasteSpinner = page.locator("#convert-paste-btn .btn-spinner");
    assert.equal(await pasteSpinner.isVisible(), false, "Paste button spinner must NOT be visible");
    const pasteDisplay = await pasteSpinner.evaluate((el) => window.getComputedStyle(el).display);
    assert.equal(pasteDisplay, "none", "Computed display of paste spinner must be none");
  });

  it("9. Empty state validation: convert buttons are disabled when empty", async () => {
    const uploadBtn = page.locator("#convert-btn");
    assert.equal(await uploadBtn.isDisabled(), true, "Upload button should be disabled with no file");

    // Switch to paste tab
    await page.click("#tab-paste");
    const pasteBtn = page.locator("#convert-paste-btn");
    assert.equal(await pasteBtn.isDisabled(), true, "Paste button should be disabled when empty");

    // Switch back to upload tab
    await page.click("#tab-upload");
  });
});

describe("Scenarios 2, 3, 4, 5, 8: DOCX Conversion Quality & Error Handling", () => {
  let pandoc: any;

  before(async () => {
    const wasmPath = path.resolve(__dirname, "../node_modules/pandoc-wasm/src/pandoc.wasm");
    const wasmBuffer = fs.readFileSync(wasmPath);
    pandoc = await createPandocInstance(wasmBuffer);
  });

  it("2. DOCX with headings, bold, italic", async () => {
    const docxPath = path.resolve(__dirname, "fixtures/headings_bold_italic.docx");
    const bytes = fs.readFileSync(docxPath);
    const raw = await runPandocConvert(pandoc, { format: "docx", bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
    const clean = cleanupLatex(raw);

    assert.ok(clean.includes("Heading Level 1"), "Must include heading text");
    assert.ok(clean.includes("\\textbf{Bold Text}"), "Must format bold text with \\textbf");
    assert.ok(clean.includes("\\emph{Italic Text}"), "Must format italic text with \\emph");
    assert.ok(!clean.includes("\\tightlist"), "Must not contain \\tightlist");
  });

  it("3. DOCX with bullet and numbered lists (nested)", async () => {
    const docxPath = path.resolve(__dirname, "fixtures/nested_lists.docx");
    const bytes = fs.readFileSync(docxPath);
    const raw = await runPandocConvert(pandoc, { format: "docx", bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
    const clean = cleanupLatex(raw);

    assert.ok(clean.includes("Item 1"), "Must include list items");
    assert.ok(clean.includes("Sub Item 1.1"), "Must include nested items");
    assert.ok(clean.includes("Item 2"), "Must include item 2");
    assert.ok(!clean.includes("\\tightlist"), "Must strip \\tightlist");
  });

  it("4. DOCX with table containing lists inside cells", async () => {
    const docxPath = path.resolve(__dirname, "fixtures/table_with_lists.docx");
    const bytes = fs.readFileSync(docxPath);
    const raw = await runPandocConvert(pandoc, { format: "docx", bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
    const clean = cleanupLatex(raw);

    assert.ok(clean.includes("Header A") && clean.includes("Header B"), "Must contain table headers");
    assert.ok(clean.includes("Row 1"), "Must contain table cell content");
    if (clean.includes("\\begin{itemize}")) {
      assert.ok(clean.includes("\\begin{minipage}"), "List in table cell must be wrapped in minipage");
    }
    if (clean.includes("\\begin{longtable}")) {
      assert.ok(clean.includes("% \\usepackage{longtable}"), "Must list longtable package");
    }
  });

  it("5. DOCX with French text and special characters", async () => {
    const docxPath = path.resolve(__dirname, "fixtures/french_text.docx");
    const bytes = fs.readFileSync(docxPath);
    const raw = await runPandocConvert(pandoc, { format: "docx", bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
    const clean = cleanupLatex(raw);

    assert.ok(clean.includes("Bonjour le monde"), "French text preserved");
    assert.ok(clean.includes("résumé"), "Accents é preserved");
    assert.ok(clean.includes("œuvre"), "French ligature œ preserved");
    assert.ok(clean.includes("«") && clean.includes("»"), "French guillemets preserved");
    assert.ok(clean.includes("caractères accentués : é, è, à, ç, œ, ù"), "All French accents preserved intact");
    assert.ok(!clean.toLowerCase().includes("here is"), "No conversational preamble");
    assert.ok(!clean.toLowerCase().includes("translation"), "No translation commentary");
  });

  it("8. Conversion error handling (corrupted file)", async () => {
    const docxPath = path.resolve(__dirname, "fixtures/corrupted.docx");
    const bytes = fs.readFileSync(docxPath);

    await assert.rejects(
      async () => {
        await runPandocConvert(pandoc, { format: "docx", bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
      },
      /Pandoc error/i,
      "Must reject corrupted docx file gracefully"
    );
  });
});

describe("Scenarios 6 & 7: Paste Mode Conversion", () => {
  let pandoc: any;

  before(async () => {
    const wasmPath = path.resolve(__dirname, "../node_modules/pandoc-wasm/src/pandoc.wasm");
    const wasmBuffer = fs.readFileSync(wasmPath);
    pandoc = await createPandocInstance(wasmBuffer);
  });

  it("6. Paste mode with plain French text", async () => {
    const frenchText = "« Bonjour à tous et à l’œuvre des étudiants ! Est-ce prêt ? Oui, très bien. »";
    const raw = await runPandocConvert(pandoc, { format: "markdown", text: frenchText });
    const clean = cleanupLatex(raw);

    assert.ok(clean.includes("«") && clean.includes("»"), "Guillemets preserved");
    assert.ok(clean.includes("Bonjour à tous"), "Accents preserved");
    assert.ok(clean.includes("œuvre"), "Ligatures preserved");
    assert.ok(clean.includes("très"), "Accent grave preserved");
    assert.ok(!clean.includes("\\documentclass"), "Must be a fragment without documentclass");
    assert.ok(!clean.includes("Here is"), "No AI conversation");
  });

  it("7. Paste mode with HTML table containing lists", async () => {
    const htmlTable = "<table><thead><tr><th>Task</th><th>Checklist</th></tr></thead><tbody><tr><td>Review</td><td><ul><li>Item 1</li><li>Item 2</li></ul></td></tr></tbody></table>";

    const raw = await runPandocConvert(pandoc, { format: "html", text: htmlTable });
    const clean = cleanupLatex(raw);

    assert.ok(clean.includes("Review"), "Cell text present");
    assert.ok(clean.includes("Item 1") && clean.includes("Item 2"), "List items present");
    assert.ok(clean.includes("\\begin{minipage}"), "List in table wrapped in minipage");
    assert.ok(!clean.includes("\\tightlist"), "Tightlist stripped");
    assert.ok(clean.includes("% \\usepackage{longtable}"), "Required packages suggested");
    assert.ok(clean.includes("% \\usepackage{calc}"), "Calc package suggested for real dimensions");
    assert.ok(clean.includes("% \\usepackage{array}"), "Array package suggested");
  });
});

describe("Scenarios 10, 11, 12: UI Interactivity & Edge Cases", () => {
  let browser: Browser;
  let page: Page;

  before(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ permissions: ["clipboard-read", "clipboard-write"] });
    await page.goto(DIST_POPUP_PATH);
  });

  after(async () => {
    await browser?.close();
  });

  it("10. File removal/clear functionality", async () => {
    const fileInput = page.locator("#docx-file");
    const convertBtn = page.locator("#convert-btn");
    const clearBtn = page.locator("#clear-file-btn");
    const fileNameSpan = page.locator("#file-name");

    assert.equal(await clearBtn.isVisible(), false);
    assert.equal(await convertBtn.isDisabled(), true);

    const testDocxPath = path.resolve(__dirname, "fixtures/headings_bold_italic.docx");
    await fileInput.setInputFiles(testDocxPath);

    assert.equal(await clearBtn.isVisible(), true, "Clear button should become visible");
    assert.equal(await convertBtn.isDisabled(), false, "Convert button should be enabled");
    assert.ok((await fileNameSpan.textContent())?.includes("headings_bold_italic.docx"));

    await clearBtn.click();

    assert.equal(await clearBtn.isVisible(), false, "Clear button should be hidden after clearing");
    assert.equal(await convertBtn.isDisabled(), true, "Convert button should be disabled after clearing");
    assert.ok((await fileNameSpan.textContent())?.includes("Choose a .docx file"));
  });

  it("11. Clipboard copy confirmation", async () => {
    await page.evaluate(() => {
      const outputWrapper = document.getElementById("output-wrapper");
      const outputTextarea = document.getElementById("output");
      outputWrapper.hidden = false;
      outputTextarea.value = "\\textbf{Testing clipboard copy}";
    });

    const copyBtn = page.locator("#copy-btn");
    const toast = page.locator("#copied-toast");

    assert.equal(await toast.isVisible(), false, "Toast should be initially hidden");
    await copyBtn.click();
    await toast.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
    assert.equal(await toast.isVisible(), true, "Toast should be visible after clicking copy");
  });

  it("12. Tab switching state preservation", async () => {
    await page.click("#tab-paste");
    const pasteInput = page.locator("#paste-input");
    const pasteBtn = page.locator("#convert-paste-btn");

    await pasteInput.fill("Some text in paste box");
    await pasteInput.dispatchEvent("input");
    assert.equal(await pasteBtn.isDisabled(), false, "Paste button should be enabled with text");

    await page.click("#tab-upload");
    const uploadPanel = page.locator("#panel-upload");
    const pastePanel = page.locator("#panel-paste");
    assert.equal(await uploadPanel.isVisible(), true);
    assert.equal(await pastePanel.isVisible(), false);

    await page.click("#tab-paste");
    assert.equal(await pasteInput.innerText(), "Some text in paste box");
    assert.equal(await pasteBtn.isDisabled(), false, "Paste button should remain enabled");
  });
});
