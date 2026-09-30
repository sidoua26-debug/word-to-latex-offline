/**
 * tableParser.ts — Detects and converts tabular structures from OCR text and bounding boxes.
 * Produces standard LaTeX tabular/longtable environments with booktabs styling.
 */

import type { OcrResultData } from './mathParser.ts';

export interface TableDetectionResult {
  isTable: boolean;
  latex?: string;
}

/**
 * Checks if OCR output represents a table:
 * - Either has pipe delimiters (| col1 | col2 |)
 * - Or has 2+ lines with consistent tab / multi-column spacing
 */
export function detectAndParseTable(ocr: OcrResultData): TableDetectionResult {
  const lines = (ocr.lines?.length ? ocr.lines.map(l => l.text) : ocr.text.split('\n'))
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { isTable: false };
  }

  // Case 1: Explicit pipe-delimited table (e.g. Markdown or ASCII table)
  const pipeLines = lines.filter(l => l.includes('|'));
  if (pipeLines.length >= 2 && pipeLines.length >= lines.length * 0.7) {
    const rawRows = pipeLines
      .filter(l => !/^[\|\s\-:]+$/.test(l)) // Filter out markdown separator row |---|---|
      .map(line => {
        return line
          .split('|')
          .map(cell => cell.trim())
          .filter((cell, idx, arr) => {
            // Drop empty outer cells created by leading/trailing pipes
            if ((idx === 0 || idx === arr.length - 1) && cell === '') return false;
            return true;
          });
      });

    if (rawRows.length >= 2 && rawRows[0].length >= 2) {
      return {
        isTable: true,
        latex: generateLatexTable(rawRows),
      };
    }
  }

  // Case 2: Multi-column tabular text (columns separated by 2+ spaces or tabs)
  const splitRows = lines.map(l => l.split(/\s{2,}|\t/).map(c => c.trim()).filter(Boolean));
  const colCounts = splitRows.map(r => r.length);
  const minCols = Math.min(...colCounts);
  const maxCols = Math.max(...colCounts);

  if (minCols >= 2 && maxCols - minCols <= 1 && splitRows.length >= 2 && splitRows.length <= 20) {
    return {
      isTable: true,
      latex: generateLatexTable(splitRows),
    };
  }

  return { isTable: false };
}

/**
 * Generates LaTeX tabular environment with booktabs styling.
 */
function generateLatexTable(rows: string[][]): string {
  const numCols = Math.max(...rows.map(r => r.length));
  const colSpec = 'l'.repeat(numCols);

  const header = rows[0].map(c => escapeLatexCell(c)).join(' & ');
  const dataRows = rows.slice(1).map(row => {
    // Pad row if needed
    const padded = [...row];
    while (padded.length < numCols) padded.push('');
    return padded.map(c => escapeLatexCell(c)).join(' & ') + ' \\\\';
  });

  return [
    '\\begin{table}[htbp]',
    '\\centering',
    `\\begin{tabular}{${colSpec}}`,
    '\\toprule',
    `${header} \\\\`,
    '\\midrule',
    ...dataRows,
    '\\bottomrule',
    '\\end{tabular}',
    '\\end{table}',
  ].join('\n');
}

function escapeLatexCell(text: string): string {
  // If the cell contains math signs, wrap in $...$
  if (/[=+\-*/^_{}]/.test(text) && !text.includes('$')) {
    return `$${text}$`;
  }
  return text;
}
