/**
 * imagePreprocess.ts — Client-side image validation and preprocessing pipeline.
 * Formats: PNG, JPG/JPEG, WEBP, BMP.
 * Processing: Grayscale, contrast normalization, thresholding, and downscaling for optimal OCR.
 */

export const SUPPORTED_IMAGE_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/bmp',
  'image/x-ms-bmp',
];

export const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];

export const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates file format and size.
 */
export function validateImageFile(file: File): ImageValidationResult {
  const fileName = file.name.toLowerCase();
  const hasValidExt = SUPPORTED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  const hasValidMime = file.type ? SUPPORTED_IMAGE_MIMES.includes(file.type.toLowerCase()) : false;

  if (!hasValidExt && !hasValidMime) {
    return {
      valid: false,
      error: 'Unsupported image format. Please select a PNG, JPG/JPEG, WEBP, or BMP image.',
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image exceeds maximum allowed size (15MB). Current size: ${(file.size / (1024 * 1024)).toFixed(1)}MB.`,
    };
  }

  return { valid: true };
}

/**
 * Reads a File or Blob into a Base64 data URL.
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Loads an image from a data URL or image source.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image data.'));
    img.src = src;
  });
}

export interface PreprocessOptions {
  maxDimension?: number;
  contrast?: number; // 1.0 = normal, >1.0 = increased
  grayscale?: boolean;
}

/**
 * Preprocesses an image using HTML Canvas:
 * - Downscales if larger than maxDimension (default 2200px)
 * - Converts to high-contrast grayscale
 */
export function preprocessCanvas(
  img: HTMLImageElement,
  options: PreprocessOptions = {}
): HTMLCanvasElement {
  const maxDim = options.maxDimension || 2200;
  let { width, height } = img;

  // Scale down if dimensions are excessively large
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Draw image
  ctx.drawImage(img, 0, 0, width, height);

  // Pixel manipulation for grayscale and contrast
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const contrastFactor = options.contrast !== undefined ? options.contrast : 1.25;

  for (let i = 0; i < data.length; i += 4) {
    // Luminance grayscale
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // Apply contrast stretching around midpoint 128
    gray = (gray - 128) * contrastFactor + 128;
    gray = Math.max(0, Math.min(255, gray));

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    // Alpha data[i + 3] remains unchanged
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
