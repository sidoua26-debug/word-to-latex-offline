/**
 * Unit tests for cleanup.ts
 * Run with: npx tsx --test tests/cleanup.test.ts
 * Or: node --loader tsx --test tests/cleanup.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanupLatex,
  removeTightlist,
  unwrapPandocbounded,
  unwrapForeignLanguage,
  cleanFrenchPunctuationAndTildes,
  unwrapRedundantBraces,
  collapseBlankLines,
  trimTrailingWhitespace,
  prependPackageComments,
} from '../src/cleanup.ts';

describe('removeTightlist', () => {
  it('removes bare \\tightlist lines', () => {
    const input = '\\begin{itemize}\n\\tightlist\n\\item Hello\n\\end{itemize}';
    const expected = '\\begin{itemize}\n\n\\item Hello\n\\end{itemize}';
    assert.equal(removeTightlist(input), expected);
  });

  it('removes \\tightlist with surrounding whitespace', () => {
    const input = '  \\tightlist  ';
    assert.equal(removeTightlist(input), '');
  });

  it('does not remove \\tightlist embedded in other content', () => {
    const input = 'some \\tightlist thing';
    assert.equal(removeTightlist(input), 'some \\tightlist thing');
  });
});

describe('unwrapPandocbounded', () => {
  it('unwraps a simple \\pandocbounded{...}', () => {
    const input = '\\pandocbounded{hello world}';
    assert.equal(unwrapPandocbounded(input), 'hello world');
  });

  it('handles nested braces', () => {
    const input = '\\pandocbounded{\\textbf{nested {deep}}}';
    assert.equal(unwrapPandocbounded(input), '\\textbf{nested {deep}}');
  });

  it('handles multiple occurrences', () => {
    const input = '\\pandocbounded{first} and \\pandocbounded{second}';
    assert.equal(unwrapPandocbounded(input), 'first and second');
  });

  it('handles nested pandocbounded', () => {
    const input = '\\pandocbounded{outer \\pandocbounded{inner}}';
    assert.equal(unwrapPandocbounded(input), 'outer inner');
  });

  it('preserves content without pandocbounded', () => {
    const input = '\\textbf{hello}';
    assert.equal(unwrapPandocbounded(input), '\\textbf{hello}');
  });
});

describe('collapseBlankLines', () => {
  it('collapses 3+ blank lines to 2', () => {
    const input = 'a\n\n\n\nb';
    const result = collapseBlankLines(input);
    assert.equal(result, 'a\n\nb');
  });

  it('preserves 2 blank lines', () => {
    const input = 'a\n\nb';
    assert.equal(collapseBlankLines(input), 'a\n\nb');
  });

  it('collapses many blank lines', () => {
    const input = 'a\n\n\n\n\n\nb';
    const result = collapseBlankLines(input);
    assert.equal(result, 'a\n\nb');
  });
});

describe('trimTrailingWhitespace', () => {
  it('trims trailing spaces', () => {
    assert.equal(trimTrailingWhitespace('hello   '), 'hello');
  });

  it('trims trailing tabs', () => {
    assert.equal(trimTrailingWhitespace('hello\t\t'), 'hello');
  });

  it('works per line', () => {
    const input = 'line1   \nline2\t\nline3';
    assert.equal(trimTrailingWhitespace(input), 'line1\nline2\nline3');
  });
});

describe('prependPackageComments', () => {
  it('detects booktabs', () => {
    const input = '\\toprule\ncontent\n\\bottomrule';
    const result = prependPackageComments(input);
    assert.ok(result.includes('% \\usepackage{booktabs}'));
  });

  it('detects longtable', () => {
    const input = '\\begin{longtable}{ll}';
    const result = prependPackageComments(input);
    assert.ok(result.includes('% \\usepackage{longtable}'));
  });

  it('detects graphicx', () => {
    const input = '\\includegraphics[width=1cm]{img.png}';
    const result = prependPackageComments(input);
    assert.ok(result.includes('% \\usepackage{graphicx}'));
  });

  it('detects hyperref', () => {
    const input = '\\hyperref[sec:intro]{Introduction}';
    const result = prependPackageComments(input);
    assert.ok(result.includes('% \\usepackage{hyperref}'));
  });

  it('detects multiple packages', () => {
    const input = '\\toprule\n\\includegraphics{x}';
    const result = prependPackageComments(input);
    assert.ok(result.includes('% \\usepackage{booktabs}'));
    assert.ok(result.includes('% \\usepackage{graphicx}'));
  });

  it('adds no comment block when no packages needed', () => {
    const input = 'Hello world';
    assert.equal(prependPackageComments(input), input);
  });

  it('sorts packages alphabetically', () => {
    const input = '\\includegraphics{x}\n\\toprule';
    const result = prependPackageComments(input);
    const lines = result.split('\n');
    const pkgLines = lines.filter(l => l.startsWith('% \\usepackage'));
    assert.equal(pkgLines[0], '% \\usepackage{booktabs}');
    assert.equal(pkgLines[1], '% \\usepackage{graphicx}');
  });

  it('detects calc and array for longtable column specifications', () => {
    const input = '\\begin{longtable}[]{@{}>{\\raggedright\\arraybackslash}p{(\\linewidth - 2\\tabcolsep) * \\real{0.5000}}@{}}';
    const result = prependPackageComments(input);
    assert.ok(result.includes('% \\usepackage{array}'));
    assert.ok(result.includes('% \\usepackage{calc}'));
    assert.ok(result.includes('% \\usepackage{longtable}'));
  });

  it('detects ulem for underlined and strikethrough text', () => {
    const input = '\\uline{underlined text} and \\sout{strike}';
    const result = prependPackageComments(input);
    assert.ok(result.includes('% \\usepackage{ulem}'));
  });

  it('detects tabularx', () => {
    const input = '\\begin{tabularx}{\\linewidth}{lX}';
    const result = prependPackageComments(input);
    assert.ok(result.includes('% \\usepackage{tabularx}'));
  });
});

describe('fixTableLists', () => {
  it('wraps unwrapped itemize in a longtable cell with minipage', () => {
    const input = '\\begin{longtable}[]{@{}ll@{}}\nCell 1 & \\begin{itemize}\n\\item Item 1\n\\item Item 2\n\\end{itemize} \\\\\n\\end{longtable}';
    const result = cleanupLatex(input);
    assert.ok(result.includes('\\begin{minipage}[t]{\\linewidth}\\raggedright\n\\begin{itemize}'));
    assert.ok(result.includes('\\end{itemize}\n\\end{minipage}'));
  });

  it('wraps unwrapped enumerate in a tabular cell with minipage', () => {
    const input = '\\begin{tabular}{ll}\nA & \\begin{enumerate}\n\\item Step 1\n\\item Step 2\n\\end{enumerate} \\\\\n\\end{tabular}';
    const result = cleanupLatex(input);
    assert.ok(result.includes('\\begin{minipage}[t]{\\linewidth}\\raggedright\n\\begin{enumerate}'));
    assert.ok(result.includes('\\end{enumerate}\n\\end{minipage}'));
  });

  it('does not duplicate minipage if already wrapped', () => {
    const input = '\\begin{longtable}[]{@{}ll@{}}\nCell 1 & \\begin{minipage}[t]{\\linewidth}\\raggedright\n\\begin{itemize}\n\\item Item 1\n\\end{itemize}\n\\end{minipage} \\\\\n\\end{longtable}';
    const result = cleanupLatex(input);
    // Count occurrences of \begin{minipage}
    const matches = result.match(/\\begin\{minipage\}/g) || [];
    assert.equal(matches.length, 1);
  });

  it('does not wrap lists that are outside of tables', () => {
    const input = 'Here is a regular list:\n\n\\begin{itemize}\n\\item Bullet 1\n\\item Bullet 2\n\\end{itemize}';
    const result = cleanupLatex(input);
    assert.ok(!result.includes('\\begin{minipage}'));
    assert.ok(result.includes('\\begin{itemize}'));
  });

  it('wraps nested lists inside a table in a single outer minipage', () => {
    const input = '\\begin{longtable}[]{@{}ll@{}}\nCell 1 & \\begin{itemize}\n\\item Level 1\n\\begin{itemize}\n\\item Level 2\n\\end{itemize}\n\\end{itemize} \\\\\n\\end{longtable}';
    const result = cleanupLatex(input);
    const minipageMatches = result.match(/\\begin\{minipage\}/g) || [];
    assert.equal(minipageMatches.length, 1);
    assert.ok(result.includes('\\begin{minipage}[t]{\\linewidth}\\raggedright\n\\begin{itemize}'));
  });
});

describe('unwrapForeignLanguage', () => {
  it('unwraps simple \\foreignlanguage{french}{...}', () => {
    const input = '\\foreignlanguage{french}{Corps : laiton CW617N}';
    assert.equal(unwrapForeignLanguage(input), 'Corps : laiton CW617N');
  });

  it('handles nested braces inside content', () => {
    const input = '\\foreignlanguage{french}{\\textbf{Corps} : laiton {CW617N}}';
    assert.equal(unwrapForeignLanguage(input), '\\textbf{Corps} : laiton {CW617N}');
  });

  it('unwraps multiple occurrences and cleans empty braces', () => {
    const input = '\\foreignlanguage{french}{Ø}{}\\foreignlanguage{french}{Corps : laiton}';
    assert.equal(unwrapForeignLanguage(input), 'ØCorps : laiton');
  });

  it('unwraps \\begin{otherlanguage}{french} environments', () => {
    const input = '\\begin{otherlanguage}{french}\nTexte en français\n\\end{otherlanguage}';
    assert.equal(unwrapForeignLanguage(input).trim(), 'Texte en français');
  });
});

describe('cleanFrenchPunctuationAndTildes', () => {
  it('normalizes tildes before colons and high punctuation', () => {
    const input = 'Corps~: laiton; Pression~: 16 bars? Débit~: 70L/min! Vrai~; faux~: «~test~»';
    const expected = 'Corps : laiton; Pression : 16 bars? Débit : 70L/min! Vrai ; faux : « test »';
    assert.equal(cleanFrenchPunctuationAndTildes(input), expected);
  });

  it('unwraps redundant spacing groups like {~ }', () => {
    const input = 'Ø{~ }Corps : laiton';
    assert.equal(cleanFrenchPunctuationAndTildes(input), 'Ø Corps : laiton');
  });

  it('normalizes leading bullet symbols with tildes', () => {
    const input = 'Ø~ Corps : laiton\nØ~ Pression : 0.2 bars\nØ~ Débit : 70L/min';
    assert.ok(!cleanFrenchPunctuationAndTildes(input).includes('~'));
    assert.ok(cleanFrenchPunctuationAndTildes(input).includes('Ø Corps : laiton'));
  });

  it('preserves standard LaTeX semantic ties like Fig.~1 and p.~42', () => {
    const input = 'Voir Fig.~1 et p.~42 pour plus de détails.';
    assert.equal(cleanFrenchPunctuationAndTildes(input), input);
  });
});

describe('unwrapRedundantBraces', () => {
  it('unwraps bare braces around standalone symbols and Unicode characters', () => {
    const input = '{Ø} {€} {°} {±} {≤} {≥} {×} {μ} {é} {à}';
    assert.equal(unwrapRedundantBraces(input), 'Ø € ° ± ≤ ≥ × μ é à');
  });

  it('unwraps nested double braces {{...}}', () => {
    const input = '{{Ø}} et {{text}}';
    assert.equal(unwrapRedundantBraces(input), 'Ø et text');
  });

  it('preserves LaTeX macro arguments, math superscripts, and subscripts', () => {
    const input = '\\textbf{bold text} \\emph{italic} x^{2} y_{1} \\frac{1}{2}';
    assert.equal(unwrapRedundantBraces(input), input);
  });
});

describe('cleanupLatex (full pipeline)', () => {
  it('applies all cleanup steps including tightlist, pandocbounded, and package comments', () => {
    const input = [
      '\\pandocbounded{\\begin{itemize}}',
      '\\tightlist',
      '\\item First   ',
      '\\item Second\t',
      '\\pandocbounded{\\end{itemize}}',
      '',
      '',
      '',
      '',
      '\\toprule',
    ].join('\n');

    const result = cleanupLatex(input);

    // tightlist removed
    assert.ok(!result.includes('\\tightlist'));
    // pandocbounded unwrapped
    assert.ok(!result.includes('\\pandocbounded'));
    assert.ok(result.includes('\\begin{itemize}'));
    // trailing whitespace trimmed
    assert.ok(!result.includes('First   '));
    assert.ok(!result.includes('Second\t'));
    // blank lines collapsed
    assert.ok(!result.includes('\n\n\n'));
    // package comment added
    assert.ok(result.includes('% \\usepackage{booktabs}'));
  });

  it('cleans exact user French bug input with foreignlanguage and malformed Ø', () => {
    const rawInput = [
      '\\foreignlanguage{french}{{Ø{~ }}}{}\\foreignlanguage{french}{Corps~:',
      'laiton CW617N}',
      '',
      '\\foreignlanguage{french}{{Ø{~ }}}{}\\foreignlanguage{french}{Pression~:',
      '0.2 à 16 bars}',
      '',
      '\\foreignlanguage{french}{{Ø{~ }}}{}\\foreignlanguage{french}{Débit',
      'nominal~: 70L/min}',
    ].join('\n');

    const result = cleanupLatex(rawInput);

    // No foreignlanguage
    assert.ok(!result.includes('\\foreignlanguage'));
    // No malformed braces or tildes around Ø
    assert.ok(!result.includes('Ø{~ }'));
    assert.ok(!result.includes('{Ø}'));
    assert.ok(!result.includes('Corps~:'));
    assert.ok(!result.includes('nominal~:'));
    // Text and accents preserved
    assert.ok(result.includes('Corps :'));
    assert.ok(result.includes('Pression :'));
    assert.ok(result.includes('0.2 à 16 bars'));
    assert.ok(result.includes('Débit'));
    assert.ok(result.includes('70L/min'));
  });
});
