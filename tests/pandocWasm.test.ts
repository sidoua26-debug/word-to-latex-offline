import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runPandocConvert } from '../src/pandocCore.ts';
import type { ConvertInput } from '../src/pandocCore.ts';

describe('runPandocConvert branching logic', () => {
  it('calls convert with stdin when format is html', async () => {
    let capturedOptions: any = null;
    let capturedStdin: any = null;
    let capturedFiles: any = null;

    const mockPandoc = {
      convert: async (options: any, stdin: any, files: any) => {
        capturedOptions = options;
        capturedStdin = stdin;
        capturedFiles = files;
        return {
          stdout: '\\textbf{Converted HTML}',
          stderr: '',
          warnings: [],
          files: {},
          mediaFiles: {},
        };
      },
    };

    const input: ConvertInput = {
      format: 'html',
      text: '<p><b>Hello</b></p>',
    };

    const output = await runPandocConvert(mockPandoc, input);

    assert.equal(output, '\\textbf{Converted HTML}');
    assert.deepEqual(capturedOptions, { from: 'html', to: 'latex' });
    assert.equal(capturedStdin, '<p><b>Hello</b></p>');
    assert.deepEqual(capturedFiles, {});
  });

  it('calls convert with stdin when format is markdown', async () => {
    let capturedOptions: any = null;
    let capturedStdin: any = null;
    let capturedFiles: any = null;

    const mockPandoc = {
      convert: async (options: any, stdin: any, files: any) => {
        capturedOptions = options;
        capturedStdin = stdin;
        capturedFiles = files;
        return {
          stdout: '\\section{Heading}',
          stderr: '',
          warnings: [],
          files: {},
          mediaFiles: {},
        };
      },
    };

    const input: ConvertInput = {
      format: 'markdown',
      text: '# Heading',
    };

    const output = await runPandocConvert(mockPandoc, input);

    assert.equal(output, '\\section{Heading}');
    assert.deepEqual(capturedOptions, { from: 'markdown', to: 'latex' });
    assert.equal(capturedStdin, '# Heading');
    assert.deepEqual(capturedFiles, {});
  });

  it('calls convert with files object and input-files option when format is docx', async () => {
    let capturedOptions: any = null;
    let capturedStdin: any = null;
    let capturedFiles: any = null;

    const mockPandoc = {
      convert: async (options: any, stdin: any, files: any) => {
        capturedOptions = options;
        capturedStdin = stdin;
        capturedFiles = files;
        return {
          stdout: 'Docx content in LaTeX',
          stderr: '',
          warnings: [],
          files: {},
          mediaFiles: {},
        };
      },
    };

    const dummyBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const input: ConvertInput = {
      format: 'docx',
      bytes: dummyBytes,
      filename: 'input.docx',
    };

    const output = await runPandocConvert(mockPandoc, input);

    assert.equal(output, 'Docx content in LaTeX');
    assert.deepEqual(capturedOptions, {
      from: 'docx',
      to: 'latex',
      'input-files': ['input.docx'],
    });
    assert.equal(capturedStdin, null);
    assert.ok(capturedFiles['input.docx'] instanceof Blob);
  });

  it('throws an error if conversion fails and returns stderr', async () => {
    const mockPandoc = {
      convert: async () => ({
        stdout: '',
        stderr: 'Parsing error at line 1',
        warnings: [],
        files: {},
        mediaFiles: {},
      }),
    };

    await assert.rejects(
      async () => {
        await runPandocConvert(mockPandoc, { format: 'markdown', text: 'bad input' });
      },
      /Pandoc error: Parsing error at line 1/
    );
  });
});
