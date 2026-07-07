/** OpenAI-style SSE lines emitted by the native desktop sidecar. */
export type SidecarSseKind = 'chat' | 'completion';

/** Extract a token string from one SSE `data:` JSON payload (empty if none). */
export function extractSidecarSseToken(payload: string, kind: SidecarSseKind): string {
  if (payload === '[DONE]') {
    return '';
  }
  try {
    const chunk = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string }; text?: string }>;
    };
    if (kind === 'chat') {
      return chunk.choices?.[0]?.delta?.content ?? '';
    }
    return chunk.choices?.[0]?.text ?? '';
  } catch {
    return '';
  }
}

/** Parse a single SSE line; returns a token when present. */
export function parseSidecarSseLine(line: string, kind: SidecarSseKind): string | null {
  if (!line.startsWith('data: ')) {
    return null;
  }
  const payload = line.slice(6).trim();
  if (payload === '[DONE]') {
    return null;
  }
  const token = extractSidecarSseToken(payload, kind);
  return token ? token : null;
}

/** Buffers decoded stream bytes into complete newline-delimited lines. */
export class SidecarSseLineParser {
  private buffer = '';

  feed(chunk: string): string[] {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    return lines;
  }

  flush(): string[] {
    if (!this.buffer) {
      return [];
    }
    const line = this.buffer;
    this.buffer = '';
    return [line];
  }
}

/** Read token chunks from a fetch `ReadableStream` body. */
export async function readSidecarSseTokens(
  body: ReadableStream<Uint8Array>,
  kind: SidecarSseKind,
  onToken: (token: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SidecarSseLineParser();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const lines = parser.feed(decoder.decode(value, { stream: true }));
    for (const line of lines) {
      const token = parseSidecarSseLine(line, kind);
      if (token) {
        onToken(token);
      }
    }
  }
  for (const line of parser.flush()) {
    const token = parseSidecarSseLine(line, kind);
    if (token) {
      onToken(token);
    }
  }
}
