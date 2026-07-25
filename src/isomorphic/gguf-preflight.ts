/**
 * Minimal GGUF header / tensor-info preflight for desktop model loads.
 * Parses enough metadata to detect misleading `general.file_type` vs tensor quants.
 */

import { LlmError } from './errors';

export type GgufPreflight = {
  magic: string;
  version: number;
  tensorCount: number;
  kvCount: number;
  generalFileType?: number;
  generalFileTypeName?: string;
  tensorTypeHistogram: Record<string, number>;
  headerClaimsQ4K: boolean;
  tensorsMostlyOther: boolean;
  warnings: string[];
};

const GGUF_MAGIC = 0x46554747; // "GGUF" little-endian

/** ggml_type ordinals from ggml.h */
const GGML_TYPE_NAMES: Record<number, string> = {
  0: 'f32',
  1: 'f16',
  2: 'q4_0',
  3: 'q4_1',
  6: 'q5_0',
  7: 'q5_1',
  8: 'q8_0',
  9: 'q8_1',
  10: 'q2_K',
  11: 'q3_K',
  12: 'q4_K',
  13: 'q5_K',
  14: 'q6_K',
  15: 'q8_K',
  16: 'iq2_xxs',
  17: 'iq2_xs',
  18: 'iq3_xxs',
  19: 'iq1_s',
  20: 'iq4_nl',
  21: 'iq3_s',
  22: 'iq2_s',
  23: 'iq4_xs',
  24: 'i8',
  25: 'i16',
  26: 'i32',
  27: 'i64',
  28: 'f64',
  29: 'iq1_m',
  30: 'bf16',
  34: 'tq1_0',
  35: 'tq2_0',
  39: 'mxfp4',
  40: 'nvfp4',
  41: 'q1_0',
  42: 'q2_0',
};

/** llama_ftype (general.file_type) → human name */
const LLAMA_FTYPE_NAMES: Record<number, string> = {
  0: 'ALL_F32',
  1: 'MOSTLY_F16',
  2: 'MOSTLY_Q4_0',
  3: 'MOSTLY_Q4_1',
  7: 'MOSTLY_Q8_0',
  8: 'MOSTLY_Q5_0',
  9: 'MOSTLY_Q5_1',
  10: 'MOSTLY_Q2_K',
  11: 'MOSTLY_Q3_K_S',
  12: 'MOSTLY_Q3_K_M',
  13: 'MOSTLY_Q3_K_L',
  14: 'MOSTLY_Q4_K_S',
  15: 'MOSTLY_Q4_K_M',
  16: 'MOSTLY_Q5_K_S',
  17: 'MOSTLY_Q5_K_M',
  18: 'MOSTLY_Q6_K',
  19: 'MOSTLY_IQ2_XXS',
  20: 'MOSTLY_IQ2_XS',
  21: 'MOSTLY_Q2_K_S',
  22: 'MOSTLY_IQ3_XS',
  23: 'MOSTLY_IQ3_XXS',
  24: 'MOSTLY_IQ1_S',
  25: 'MOSTLY_IQ4_NL',
  26: 'MOSTLY_IQ3_S',
  27: 'MOSTLY_IQ3_M',
  28: 'MOSTLY_IQ2_S',
  29: 'MOSTLY_IQ2_M',
  30: 'MOSTLY_IQ4_XS',
  31: 'MOSTLY_IQ1_M',
  32: 'MOSTLY_BF16',
  36: 'MOSTLY_TQ1_0',
  37: 'MOSTLY_TQ2_0',
  38: 'MOSTLY_MXFP4_MOE',
  39: 'MOSTLY_NVFP4',
  40: 'MOSTLY_Q1_0',
  41: 'MOSTLY_Q2_0',
  1024: 'GUESSED',
};

const GGUF_TYPE = {
  UINT8: 0,
  INT8: 1,
  UINT16: 2,
  INT16: 3,
  UINT32: 4,
  INT32: 5,
  FLOAT32: 6,
  BOOL: 7,
  STRING: 8,
  ARRAY: 9,
  UINT64: 10,
  INT64: 11,
  FLOAT64: 12,
} as const;

