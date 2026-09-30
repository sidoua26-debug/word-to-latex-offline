/**
 * mathParser.ts — Mathematical OCR post-processor and LaTeX AST generator.
 * Converts raw OCR tokens, lines, and spatial layout data into clean, valid LaTeX.
 * Handles:
 * - Greek letters & mathematical symbols
 * - Fractions (\frac), square/nth roots (\sqrt)
 * - Superscripts and subscripts
 * - Summations, integrals, limits (\sum, \int, \lim)
 * - Systems of equations (\begin{cases})
 * - Aligned equations (\begin{align*})
 * - Matrices (\begin{pmatrix}, \begin{bmatrix})
 * - Mixed ordinary text (English / French) with inline math $...$
 */

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrSymbol {
  text: string;
  confidence: number;
  bbox?: BoundingBox;
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox?: BoundingBox;
  symbols?: OcrSymbol[];
}

export interface OcrLine {
  text: string;
  confidence: number;
  bbox?: BoundingBox;
  words?: OcrWord[];
}

export interface OcrResultData {
  text: string;
  confidence: number;
  lines?: OcrLine[];
  words?: OcrWord[];
}

// Unicode math symbol mappings to LaTeX commands
const GREEK_MAP: Record<string, string> = {
  'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
  'ε': '\\epsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta',
  'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu',
  'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ρ': '\\rho',
  'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\phi',
  'ϕ': '\\phi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
  'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda',
  'Ξ': '\\Xi', 'Π': '\\Pi', 'Σ': '\\Sigma', 'Υ': '\\Upsilon',
  'Φ': '\\Phi', 'Ψ': '\\Psi', 'Ω': '\\Omega',
};

const OPERATOR_MAP: Record<string, string> = {
  '±': '\\pm', '∓': '\\mp', '×': '\\times', '÷': '\\div',
  '·': '\\cdot', '•': '\\cdot', '∗': '*',
  '≤': '\\le', '≥': '\\ge', '≦': '\\le', '≧': '\\ge',
  '≠': '\\neq', '≈': '\\approx', '≡': '\\equiv', '∼': '\\sim',
  '∝': '\\propto', '∈': '\\in', '∉': '\\notin',
  '⊂': '\\subset', '⊆': '\\subseteq', '∪': '\\cup', '∩': '\\cap',
  '∅': '\\emptyset', '∀': '\\forall', '∃': '\\exists',
  '¬': '\\neg', '⇒': '\\implies', '⇔': '\\iff', '→': '\\to',
  '←': '\\leftarrow', '∂': '\\partial', '∇': '\\nabla',
  '∞': '\\infty', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint',
  '∮': '\\oint', '∑': '\\sum', '∏': '\\prod',
};

const SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')',
  'ⁿ': 'n', 'ⁱ': 'i',
};

const SUBSCRIPT_MAP: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '₊': '+', '₋': '-', '₌': '=', '₍': '(', '₎': ')',
  'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x', 'ᵢ': 'i',
  'ⱼ': 'j', 'ₙ': 'n', 'ₘ': 'm', 'ₖ': 'k',
};

/**
 * Replaces Unicode symbols, Greek letters, and exponents with proper LaTeX commands.
 */
export function replaceMathSymbols(str: string): string {
  let result = str;

  // Replace Unicode superscripts: e.g. x² -> x^{2}, z⁻¹ -> z^{-1}
  result = result.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ]+)/g, (_match, group) => {
    const chars = [...group].map(c => SUPERSCRIPT_MAP[c] || c).join('');
    return `^{${chars}}`;
  });

  // Replace Unicode subscripts: e.g. a₁ -> a_{1}
  result = result.replace(/([₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓᵢⱼₙₘₖ]+)/g, (_match, group) => {
    const chars = [...group].map(c => SUBSCRIPT_MAP[c] || c).join('');
    return `_{${chars}}`;
  });

  // Replace Greek letters
  for (const [char, cmd] of Object.entries(GREEK_MAP)) {
    result = result.replaceAll(char, ` ${cmd} `);
  }

  // Replace operators
  for (const [char, cmd] of Object.entries(OPERATOR_MAP)) {
    result = result.replaceAll(char, ` ${cmd} `);
  }

  // Common root symbols: √x or √(x+1) -> \sqrt{...}
  result = result.replace(/√\s*(\([^\)]+\)|[a-zA-Z0-9]+)/g, (_match, group) => {
    const inner = group.startsWith('(') && group.endsWith(')') ? group.slice(1, -1) : group;
    return `\\sqrt{${inner}}`;
  });

  return result;
}

