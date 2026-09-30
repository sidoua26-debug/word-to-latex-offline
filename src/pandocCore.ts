/**
 * pandocCore.ts — Core conversion logic and type contracts.
 * Framework-agnostic and free of direct package exports/DOM dependencies.
 */

export interface PandocInstance {
  convert: (
    options: Record<string, unknown>,
    stdin: string | null,
    files: Record<string, Blob | string>
  ) => Promise<{
    stdout: string;
    stderr: string;
    warnings: unknown[];
    files: Record<string, Blob>;
    mediaFiles: Record<string, Blob>;
  }>;
  query: (options: Record<string, unknown>) => Promise<unknown>;
  pandoc: (args_str: string, inData: unknown, resources: unknown[]) => Promise<unknown>;
}

export type ConvertInput =
  | { format: 'docx'; bytes: ArrayBuffer; filename?: string }
  | { format: 'html' | 'markdown'; text: string };

/**
 * Executes conversion given an initialized pandoc instance.
 */
export async function runPandocConvert(
  pandoc: Pick<PandocInstance, 'convert'>,
  input: ConvertInput
): Promise<string> {
  let result;

  if (input.format === 'docx') {
    const filename = input.filename || `input_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.docx`;
    const arrayBuffer = input.bytes instanceof ArrayBuffer
      ? input.bytes
      : (input.bytes as any).buffer
        ? (input.bytes as any).buffer.slice(
            (input.bytes as any).byteOffset || 0,
            ((input.bytes as any).byteOffset || 0) + ((input.bytes as any).byteLength || 0)
          )
        : input.bytes;

    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    result = await pandoc.convert(
      {
        from: 'docx',
        to: 'latex',
        'input-files': [filename],
      },
      null,
      { [filename]: blob }
    );
  } else {
    // format is 'html' or 'markdown'
    result = await pandoc.convert(
      {
        from: input.format,
        to: 'latex',
      },
      input.text,
      {}
    );
  }

  if (result.stderr) {
    console.warn('[pandoc-wasm stderr]', result.stderr);
  }

  // Check if conversion succeeded
  if (!result.stdout && result.stderr) {
    throw new Error(`Pandoc error: ${result.stderr}`);
  }

  return result.stdout;
}
