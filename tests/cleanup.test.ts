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
});

describe('cleanupLatex (full pipeline)', () => {
  it('applies all cleanup steps', () => {
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
});
