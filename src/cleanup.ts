/**
 * cleanup.ts — Post-process Pandoc's LaTeX output for clean, paste-ready fragments.
 * Framework-agnostic; no DOM or browser dependencies.
 */

/** Remove lines that are exactly `\tightlist` (with optional surrounding whitespace). */
function removeTightlist(latex: string): string {
  return latex.replace(/^[ \t]*\\tightlist[ \t]*$/gm, '');
}

/**
 * Unwrap `\pandocbounded{...}` commands, keeping only the inner content.
 * Handles nested braces correctly by tracking brace depth.
 */
function unwrapPandocbounded(latex: string): string {
  const marker = '\\pandocbounded{';
  let result = latex;

  // Repeat until no more \pandocbounded{ remain
  while (true) {
    const idx = result.indexOf(marker);
    if (idx === -1) break;

    const contentStart = idx + marker.length;
    let depth = 1;
    let i = contentStart;

    while (i < result.length && depth > 0) {
      if (result[i] === '{') depth++;
      else if (result[i] === '}') depth--;
      i++;
    }

    if (depth !== 0) {
      // Unbalanced braces — bail out to avoid corruption
      break;
    }

    // Extract the inner content (everything between the opening { and matching })
    const inner = result.substring(contentStart, i - 1);
    result = result.substring(0, idx) + inner + result.substring(i);
  }

  return result;
}

/** Collapse 3+ consecutive blank lines down to at most 2. */
function collapseBlankLines(latex: string): string {
  return latex.replace(/([ \t]*\n){3,}/g, '\n\n');
}

/** Trim trailing whitespace from each line. */
function trimTrailingWhitespace(latex: string): string {
  return latex.replace(/[ \t]+$/gm, '');
}

/** Package detection rules: pattern → package name. */
const PACKAGE_RULES: Array<{ pattern: RegExp; pkg: string }> = [
  { pattern: /\\(toprule|midrule|bottomrule)\b/, pkg: 'booktabs' },
  { pattern: /\\begin\{longtable\}/, pkg: 'longtable' },
  { pattern: /\\includegraphics/, pkg: 'graphicx' },
  { pattern: /\\(hyperlink|hyperref)\b/, pkg: 'hyperref' },
];

/**
 * Scan LaTeX for constructs needing specific packages and prepend a comment block
 * listing the required \usepackage lines.
 */
function prependPackageComments(latex: string): string {
  const needed = new Set<string>();

  for (const rule of PACKAGE_RULES) {
    if (rule.pattern.test(latex)) {
      needed.add(rule.pkg);
    }
  }

  if (needed.size === 0) return latex;

  const sorted = [...needed].sort();
  const lines = [
    '% Required packages (add to your preamble):',
    ...sorted.map((pkg) => `% \\usepackage{${pkg}}`),
    '',
    '',
  ];

  return lines.join('\n') + latex;
}

/**
 * Full cleanup pipeline. Applies all transformations in order.
 * @param raw — Raw LaTeX string from Pandoc.
 * @returns Cleaned, paste-ready LaTeX fragment.
 */
export function cleanupLatex(raw: string): string {
  let result = raw;
  result = removeTightlist(result);
  result = unwrapPandocbounded(result);
  result = collapseBlankLines(result);
  result = trimTrailingWhitespace(result);
  result = prependPackageComments(result);
  return result;
}

// Also export individual functions for unit testing
export {
  removeTightlist,
  unwrapPandocbounded,
  collapseBlankLines,
  trimTrailingWhitespace,
  prependPackageComments,
};
