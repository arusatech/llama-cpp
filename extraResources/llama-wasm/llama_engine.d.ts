/* @ts-self-types="./llama_engine.d.ts" */
/* eslint-disable */
/* tslint:disable */

/**
 * Public API of the llama_engine Wasm module.
 * Consumed by src/workers/wasm.engine.ts.
 */

/** Rust-level engine initialiser — call once after the default export resolves. */
export function init(): void;

/** Load a GGUF model from raw bytes. */
export function load_model(model_id: string, bytes: Uint8Array, opts_json: string): void;

/** Unload a loaded model and free resources. */
export function unload_model(model_id: string): void;

/** Point the active inference handler at a loaded model. */
export function set_active_model(model_id: string): void;

/** Return the active model id. */
export function get_active_model(): string;

/** List resident models as JSON. */
export function list_loaded_models(): string;

/** Run text generation. Returns JSON-serialised GenerateResponse. */
export function generate(model_id: string, req_json: string): string;

/** Streaming generation with per-token callback (JSPI build). */
export function generate_stream(
  model_id: string,
  req_json: string,
  on_token: (token: string, index: number) => void,
): string;

/** Generate text embeddings. Returns JSON-serialised EmbedResponse. */
export function embed(model_id: string, req_json: string): string;

/** Engine health status as a JSON string. */
export function health(): string;

/** Current memory usage as a JSON string. */
export function memory_snapshot(): string;

/** Begin streaming a model into MEMFS. Returns the temp VFS path. */
export function model_vfs_begin(total_bytes?: number, opts_json?: string): string;
/** Append a chunk to an in-progress VFS model write. */
export function model_vfs_write(vfs_path: string, chunk: Uint8Array): void;
/** Abort a partial VFS write and remove the temp file. */
export function model_vfs_abort(vfs_path: string): void;
/** Finish a streamed VFS write and load the model (deletes the VFS file). */
export function load_model_from_vfs(model_id: string, vfs_path: string, opts_json: string): void;
/** Load from an existing VFS path (HeapFS zero-copy mmap). */
export function load_model_from_path(model_id: string, vfs_path: string, opts_json: string): void;
/** Bind JS-side reader for JSPI async load (no full-model WASM heap copy). */
export function async_model_bind(
  vfs_path: string,
  size_bytes: number,
  readFn: (offset: number, length: number) => Uint8Array,
): void;
/** True when this build includes sync external fread (cap-wasm-fs). Does not require native JSPI. */
export function can_use_async_file(): boolean;
/** Raw Emscripten module (for HeapFS helpers). */
export function getEmscriptenModule(): unknown;

/**
 * Default export — loads and instantiates the WebAssembly module.
 * Resolves the .wasm binary relative to import.meta.url when called without arguments.
 */
export default function initWasm(
  pathHint?: string | URL,
): Promise<unknown>;
