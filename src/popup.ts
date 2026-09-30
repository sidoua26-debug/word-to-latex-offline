/**
 * popup.ts — Main UI controller for the Word to LaTeX extension popup.
 * Supports:
 * 1. .docx file upload
 * 2. Rich-text / plain-text paste
 * 3. Offline Image to LaTeX recognition (text, equations, tables)
 */

import { convertToLatex, convertDocxToLatex } from './pandocWasm.js';
import { cleanupLatex } from './cleanup.js';
import { detectPastedFormat, DetectedInput } from './clipboardDetect.js';
import {
  validateImageFile,
  fileToDataUrl,
  loadImage,
  preprocessCanvas,
} from './imageOcr/imagePreprocess.js';
import { convertImageToLatex } from './imageOcr/ocrEngine.js';

// DOM elements — Tabs
const tabUpload = document.getElementById('tab-upload') as HTMLButtonElement;
const tabPaste = document.getElementById('tab-paste') as HTMLButtonElement;
const tabImage = document.getElementById('tab-image') as HTMLButtonElement;
const panelUpload = document.getElementById('panel-upload') as HTMLDivElement;
const panelPaste = document.getElementById('panel-paste') as HTMLDivElement;
const panelImage = document.getElementById('panel-image') as HTMLDivElement;

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

// DOM elements — Image mode
const imageDropzone = document.getElementById('image-dropzone') as HTMLDivElement;
const imageFileInput = document.getElementById('image-file') as HTMLInputElement;
const dropzonePrompt = document.getElementById('dropzone-prompt') as HTMLDivElement;
const imagePreviewCard = document.getElementById('image-preview-card') as HTMLDivElement;
const imagePreviewImg = document.getElementById('image-preview') as HTMLImageElement;
const imageName = document.getElementById('image-name') as HTMLSpanElement;
const imageInfo = document.getElementById('image-info') as HTMLSpanElement;
const clearImageBtn = document.getElementById('clear-image-btn') as HTMLButtonElement | null;
const btnModeFragment = document.getElementById('btn-mode-fragment') as HTMLButtonElement;
const btnModeDocument = document.getElementById('btn-mode-document') as HTMLButtonElement;
const checkEmbedFigure = document.getElementById('check-embed-figure') as HTMLInputElement;
const convertImageBtn = document.getElementById('convert-image-btn') as HTMLButtonElement;
const imageBtnText = convertImageBtn.querySelector('.btn-text') as HTMLSpanElement;
const imageBtnSpinner = convertImageBtn.querySelector('.btn-spinner') as HTMLSpanElement;

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
let selectedImageFile: File | null = null;
let selectedImageDataUrl: string | null = null;
let imageOutputMode: 'fragment' | 'document' = 'fragment';
let isConverting = false;

// --- Tab Switching ---
tabUpload.addEventListener('click', () => switchTab('upload'));
tabPaste.addEventListener('click', () => switchTab('paste'));
tabImage.addEventListener('click', () => switchTab('image'));

function switchTab(mode: 'upload' | 'paste' | 'image') {
  if (isConverting) return;

  // Deactivate all
  tabUpload.classList.remove('active');
  tabPaste.classList.remove('active');
  tabImage.classList.remove('active');
  panelUpload.hidden = true;
  panelPaste.hidden = true;
  panelImage.hidden = true;

  if (mode === 'upload') {
    tabUpload.classList.add('active');
    panelUpload.hidden = false;
    setUploadLoading(false);
  } else if (mode === 'paste') {
    tabPaste.classList.add('active');
    panelPaste.hidden = false;
    setPasteLoading(false);
    pasteInput.focus();
  } else {
    tabImage.classList.add('active');
    panelImage.hidden = false;
    setImageLoading(false);
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

    renderOutput(cleanLatex, 'docx file');
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

  if (detected.format === 'html') {
    pasteInput.innerHTML = detected.content;
  } else {
    pasteInput.innerText = detected.content;
  }

  updatePasteButtonState();
});

