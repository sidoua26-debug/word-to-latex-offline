/**
 * latexGenerator.ts — Formats recognized content into Mode 1 (Fragment)
 * or Mode 2 (Complete Document), and optionally adds figure embedding.
 */

export interface LatexGenerationOptions {
  mode: 'fragment' | 'document';
  embedFigure?: boolean;
  imageFileName?: string;
  hasFrench?: boolean;
}

/**
 * Wraps generated LaTeX content according to user-selected options.
 */
export function formatLatexOutput(
  content: string,
  options: LatexGenerationOptions
): string {
  let body = content.trim();

  // If user requested image figure embedding
  if (options.embedFigure) {
    const filename = options.imageFileName || 'image.png';
    const figureSnippet = [
      '\\begin{figure}[htbp]',
      '\\centering',
      `\\includegraphics[width=0.8\\linewidth]{${filename}}`,
      `\\caption{Image: ${filename}}`,
      '\\label{fig:recognized-image}',
      '\\end{figure}',
    ].join('\n');

    body = figureSnippet + '\n\n' + body;
  }

  if (options.mode === 'fragment') {
    return body;
  }

  // Complete document mode
  const babelOption = options.hasFrench ? 'french,english' : 'english';

  return [
    '\\documentclass[11pt,a4paper]{article}',
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage[T1]{fontenc}',
    `\\usepackage[${babelOption}]{babel}`,
    '\\usepackage{amsmath,amssymb,amsfonts}',
    '\\usepackage{graphicx}',
    '\\usepackage{booktabs}',
    '\\usepackage{longtable}',
    '\\usepackage{calc}',
    '\\usepackage{array}',
    '',
    '\\begin{document}',
    '',
    body,
    '',
    '\\end{document}',
  ].join('\n');
}