const SCALAR_SIZES: Record<number, number> = {
  [GGUF_TYPE.UINT8]: 1,
  [GGUF_TYPE.INT8]: 1,
  [GGUF_TYPE.UINT16]: 2,
  [GGUF_TYPE.INT16]: 2,
  [GGUF_TYPE.UINT32]: 4,
  [GGUF_TYPE.INT32]: 4,
  [GGUF_TYPE.FLOAT32]: 4,
  [GGUF_TYPE.BOOL]: 1,
  [GGUF_TYPE.UINT64]: 8,
  [GGUF_TYPE.INT64]: 8,
  [GGUF_TYPE.FLOAT64]: 8,
};

class GgufReader {
  private view: DataView;
  private offset = 0;
  private littleEndian = true;

  constructor(bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get remaining(): number {
    return this.view.byteLength - this.offset;
  }

  private need(n: number): void {
    if (this.offset + n > this.view.byteLength) {
      throw new Error(`GGUF truncated: need ${n} bytes at offset ${this.offset}`);
    }
  }

  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return v;
  }

  u64(): number {
    this.need(8);
    const lo = this.view.getUint32(this.offset, this.littleEndian);
    const hi = this.view.getUint32(this.offset + 4, this.littleEndian);
    this.offset += 8;
    // Safe for counts / lengths used in GGUF headers (well under 2^53).
    return hi * 0x100000000 + lo;
  }

  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return v;
  }

  skip(n: number): void {
    this.need(n);
    this.offset += n;
  }

  string(): string {
    const len = this.u64();
    this.need(len);
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, len);
    this.offset += len;
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  /** Skip a GGUF value of the given type (including nested arrays). */
  skipValue(type: number): void {
    if (type === GGUF_TYPE.STRING) {
      const len = this.u64();
      this.skip(len);
      return;
    }
    if (type === GGUF_TYPE.ARRAY) {
      const elemType = this.u32();
      const count = this.u64();
      for (let i = 0; i < count; i++) {
        this.skipValue(elemType);
      }
      return;
    }
    const size = SCALAR_SIZES[type];
    if (size == null) {
      throw new Error(`Unknown GGUF value type ${type}`);
    }
    this.skip(size);
  }

  readScalarNumber(type: number): number | undefined {
    switch (type) {
      case GGUF_TYPE.UINT8:
        this.need(1);
        return this.view.getUint8(this.offset++);
      case GGUF_TYPE.INT8:
        this.need(1);
        return this.view.getInt8(this.offset++);
      case GGUF_TYPE.UINT16:
        this.need(2);
        {
          const v = this.view.getUint16(this.offset, this.littleEndian);
          this.offset += 2;
          return v;
        }
      case GGUF_TYPE.INT16:
        this.need(2);
        {
          const v = this.view.getInt16(this.offset, this.littleEndian);
          this.offset += 2;
          return v;
        }
      case GGUF_TYPE.UINT32:
        return this.u32();
      case GGUF_TYPE.INT32:
        return this.i32();
      case GGUF_TYPE.UINT64:
        return this.u64();
      case GGUF_TYPE.INT64:
        return this.u64();
      case GGUF_TYPE.FLOAT32:
        this.need(4);
        {
          const v = this.view.getFloat32(this.offset, this.littleEndian);
          this.offset += 4;
          return v;
        }
      case GGUF_TYPE.FLOAT64:
        this.need(8);
        {
          const v = this.view.getFloat64(this.offset, this.littleEndian);
          this.offset += 8;
          return v;
        }
      case GGUF_TYPE.BOOL:
        this.need(1);
        return this.view.getUint8(this.offset++);
      default:
        this.skipValue(type);
        return undefined;
    }
  }
}

function toBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return data;
}

function ggmlTypeName(type: number): string {
  return GGML_TYPE_NAMES[type] ?? `type_${type}`;
}

function isWeightQuantName(name: string): boolean {
  // Exclude plain floats / ints typically used for norms / embeddings side-cars.
  return /^(q|iq|tq|mxfp|nvfp)/i.test(name);
}

