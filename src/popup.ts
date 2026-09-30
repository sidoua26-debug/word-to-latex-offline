/**
 * popup.ts — Main UI controller for the Word to LaTeX extension popup.
 * Supports both .docx file upload and rich-text / plain-text paste.
 */

import { convertToLatex, convertDocxToLatex } from './pandocWasm.js';
import { cleanupLatex } from './cleanup.js';
import { detectPastedFormat, DetectedInput } from './clipboardDetect.js';

// DOM elements — Tabs
const tabUpload = document.getElementById('tab-upload') as HTMLButtonElement;
const tabPaste = document.getElementById('tab-paste') as HTMLButtonElement;
const panelUpload = document.getElementById('panel-upload') as HTMLDivElement;
const panelPaste = document.getElementById('panel-paste') as HTMLDivElement;

// DOM elements — Upload mode
const fileInput = document.getElementById('docx-file') as HTMLInputElement;
const fileName = document.getElementById('file-name') as HTMLSpanElement;
const fileLabel = document.querySelector('.file-label') as HTMLLabelElement;
const clearFileBtn = document.getElementById('clear-file-btn') as HTMLButtonElement | null;
const convertBtn = document.getElementById('convert-btn') as HTMLButtonElement;
const uploadBtnText = convertBtn.querySelector('.btn-text') as HTMLSpanElement;
const uploadBtnSpinner = convertBtn.querySelector('.btn-spinner') as HTMLSpanElement;

// DOM elements — Paste mode
const pasteInput = document.getElementById('paste-input') as HTMLDivElement;
const convertPasteBtn = document.getElementById('convert-paste-btn') as HTMLButtonElement;
const pasteBtnText = convertPasteBtn.querySelector('.btn-text') as HTMLSpanElement;
const pasteBtnSpinner = convertPasteBtn.querySelector('.btn-spinner') as HTMLSpanElement;

// DOM elements — Shared Output & Status
const statusEl = document.getElementById('status') as HTMLDivElement;
const outputWrapper = document.getElementById('output-wrapper') as HTMLDivElement;
const outputTextarea = document.getElementById('output') as HTMLTextAreaElement;
const sourceIndicator = document.getElementById('source-indicator') as HTMLSpanElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
const copiedToast = document.getElementById('copied-toast') as HTMLDivElement;

// State
let selectedFile: File | null = null;
let lastPastedData: DetectedInput | null = null;
let isConverting = false;

// --- Tab Switching ---
tabUpload.addEventListener('click', () => switchTab('upload'));
tabPaste.addEventListener('click', () => switchTab('paste'));

function switchTab(mode: 'upload' | 'paste') {
  if (isConverting) return;

  if (mode === 'upload') {
    tabUpload.classList.add('active');
    tabPaste.classList.remove('active');
    panelUpload.hidden = false;
    panelPaste.hidden = true;
    setUploadLoading(false);
  } else {
    tabPaste.classList.add('active');
    tabUpload.classList.remove('active');
    panelPaste.hidden = false;
    panelUpload.hidden = true;
    setPasteLoading(false);
    pasteInput.focus();
  }
}

// --- Upload Mode: File selection and removal ---
function handleFileSelected(file: File | undefined) {
  if (!file) {
    clearSelectedFile();
    return;
  }

  // Validate format
  if (!file.name.toLowerCase().endsWith('.docx')) {
    clearSelectedFile();
    showStatus('Please select a valid .docx Word document.', 'error');
    return;
  }

  // Validate file size (25MB limit)
  const MAX_SIZE_BYTES = 25 * 1024 * 1024;
  if (file.size > MAX_SIZE_BYTES) {
    clearSelectedFile();
    showStatus('File is too large (>25MB). Please choose a smaller document.', 'error');
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileLabel.classList.add('has-file');
  if (clearFileBtn) clearFileBtn.hidden = false;
  convertBtn.disabled = false;
  hideStatus();
}

function clearSelectedFile() {
  selectedFile = null;
  fileInput.value = '';
  fileName.textContent = 'Choose a .docx file…';
  fileLabel.classList.remove('has-file');
  if (clearFileBtn) clearFileBtn.hidden = true;
  convertBtn.disabled = true;
  setUploadLoading(false);
}

fileInput.addEventListener('change', () => {
  handleFileSelected(fileInput.files?.[0]);
});

if (clearFileBtn) {
  clearFileBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearSelectedFile();
    hideStatus();
  });
}

// --- Upload Mode: Conversion ---
convertBtn.addEventListener('click', async () => {
  if (isConverting || !selectedFile) return;

  isConverting = true;
  setUploadLoading(true);
  hideStatus();

  try {
    const arrayBuffer = await selectedFile.arrayBuffer();
    const rawLatex = await convertDocxToLatex(arrayBuffer);
    const cleanLatex = cleanupLatex(rawLatex);

    // Display result
    renderOutput(cleanLatex, 'docx file');

    // Auto-copy to clipboard
    await copyToClipboard(cleanLatex);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showStatus(`Conversion failed: ${message}`, 'error');
    console.error('[Word to LaTeX] File conversion error:', err);
  } finally {
    isConverting = false;
    setUploadLoading(false);
  }
});