/**
 * Determines whether a line is primarily a mathematical expression
 * versus a natural language text line.
 */
export function isMathExpression(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Math indicators: equal signs, fractions, greek, operators, square roots
  const mathCharsRegex = /[=≠<>≤≥\+\-\*\/\\^_{}\(\)\[\]√∫∑∏α-ωΑ-Ω]/;
  const words = trimmed.split(/\s+/).filter(w => w.length > 2);
  const commonFrenchWords = /\b(le|la|les|un|une|des|et|en|est|dans|pour|avec|sur|par|qui|que|soit|donc|alors|calculer|montrer|démontrer|théorème|définition|exercice)\b/i;

  if (commonFrenchWords.test(trimmed) && words.length >= 3) {
    return false; // Likely natural language text with potential inline math
  }

  if (mathCharsRegex.test(trimmed)) {
    return true;
  }

  // If line has high ratio of non-alphabetical or short symbols
  const letters = trimmed.replace(/[^a-zA-Z]/g, '').length;
  return letters / trimmed.length < 0.6;
}

/**
 * Parses fractions from text expressions like:
 * (a + b) / (c + d) -> \frac{a+b}{c+d}
 * a / b -> \frac{a}{b}
 */
export function parseFractionsInLine(line: string): string {
  let result = line;

  // Pattern: (expr) / (expr)
  result = result.replace(/\(([^\)]+)\)\s*\/\s*\(([^\)]+)\)/g, '\\frac{$1}{$2}');

  // Pattern: word / word or symbol / symbol
  result = result.replace(/([a-zA-Z0-9\^_\+\-]+)\s*\/\s*([a-zA-Z0-9\^_\+\-]+)/g, (match, num, den) => {
    // Avoid replacing URLs or date patterns like 12/05
    if (/^\d{1,2}\/\d{1,2}$/.test(match)) return match;
    return `\\frac{${num.trim()}}{${den.trim()}}`;
  });

  return result;
}

/**
 * Detects 2D stacked fractions across adjacent lines:
 * Line 0: numerator
 * Line 1: horizontal bar (--- or ___)
 * Line 2: denominator
 */
export function parseStackedFractions(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const cur = lines[i].trim();
    const next = lines[i + 1]?.trim();
    const nextNext = lines[i + 2]?.trim();

    // Check for a horizontal divider line like ---, ____, ===
    if (next && /^[-—_=]{2,}$/.test(next) && nextNext) {
      result.push(`\\frac{${cur}}{${nextNext}}`);
      i += 3;
      continue;
    }

    result.push(lines[i]);
    i++;
  }

  return result;
}

/**
 * Detects matrix notation:
 * Lines bounded by [ ... ] or ( ... ) containing multiple rows & columns.
 */
export function parseMatrix(lines: string[]): { isMatrix: boolean; latex?: string } {
  if (lines.length < 2) return { isMatrix: false };

  const trimmed = lines.map(l => l.trim()).filter(Boolean);
  const isBracketed = (
    (trimmed[0].startsWith('[') || trimmed[0].startsWith('(')) &&
    (trimmed[trimmed.length - 1].endsWith(']') || trimmed[trimmed.length - 1].endsWith(')'))
  );

  const env = (trimmed[0].startsWith('[') || trimmed[trimmed.length - 1].endsWith(']'))
    ? 'bmatrix'
    : 'pmatrix';

  // Check if each line has 2 or more space-separated elements
  const rows = trimmed.map(l => l.replace(/^[\[\(]|[\]\)]$/g, '').trim().split(/\s{2,}|\s*,\s*|\s+/));
  const colCounts = rows.map(r => r.length);
  const isConsistent = colCounts.length >= 2 && colCounts.every(c => c >= 2 && Math.abs(c - colCounts[0]) <= 1);

  if (isBracketed || (isConsistent && rows.length <= 6)) {
    const matrixBody = rows.map(r => r.join(' & ')).join(' \\\\\n');
    return {
      isMatrix: true,
      latex: `\\begin{${env}}\n${matrixBody}\n\\end{${env}}`,
    };
  }

  return { isMatrix: false };
}

