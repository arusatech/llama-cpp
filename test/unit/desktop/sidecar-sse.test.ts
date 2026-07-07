/** @jest-environment node */

import {
  SidecarSseLineParser,
  extractSidecarSseToken,
  parseSidecarSseLine,
  readSidecarSseTokens,
} from '../../../src/isomorphic/sidecar-sse';

function sseLine(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

describe('sidecar SSE parsing', () => {
  describe('extractSidecarSseToken', () => {
    it('extracts chat delta content tokens', () => {
      const payload = JSON.stringify({
        choices: [{ delta: { content: 'hello' } }],
      });
      expect(extractSidecarSseToken(payload, 'chat')).toBe('hello');
    });

    it('extracts completion text tokens', () => {
      const payload = JSON.stringify({
        choices: [{ text: 'world' }],
      });
      expect(extractSidecarSseToken(payload, 'completion')).toBe('world');
    });

    it('returns empty for role-only chat chunks', () => {
      const payload = JSON.stringify({
        choices: [{ delta: { role: 'assistant' } }],
      });
      expect(extractSidecarSseToken(payload, 'chat')).toBe('');
    });

    it('returns empty for [DONE] and malformed JSON', () => {
      expect(extractSidecarSseToken('[DONE]', 'chat')).toBe('');
      expect(extractSidecarSseToken('not-json', 'completion')).toBe('');
    });
  });

  describe('parseSidecarSseLine', () => {
    it('ignores non-data lines and [DONE]', () => {
      expect(parseSidecarSseLine(': keep-alive', 'chat')).toBeNull();
      expect(parseSidecarSseLine('data: [DONE]', 'chat')).toBeNull();
    });

    it('parses chat and completion data lines', () => {
      expect(
        parseSidecarSseLine(
          'data: {"choices":[{"delta":{"content":"Hi"}}]}',
          'chat',
        ),
      ).toBe('Hi');
      expect(
        parseSidecarSseLine(
          'data: {"choices":[{"text":"there"}]}',
          'completion',
        ),
      ).toBe('there');
    });
  });

  describe('SidecarSseLineParser', () => {
    it('reassembles lines split across chunks', () => {
      const parser = new SidecarSseLineParser();
      const part1 = 'data: {"choices":[{"delta":{"content":"Hel';
      const part2 = 'lo"}}]}\n\ndata: {"choices":[{"delta":{"content":"!"}}]}\n\n';

      expect(parser.feed(part1)).toEqual([]);
      expect(parser.feed(part2)).toEqual([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        '',
        'data: {"choices":[{"delta":{"content":"!"}}]}',
        '',
      ]);
    });

    it('flush emits trailing partial line', () => {
      const parser = new SidecarSseLineParser();
      expect(parser.feed('data: {"choices":[{"text":"tail"}]}')).toEqual([]);
      expect(parser.flush()).toEqual(['data: {"choices":[{"text":"tail"}]}']);
      expect(parser.flush()).toEqual([]);
    });
  });

  describe('readSidecarSseTokens', () => {
    function streamFromString(body: string): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder();
      let sent = false;
      return new ReadableStream({
        pull(controller) {
          if (sent) {
            controller.close();
            return;
          }
          sent = true;
          controller.enqueue(encoder.encode(body));
        },
      });
    }

    it('streams chat tokens in order', async () => {
      const body =
        sseLine({ choices: [{ delta: { role: 'assistant' } }] }) +
        sseLine({ choices: [{ delta: { content: 'Hello' } }] }) +
        sseLine({ choices: [{ delta: { content: ' world' } }] }) +
        'data: [DONE]\n\n';
      const tokens: string[] = [];
      await readSidecarSseTokens(streamFromString(body), 'chat', (t) => tokens.push(t));
      expect(tokens).toEqual(['Hello', ' world']);
    });

    it('streams completion tokens and skips malformed chunks', async () => {
      const body =
        sseLine({ choices: [{ text: 'A' }] }) +
        'data: {bad json\n\n' +
        sseLine({ choices: [{ text: 'B' }] }) +
        'data: [DONE]\n\n';
      const tokens: string[] = [];
      await readSidecarSseTokens(streamFromString(body), 'completion', (t) => tokens.push(t));
      expect(tokens).toEqual(['A', 'B']);
    });

    it('handles tokens split across byte chunks', async () => {
      const encoder = new TextEncoder();
      const full =
        sseLine({ choices: [{ delta: { content: 'chunked' } }] }) + 'data: [DONE]\n\n';
      const mid = Math.floor(full.length / 2);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(full.slice(0, mid)));
          controller.enqueue(encoder.encode(full.slice(mid)));
          controller.close();
        },
      });
      const tokens: string[] = [];
      await readSidecarSseTokens(stream, 'chat', (t) => tokens.push(t));
      expect(tokens).toEqual(['chunked']);
    });
  });
});
