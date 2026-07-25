/** @jest-environment node */

import {
  assertBackendSupportsQuants,
  preflightGguf,
} from '../../src/isomorphic/gguf-preflight';
import { LlmError } from '../../src/isomorphic/errors';

/** Minimal little-endian GGUF writer for unit tests. */
class Buf {
  parts: Buffer[] = [];

  u32(v: number): void {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(v, 0);
    this.parts.push(b);
  }

  u64(v: number): void {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(v >>> 0, 0);
    b.writeUInt32LE(Math.floor(v / 0x100000000), 4);
    this.parts.push(b);
  }

  str(s: string): void {
    const data = Buffer.from(s, 'utf8');
    this.u64(data.length);
    this.parts.push(data);
  }

  finish(): Buffer {
    return Buffer.concat(this.parts);
  }
}

function buildSyntheticGguf(opts: {
  fileType?: number;
  tensors: Array<{ name: string; type: number; dims?: number[] }>;
}): Buffer {
  const w = new Buf();
  w.u32(0x46554747); // GGUF
  w.u32(3); // version
  w.u64(opts.tensors.length);
  const kvCount = opts.fileType != null ? 1 : 0;
  w.u64(kvCount);

  if (opts.fileType != null) {
    w.str('general.file_type');
    w.u32(4); // UINT32
    w.u32(opts.fileType);
  }

  for (const t of opts.tensors) {
    w.str(t.name);
    const dims = t.dims ?? [64, 64];
    w.u32(dims.length);
    for (const d of dims) w.u64(d);
    w.u32(t.type);
    w.u64(0); // offset
  }

  return w.finish();
}

describe('gguf-preflight', () => {
  it('parses magic, counts, file_type, and tensor histogram', () => {
    const buf = buildSyntheticGguf({
      fileType: 15, // MOSTLY_Q4_K_M
      tensors: [
        { name: 'blk.0.attn_q.weight', type: 6 }, // Q5_0
        { name: 'blk.0.attn_k.weight', type: 6 },
        { name: 'blk.0.attn_v.weight', type: 6 },
        { name: 'output_norm.weight', type: 0 }, // F32
        { name: 'tok_embeddings.weight', type: 12 }, // Q4_K
      ],
    });

    const pre = preflightGguf(buf);
    expect(pre.magic).toBe('GGUF');
    expect(pre.version).toBe(3);
    expect(pre.tensorCount).toBe(5);
    expect(pre.kvCount).toBe(1);
    expect(pre.generalFileType).toBe(15);
    expect(pre.generalFileTypeName).toBe('MOSTLY_Q4_K_M');
    expect(pre.tensorTypeHistogram.q5_0).toBe(3);
    expect(pre.tensorTypeHistogram.f32).toBe(1);
    expect(pre.tensorTypeHistogram.q4_K).toBe(1);
    expect(pre.headerClaimsQ4K).toBe(true);
    expect(pre.tensorsMostlyOther).toBe(true);
    expect(pre.warnings.some((w) => /header claims Q4_K/i.test(w) && /q5_0/i.test(w))).toBe(true);
  });

  it('rejects non-GGUF magic via LlmError', () => {
    expect(() => preflightGguf(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(LlmError);
  });

  it('assertBackendSupportsQuants allows q5_0 on vulkan', () => {
    expect(() => assertBackendSupportsQuants({ q5_0: 10, f32: 2 }, 'vulkan')).not.toThrow();
  });

  it('assertBackendSupportsQuants throws on empty histogram', () => {
    expect(() => assertBackendSupportsQuants({}, 'cpu')).toThrow(LlmError);
    try {
      assertBackendSupportsQuants({}, 'cpu');
    } catch (err) {
      expect(err).toBeInstanceOf(LlmError);
      expect((err as LlmError).code).toBe('MODEL_QUANT_UNSUPPORTED');
    }
  });
});