function dominantWeightQuant(histogram: Record<string, number>): { name: string; count: number } | null {
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of Object.entries(histogram)) {
    if (!isWeightQuantName(name)) continue;
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

/**
 * Parse GGUF header + KV + tensor info (no tensor data).
 */
export function preflightGguf(data: ArrayBuffer | Uint8Array): GgufPreflight {
  const bytes = toBytes(data);
  const r = new GgufReader(bytes);
  const warnings: string[] = [];

  const magicRaw = r.u32();
  if (magicRaw !== GGUF_MAGIC) {
    throw new LlmError(
      'MODEL_QUANT_UNSUPPORTED',
      `Not a GGUF file (magic=0x${magicRaw.toString(16)})`,
      { magic: magicRaw },
    );
  }

  const version = r.u32();
  if (version !== 2 && version !== 3) {
    warnings.push(`Unsupported GGUF version ${version} (parser expects 2 or 3)`);
  }

  const tensorCount = r.u64();
  const kvCount = r.u64();

  let generalFileType: number | undefined;
  for (let i = 0; i < kvCount; i++) {
    const key = r.string();
    const vtype = r.u32();
    if (key === 'general.file_type' && (vtype === GGUF_TYPE.UINT32 || vtype === GGUF_TYPE.INT32)) {
      generalFileType = r.readScalarNumber(vtype);
    } else {
      r.skipValue(vtype);
    }
  }

  const tensorTypeHistogram: Record<string, number> = {};
  for (let i = 0; i < tensorCount; i++) {
    r.string(); // name
    const nDims = r.u32();
    r.skip(nDims * 8); // dims as u64
    const ggmlType = r.u32();
    r.u64(); // data offset
    const name = ggmlTypeName(ggmlType);
    tensorTypeHistogram[name] = (tensorTypeHistogram[name] ?? 0) + 1;
  }

  const generalFileTypeName =
    generalFileType != null ? LLAMA_FTYPE_NAMES[generalFileType] ?? `FTYPE_${generalFileType}` : undefined;

  const headerClaimsQ4K = !!(generalFileTypeName && /Q4_K/i.test(generalFileTypeName));
  const dominant = dominantWeightQuant(tensorTypeHistogram);

  let tensorsMostlyOther = false;
  if (headerClaimsQ4K && dominant && !/^q4_k$/i.test(dominant.name)) {
    tensorsMostlyOther = true;
    warnings.push(
      `GGUF header claims Q4_K but tensor histogram is dominated by ${dominant.name} (${dominant.count} tensors) — header file_type is misleading`,
    );
  }

  return {
    magic: 'GGUF',
    version,
    tensorCount,
    kvCount,
    generalFileType,
    generalFileTypeName,
    tensorTypeHistogram,
    headerClaimsQ4K,
    tensorsMostlyOther,
    warnings,
  };
}

/**
 * Conservative backend/quant gate. Only throws for clearly impossible inputs.
 * Vulkan supports q5_0 — do not reject it.
 */
export function assertBackendSupportsQuants(
  histogram: Record<string, number>,
  _backend: 'cpu' | 'vulkan' | 'openvino' | string,
): void {
  const entries = Object.entries(histogram);
  if (entries.length === 0) {
    throw new LlmError(
      'MODEL_QUANT_UNSUPPORTED',
      'GGUF tensor type histogram is empty — cannot validate quant support',
      { backend: _backend },
    );
  }
  // Intentionally permissive: misleading headers are warnings, not hard failures.
}

const HEADER_READ_BYTES = 16 * 1024 * 1024;

/**
 * Node/Electron: preflight a local GGUF path. Returns null if not readable.
 */
export async function preflightGgufFromPath(filePath: string): Promise<GgufPreflight | null> {
  if (typeof process === 'undefined' || !filePath) return null;
  try {
    const fs = await import('node:fs/promises');
    const fh = await fs.open(filePath, 'r');
    try {
      const stat = await fh.stat();
      const toRead = Math.min(stat.size, HEADER_READ_BYTES);
      const buf = Buffer.allocUnsafe(toRead);
      const { bytesRead } = await fh.read(buf, 0, toRead, 0);
      return preflightGguf(buf.subarray(0, bytesRead));
    } finally {
      await fh.close();
    }
  } catch (err) {
    if (err instanceof LlmError) throw err;
    return null;
  }
}
