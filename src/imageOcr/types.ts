/**
 * types.ts — Modular architecture contracts for Image to LaTeX recognition.
 * Separates the preprocessing, OCR text engine, mathematical recognition engine,
 * and LaTeX generator into pluggable, replaceable components.
 */

export type RecognitionQuality = 'high' | 'medium' | 'low' | 'uncertain';

export interface RecognitionWarning {
  lineIndex?: number;
  message: string;
  suggestion?: string;
}

export interface RecognitionResult {
  engine: string;
  rawText: string;
  latex: string;
  confidence: number; // 0 to 100
  quality: RecognitionQuality;
  warnings: RecognitionWarning[];
  isTable: boolean;
  hasMath: boolean;
}

export interface RecognitionOptions {
  mode: 'fragment' | 'document';
  embedFigure?: boolean;
  imageFileName?: string;
  hasFrench?: boolean;
  onProgress?: (statusText: string, progress: number) => void;
}

export interface ImageRecognitionEngine {
  readonly id: string;
  readonly name: string;
  recognize(
    image: string | HTMLCanvasElement | Buffer | Uint8Array,
    options: RecognitionOptions
  ): Promise<RecognitionResult>;
}