pasteInput.addEventListener('input', () => {
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

    renderOutput(cleanLatex, sourceDesc);
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

// --- Image Mode: File selection, dropzone, and clipboard paste ---
async function handleImageSelected(file: File | undefined) {
  if (!file) {
    clearSelectedImage();
    return;
  }

  const validation = validateImageFile(file);
  if (!validation.valid) {
    clearSelectedImage();
    showStatus(validation.error || 'Invalid image file.', 'error');
    return;
  }

  try {
    selectedImageFile = file;
    const dataUrl = await fileToDataUrl(file);
    selectedImageDataUrl = dataUrl;

    // Load into preview image to extract dimensions
    const img = await loadImage(dataUrl);
    imagePreviewImg.src = dataUrl;
    imageName.textContent = file.name;
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    imageInfo.textContent = `${img.naturalWidth}×${img.naturalHeight}px • ${sizeMb} MB`;

    dropzonePrompt.hidden = true;
    imagePreviewCard.hidden = false;
    if (clearImageBtn) clearImageBtn.hidden = false;
    convertImageBtn.disabled = false;
    hideStatus();
  } catch (err) {
    clearSelectedImage();
    showStatus('Failed to read image preview.', 'error');
  }
}

function clearSelectedImage() {
  selectedImageFile = null;
  selectedImageDataUrl = null;
  imageFileInput.value = '';
  imagePreviewImg.src = '';
  imagePreviewCard.hidden = true;
  if (clearImageBtn) clearImageBtn.hidden = true;
  dropzonePrompt.hidden = false;
  convertImageBtn.disabled = true;
  setImageLoading(false);
}

imageFileInput.addEventListener('change', () => {
  handleImageSelected(imageFileInput.files?.[0]);
});

if (clearImageBtn) {
  clearImageBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearSelectedImage();
    hideStatus();
  });
}

// Drag & drop handlers
imageDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  imageDropzone.classList.add('dragover');
});

imageDropzone.addEventListener('dragleave', () => {
  imageDropzone.classList.remove('dragover');
});

imageDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  imageDropzone.classList.remove('dragover');
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    handleImageSelected(file);
  }
});

// Clipboard image paste support (when Image tab is active)
window.addEventListener('paste', async (e: ClipboardEvent) => {
  if (panelImage.hidden) return; // Only trigger if Image tab is active

  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) {
      const file = items[i].getAsFile();
      if (file) {
        e.preventDefault();
        await handleImageSelected(file);
        break;
      }
    }
  }
});

// Output mode buttons
btnModeFragment.addEventListener('click', () => {
  imageOutputMode = 'fragment';
  btnModeFragment.classList.add('active');
  btnModeDocument.classList.remove('active');
});

btnModeDocument.addEventListener('click', () => {
  imageOutputMode = 'document';
  btnModeDocument.classList.add('active');
  btnModeFragment.classList.remove('active');
});

// --- Image Mode: Conversion ---
convertImageBtn.addEventListener('click', async () => {
  if (isConverting || !selectedImageFile || !selectedImageDataUrl) return;

  isConverting = true;
  setImageLoading(true);
  hideStatus();

  try {
    showStatus('Preparing image and recognizing text/equations...', 'info');

    // Preprocess image on canvas
    const img = await loadImage(selectedImageDataUrl);
    const canvas = preprocessCanvas(img);

    const result = await convertImageToLatex(canvas, {
      mode: imageOutputMode,
      embedFigure: checkEmbedFigure.checked,
      imageFileName: selectedImageFile.name,
      hasFrench: true,
      onProgress: (phase) => {
        showStatus(phase, 'info');
      },
    });

    renderOutput(result.latex, `image (${selectedImageFile.name})`);
    if (result.quality === 'uncertain' || result.quality === 'low') {
      showStatus(`Conversion complete (${result.confidence}% confidence). Review and edit formulas in the output box below before copying.`, 'info');
    } else if (result.hasMath) {
      showStatus('Conversion complete with experimental math recognition. You can edit expressions below before copying.', 'info');
    } else {
      hideStatus();
    }
    await copyToClipboard(result.latex);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showStatus(`Image conversion failed: ${message}`, 'error');
    console.error('[Word to LaTeX] Image conversion error:', err);
  } finally {
    isConverting = false;
    setImageLoading(false);
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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      showToast();
      return;
    }
    throw new Error('Clipboard API unavailable');
  } catch (err) {
    try {
      outputTextarea.select();
      const success = document.execCommand('copy');
      if (success) {
        showToast();
        return;
      }
    } catch {}
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

function setImageLoading(loading: boolean) {
  convertImageBtn.disabled = loading || !selectedImageFile;
  imageBtnText.hidden = loading;
  imageBtnSpinner.hidden = !loading;
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
setImageLoading(false);
if (clearFileBtn) clearFileBtn.hidden = true;
if (clearImageBtn) clearImageBtn.hidden = true;