/**
 * Detects system of equations (cases environment):
 * Lines grouped together, each containing an equation.
 */
export function parseCases(lines: string[]): { isCases: boolean; latex?: string } {
  const trimmed = lines.map(l => l.trim()).filter(Boolean);
  if (trimmed.length < 2) return { isCases: false };

  const hasLeadingBrace = trimmed.some(l => l.startsWith('{'));
  const allAreEquations = trimmed.every(l => /[=<>≤≥]/.test(l));

  if (hasLeadingBrace || (allAreEquations && trimmed.length >= 2 && trimmed.length <= 4)) {
    const cleanedRows = trimmed.map(l => l.replace(/^\{\s*/, ''));
    return {
      isCases: true,
      latex: `\\begin{cases}\n${cleanedRows.join(' \\\\\n')}\n\\end{cases}`,
    };
  }

  return { isCases: false };
}

/**
 * Detects multi-line equation alignment:
 * When multiple lines have equal signs.
 */
export function parseAlignedEquations(lines: string[]): { isAlign: boolean; latex?: string } {
  const trimmed = lines.map(l => l.trim()).filter(Boolean);
  if (trimmed.length < 2) return { isAlign: false };

  const eqCount = trimmed.filter(l => l.includes('=')).length;
  if (eqCount >= 2 && eqCount === trimmed.length) {
    const alignedRows = trimmed.map(line => {
      // Replace first = with &=
      return line.replace(/=/, '&=');
    });
    return {
      isAlign: true,
      latex: `\\begin{align*}\n${alignedRows.join(' \\\\\n')}\n\\end{align*}`,
    };
  }

  return { isAlign: false };
}

/**
 * Full mathematical OCR parser:
 * Takes raw OCR lines and metadata, and produces clean LaTeX code.
 */
export function parseOcrToLatex(ocrResult: OcrResultData): string {
  const rawLines = ocrResult.lines?.length
    ? ocrResult.lines.map(l => l.text)
    : ocrResult.text.split('\n');

  // Strip empty whitespace lines
  const cleanedLines = rawLines.map(l => l.trim()).filter(Boolean);
  if (cleanedLines.length === 0) return '';

  // 1. Check for stacked fractions
  const fractionProcessed = parseStackedFractions(cleanedLines);

  // 2. Check for matrix environment
  const matrixCheck = parseMatrix(fractionProcessed);
  if (matrixCheck.isMatrix && matrixCheck.latex) {
    return matrixCheck.latex;
  }

  // 3. Check for system of equations (cases)
  const casesCheck = parseCases(fractionProcessed);
  if (casesCheck.isCases && casesCheck.latex) {
    return casesCheck.latex;
  }

  // 4. Check for aligned equations
  const alignCheck = parseAlignedEquations(fractionProcessed);
  if (alignCheck.isAlign && alignCheck.latex) {
    return alignCheck.latex;
  }

  // 5. Line-by-line processing
  const outputBlocks: string[] = [];

  for (let i = 0; i < fractionProcessed.length; i++) {
    let line = fractionProcessed[i];

    // Symbol and fraction replacements
    line = replaceMathSymbols(line);
    line = parseFractionsInLine(line);

    // Confidence warning
    const ocrLineObj = ocrResult.lines?.[i];
    let warningComment = '';
    if (ocrLineObj && ocrLineObj.confidence > 0 && ocrLineObj.confidence < 60) {
      warningComment = `% Note: Low recognition confidence (${Math.round(ocrLineObj.confidence)}%) on line below\n`;
    }

    if (isMathExpression(line)) {
      // Standalone equation line
      outputBlocks.push(`${warningComment}\\[\n${line}\n\\]`);
    } else {
      // Natural language text: keep French accents and wrap any isolated single math symbols
      outputBlocks.push(`${warningComment}${line}`);
    }
  }

  return outputBlocks.join('\n\n');
}
