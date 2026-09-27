import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasMeaningfulHtml,
  detectPastedFormat,
} from '../src/clipboardDetect.ts';

describe('hasMeaningfulHtml', () => {
  it('returns false for empty or whitespace-only html', () => {
    assert.equal(hasMeaningfulHtml(''), false);
    assert.equal(hasMeaningfulHtml('   \n  \t '), false);
  });

  it('returns false for bare wrapper divs with plain text', () => {
    assert.equal(hasMeaningfulHtml('<div>Hello world</div>'), false);
    assert.equal(hasMeaningfulHtml('<html><body><div>Hello world</div></body></html>'), false);
  });

  it('returns false for html with only meta tags and comments', () => {
    const input = '<!--StartFragment--><meta charset="utf-8"><span>Just plain text</span><!--EndFragment-->';
    assert.equal(hasMeaningfulHtml(input), false);
  });

  it('returns true when bold or italic tags are present', () => {
    assert.equal(hasMeaningfulHtml('<p>Hello <b>world</b></p>'), true);
    assert.equal(hasMeaningfulHtml('<div>Hello <strong>world</strong></div>'), true);
    assert.equal(hasMeaningfulHtml('<span>Some <em>emphasized</em> text</span>'), true);
  });

  it('returns true when tables are present', () => {
    const tableHtml = '<table><tr><th>Col 1</th><th>Col 2</th></tr><tr><td>A</td><td>B</td></tr></table>';
    assert.equal(hasMeaningfulHtml(tableHtml), true);
  });

  it('returns true when headings or lists are present', () => {
    assert.equal(hasMeaningfulHtml('<h2>Section Header</h2>'), true);
    assert.equal(hasMeaningfulHtml('<ul><li>Item 1</li><li>Item 2</li></ul>'), true);
  });

  it('returns true when spans have inline styles', () => {
    assert.equal(hasMeaningfulHtml('<span style="font-weight: bold;">Styled text</span>'), true);
  });
});

describe('detectPastedFormat', () => {
  it('prefers HTML when meaningful structure exists', () => {
    const payload = {
      html: '<table><tr><td>Cell 1</td></tr></table>',
      text: 'Cell 1',
    };
    const res = detectPastedFormat(payload);
    assert.equal(res.format, 'html');
    assert.equal(res.content, '<table><tr><td>Cell 1</td></tr></table>');
    assert.equal(res.sourceDescription, 'pasted HTML');
  });

  it('falls back to markdown/plain text when HTML has no meaningful structure', () => {
    const payload = {
      html: '<!--StartFragment--><div>Just plain text</div><!--EndFragment-->',
      text: 'Just plain text with *markdown*',
    };
    const res = detectPastedFormat(payload);
    assert.equal(res.format, 'markdown');
    assert.equal(res.content, 'Just plain text with *markdown*');
    assert.equal(res.sourceDescription, 'pasted plain text');
  });

  it('uses markdown when no HTML is available', () => {
    const payload = {
      html: '',
      text: '# Title\n\n- Item 1\n- Item 2',
    };
    const res = detectPastedFormat(payload);
    assert.equal(res.format, 'markdown');
    assert.equal(res.content, '# Title\n\n- Item 1\n- Item 2');
    assert.equal(res.sourceDescription, 'pasted plain text');
  });
});
