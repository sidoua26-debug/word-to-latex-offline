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

/**
 * Unwraps `\foreignlanguage{<lang>}{<content>}` and `\begin{otherlanguage}{<lang>}` wrappers.
 * For paste-ready LaTeX fragments, redundant language annotations clutter output
 * and prevent seamless pasting into standard documents.
 * Handles balanced braces correctly for arbitrary nested LaTeX content.
 */
function unwrapForeignLanguage(latex: string): string {
  let result = latex;
  const marker = '\\foreignlanguage{';

  while (true) {
    const idx = result.indexOf(marker);
    if (idx === -1) break;

    // Find the end of the language argument: \foreignlanguage{<lang>}{
    const langCloseIdx = result.indexOf('}', idx + marker.length);
    if (langCloseIdx === -1 || result[langCloseIdx + 1] !== '{') {
      break;
    }

    const contentStart = langCloseIdx + 2;
    let depth = 1;
    let i = contentStart;

    while (i < result.length && depth > 0) {
      if (result[i] === '{') depth++;
      else if (result[i] === '}') depth--;
      i++;
    }

    if (depth !== 0) {
      break;
    }

    const inner = result.substring(contentStart, i - 1);
    result = result.substring(0, idx) + inner + result.substring(i);
  }

  // Also strip block-level otherlanguage environments
  result = result.replace(/\\begin\{otherlanguage\*?\}\{[^}]*\}\s*/g, '');
  result = result.replace(/\\end\{otherlanguage\*?\}\s*/g, '');

  // Remove empty braces {} left between unwrapped commands
  result = result.replace(/\{\}/g, '');

  return result;
}

/**
 * Cleans unnecessary tildes introduced by Word French typography metadata
 * without affecting standard semantic LaTeX ties like Fig.~1 or math.
 */
function cleanFrenchPunctuationAndTildes(latex: string): string {
  let result = latex;

  // 1. Unwrap empty/spacing groups like {~ } or { } or {~}
  result = result.replace(/\{\s*~*\s*\}/g, ' ');

  // 2. Normalize tildes before French high punctuation marks: ~: -> " :", ~; -> " ;", ~! -> " !", ~? -> " ?"
  result = result.replace(/~([:;!?»])/g, ' $1');
  result = result.replace(/(«)~/g, '$1 ');

  // 3. Normalize tilde followed by whitespace: "~ " -> " "
  result = result.replace(/~[ \t]+/g, ' ');

  // 4. Normalize tildes following bullet symbols or non-ASCII characters at line start
  result = result.replace(/(^[ \t]*[^\w\s\\])[ \t]*~[ \t]*/gmu, '$1  ');

  return result;
}

/**
 * Unwraps redundant grouping braces around plain text and Unicode symbols
 * introduced by Pandoc's span/mso-spacerun mapping (e.g. {{Ø}} or {Ø } -> Ø).
 * Does NOT touch arguments to LaTeX commands (\textbf{...}) or math sub/superscripts.
 */
function unwrapRedundantBraces(latex: string): string {
  let result = latex;

  // Remove bare empty braces {} left between unwrapped commands
  result = result.replace(/\{\}/g, '');

  // Unwrap double braces {{...}} -> {...}
  while (/\{\{([^{}]+)\}\}/.test(result)) {
    result = result.replace(/\{\{([^{}]+)\}\}/g, '{$1}');
  }

  // Unwrap bare braces around content not preceded by a backslash macro, ^ or _
  result = result.replace(/(^|[\s\n(])\{([^{}\\]+)\}/gu, '$1$2');
  result = result.replace(/(^|[\s\n(])\{([^{}\\]+)\}/gu, '$1$2');

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

/**
 * Wraps list environments (\begin{itemize} or \begin{enumerate}) located inside table environments
 * (longtable, tabular, tabularx, etc.) in a minipage if they are not already wrapped.
 * This guarantees valid, compilable LaTeX for tables containing lists.
 */
function fixTableLists(latex: string): string {
  const tableRegex = /(\\begin\{(?:longtable|tabular\*?|tabularx|tabulary)\}[\s\S]*?\\end\{(?:longtable|tabular\*?|tabularx|tabulary)\})/g;

  return latex.replace(tableRegex, (tableBlock) => {
    const tokenRegex = /(\\begin\{(?:minipage|itemize|enumerate)\}|\\end\{(?:minipage|itemize|enumerate)\})/g;

    if (!/\\begin\{(?:itemize|enumerate)\}/.test(tableBlock)) {
      return tableBlock;
    }

    let minipageDepth = 0;
    let listDepth = 0;
    let currentListStart = -1;
    let currentListType = '';
    let result = '';
    let lastIdx = 0;

    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(tableBlock)) !== null) {
      const token = match[1];
      const matchIdx = match.index;

      if (token.startsWith('\\begin{minipage}')) {
        minipageDepth++;
      } else if (token.startsWith('\\end{minipage}')) {
        if (minipageDepth > 0) minipageDepth--;
      } else if (token.startsWith('\\begin{itemize}') || token.startsWith('\\begin{enumerate}')) {
        const type = token.includes('itemize') ? 'itemize' : 'enumerate';
        if (minipageDepth === 0 && listDepth === 0) {
          currentListStart = matchIdx;
          currentListType = type;
        }
        listDepth++;
      } else if (token.startsWith('\\end{itemize}') || token.startsWith('\\end{enumerate}')) {
        const type = token.includes('itemize') ? 'itemize' : 'enumerate';
        if (listDepth > 0) {
          listDepth--;
          if (minipageDepth === 0 && listDepth === 0 && currentListStart !== -1 && currentListType === type) {
            const listEnd = matchIdx + token.length;
            const beforeList = tableBlock.substring(lastIdx, currentListStart);
            const listContent = tableBlock.substring(currentListStart, listEnd);

            result += beforeList;
            result += `\\begin{minipage}[t]{\\linewidth}\\raggedright\n${listContent}\n\\end{minipage}`;
            lastIdx = listEnd;
            currentListStart = -1;
            currentListType = '';
          }
        }
      }
    }

    result += tableBlock.substring(lastIdx);
    return result;
  });
}

/** Package detection rules: pattern → package name. */
const PACKAGE_RULES: Array<{ pattern: RegExp; pkg: string }> = [
  { pattern: /\\(toprule|midrule|bottomrule)\b/, pkg: 'booktabs' },
  { pattern: /\\begin\{longtable\}/, pkg: 'longtable' },
  { pattern: /\\begin\{tabularx\}/, pkg: 'tabularx' },
  { pattern: /\\real\{/, pkg: 'calc' },
  { pattern: />\{.*?\\arraybackslash\}|\\arraybackslash\b/, pkg: 'array' },
  { pattern: /\\includegraphics/, pkg: 'graphicx' },
  { pattern: /\\(hyperlink|hyperref)\b/, pkg: 'hyperref' },
  { pattern: /\\(uline|sout)\b/, pkg: 'ulem' },
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
  result = unwrapForeignLanguage(result);
  result = cleanFrenchPunctuationAndTildes(result);
  result = unwrapRedundantBraces(result);
  result = fixTableLists(result);
  result = collapseBlankLines(result);
  result = trimTrailingWhitespace(result);
  result = prependPackageComments(result);
  return result;
}

// Also export individual functions for unit testing
export {
  removeTightlist,
  unwrapPandocbounded,
  unwrapForeignLanguage,
  cleanFrenchPunctuationAndTildes,
  unwrapRedundantBraces,
  fixTableLists,
  collapseBlankLines,
  trimTrailingWhitespace,
  prependPackageComments,
};