// --- Paste Mode: Intercept Paste ---
pasteInput.addEventListener('paste', (event: ClipboardEvent) => {
  event.preventDefault();

  const clipboardData = event.clipboardData;
  if (!clipboardData) return;

  const html = clipboardData.getData('text/html');
  const text = clipboardData.getData('text/plain');

  const detected = detectPastedFormat({ html, text });
  lastPastedData = detected;

  // Insert the chosen representation into the contenteditable div
  if (detected.format === 'html') {
    // Insert HTML into contenteditable
    pasteInput.innerHTML = detected.content;
  } else {
    // Insert plain text safely
    pasteInput.innerText = detected.content;
  }

  updatePasteButtonState();
});

// Update button when user edits or types directly into pasteInput
pasteInput.addEventListener('input', () => {
  // If the user modified content manually, invalidate the cached paste format
  // so we re-evaluate from current DOM / innerText
  lastPastedData = null;
  updatePasteButtonState();
});

function updatePasteButtonState() {
  const hasContent = Boolean(pasteInput.innerText.trim() || pasteInput.innerHTML.trim());
  convertPasteBtn.disabled = !hasContent || isConverting;
}

// --- Paste Mode: Conversion ---
convertPasteBtn.addEventListener('click', async () => {
  if (isConverting) return;

  const currentText = pasteInput.innerText.trim();
  const currentHtml = pasteInput.innerHTML.trim();

  if (!currentText && !currentHtml) return;

  isConverting = true;
  setPasteLoading(true);
  hideStatus();

  try {
    let inputFormat: 'html' | 'markdown' = 'markdown';
    let inputContent: string = currentText;
    let sourceDesc = 'pasted plain text';

    if (lastPastedData && lastPastedData.content) {
      inputFormat = lastPastedData.format;
      inputContent = lastPastedData.content;
      sourceDesc = lastPastedData.sourceDescription;
    } else {
      // User typed directly or modified pasted content
      const hasMarkup = /<[a-z][\s\S]*>/i.test(currentHtml);
      if (hasMarkup && currentHtml !== currentText) {
        inputFormat = 'html';
        inputContent = currentHtml;
        sourceDesc = 'rich text / HTML';
      } else {
        inputFormat = 'markdown';
        inputContent = currentText;
        sourceDesc = 'typed / plain text';
      }
    }

    const rawLatex = await convertToLatex({
      format: inputFormat,
      text: inputContent,
    });
    const cleanLatex = cleanupLatex(rawLatex);

    // Display result with source indication
    renderOutput(cleanLatex, sourceDesc);

    // Auto-copy to clipboard
    await copyToClipboard(cleanLatex);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showStatus(`Conversion failed: ${message}`, 'error');
    console.error('[Word to LaTeX] Paste conversion error:', err);
  } finally {
    isConverting = false;
    setPasteLoading(false);
  }
});

// --- Output Presentation & Copy ---
function renderOutput(latex: string, source: string) {
  outputTextarea.value = latex;
  sourceIndicator.textContent = `Converted from: ${source}`;
  outputWrapper.hidden = false;
}

copyBtn.addEventListener('click', async () => {
  const text = outputTextarea.value;
  if (text) {
    await copyToClipboard(text);
  }
});

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast();
  } catch (err) {
    console.warn('[Word to LaTeX] Clipboard write failed:', err);
    outputTextarea.select();
    showStatus('Auto-copy failed — text selected, press Ctrl+C to copy.', 'info');
  }
}

function showToast() {
  copiedToast.hidden = false;
  setTimeout(() => {
    copiedToast.hidden = true;
  }, 2000);
}

function setUploadLoading(loading: boolean) {
  convertBtn.disabled = loading || !selectedFile;
  uploadBtnText.hidden = loading;
  uploadBtnSpinner.hidden = !loading;
}

function setPasteLoading(loading: boolean) {
  const hasContent = Boolean(pasteInput.innerText.trim() || pasteInput.innerHTML.trim());
  convertPasteBtn.disabled = loading || !hasContent;
  pasteBtnText.hidden = loading;
  pasteBtnSpinner.hidden = !loading;
}

function showStatus(message: string, type: 'error' | 'info') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.hidden = false;
}

function hideStatus() {
  statusEl.hidden = true;
}

// Initial state setup: Idle, no spinners, buttons disabled until input provided
setUploadLoading(false);
setPasteLoading(false);
if (clearFileBtn) clearFileBtn.hidden = true;
