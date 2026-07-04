/**
 * Copy dist/wasm → annadata-app/public/llama-wasm and verify the JSPI shim patch.
 */
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const srcDir = resolve(root, 'dist', 'wasm');
const appRoot = resolve(root, '..', 'annadata-app');
const destDir = resolve(appRoot, 'public', 'llama-wasm');
const files = ['llama_engine.js', 'llama_engine.wasm', 'llama_engine_emscripten.mjs'];
const SHIM_MARKER = '__wbindgen_add_to_stack_pointer:(d)=>';
const FINALLY_GUARD = 'deferred2_0!=null&&deferred2_0!==0';
const ASYNCIFY_STUB_MIRROR = 'asyncifyStubs[__k]=origExports[__k]';
const CAP_COMMON_INIT = 'cap_wasm_dylink_common_init_from_params';

try {
  await access(appRoot);
} catch {
  console.log('[sync-annadata-app-wasm] Skipped — annadata-app not found at', appRoot);
  process.exit(0);
}

for (const file of files) {
  await access(resolve(srcDir, file));
}

await mkdir(destDir, { recursive: true });
for (const file of files) {
  await copyFile(resolve(srcDir, file), resolve(destDir, file));
}

const mjs = await readFile(resolve(destDir, 'llama_engine_emscripten.mjs'), 'utf8');
const js = await readFile(resolve(destDir, 'llama_engine.js'), 'utf8');
if (!mjs.includes(SHIM_MARKER)) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine_emscripten.mjs is missing the JSPI wasm-bindgen shim.\n` +
      `Run: npm run build:pwa:full`,
  );
  process.exit(1);
}
if (!mjs.includes(FINALLY_GUARD)) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine_emscripten.mjs is missing wasm-bindgen finally dealloc guards.\n` +
      `Run: npm run build:pwa:full`,
  );
  process.exit(1);
}
if (!mjs.includes(ASYNCIFY_STUB_MIRROR)) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine_emscripten.mjs is missing asyncifyStubs origExports mirror.\n` +
      `Run: npm run build:pwa:full`,
  );
  process.exit(1);
}
if (!mjs.includes(CAP_COMMON_INIT)) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine_emscripten.mjs is missing cap_wasm_dylink common_init wire.\n` +
      `Run: npm run build:pwa:full`,
  );
  process.exit(1);
}
if (mjs.includes('_f=asyncifyStubs[')) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine_emscripten.mjs has recursive dylink stub patch — rebuild.\n` +
      `Run: npm run build:pwa:full`,
  );
  process.exit(1);
}
if (!js.includes('ensureMemfsTmp')) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine.js is missing ensureMemfsTmp().\n` +
      `Run: npm run build:pwa:full`,
  );
  process.exit(1);
}
if (!js.includes('patchHeapFS')) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine.js is missing patchHeapFS().\n` +
      `Run: npm run build:pwa:full`,
  );
  process.exit(1);
}
if (!js.includes('jsModelVfsBegin')) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine.js is missing JS-side VFS streaming.\n` +
      `Run: npm run build:pwa:full`,
  );
  process.exit(1);
}
if (!js.includes('preferHeapFsVfs')) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine.js is missing preferHeapFsVfs (BGE embed HeapFS routing).\n` +
      `Run: npm run build:pwa:full`,
  );
  process.exit(1);
}
if (!js.includes('disableAsyncFileEnv')) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine.js is missing disableAsyncFileEnv (HeapFS fread guard).\n` +
      `Run: npm run build:pwa:full`,
  );
  process.exit(1);
}
if (mjs.includes('cap_wasm_set_use_async_file') && js.includes('const LLAMA_WASM_JSPI = false')) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: WASM has async file bridge but llama_engine.js has LLAMA_WASM_JSPI=false.\n` +
      `Run: LLAMA_WASM_JSPI=1 npm run build:pwa:full`,
  );
  process.exit(1);
}
if (!js.includes('wasmHasAsyncFileBridge')) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine.js is missing wasmHasAsyncFileBridge runtime probe.\n` +
      `Run: npm run build:pwa:full`,
  );
  process.exit(1);
}
if (js.includes('opts.n_batch > 8') && js.includes('mode === \'heapfs\'')) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine.js still caps embedding n_batch=8 (BERT encode trap).\n` +
      `Run: npm run build:pwa:full`,
  );
  process.exit(1);
}
if (!js.includes('encBatch')) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine.js is missing BERT encBatch clamp (n_batch=n_ctx).\n` +
      `Run: npm run build:pwa:full`,
  );
  process.exit(1);
}
if (!js.includes('wasmEmbedViaCwrap')) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine.js is missing cwrap embed path.\n` +
      `Run: npm run build:pwa:full`,
  );
  process.exit(1);
}
const syntaxCheck = spawnSync(process.execPath, ['--check', resolve(destDir, 'llama_engine.js')], {
  encoding: 'utf8',
});
if (syntaxCheck.status !== 0) {
  console.error(
    `[sync-annadata-app-wasm] ERROR: ${destDir}/llama_engine.js failed node --check (invalid JS syntax).\n` +
      (syntaxCheck.stderr || syntaxCheck.stdout || '') +
      `\nRegenerate: npm run build:pwa:full`,
  );
  process.exit(1);
}

const wasmBuf = await readFile(resolve(destDir, 'llama_engine.wasm'));
const jsBuf = await readFile(resolve(destDir, 'llama_engine.js'));
const mjsBuf = await readFile(resolve(destDir, 'llama_engine_emscripten.mjs'));
const cacheKey = createHash('sha256')
  .update(wasmBuf)
  .update(jsBuf)
  .update(mjsBuf)
  .digest('hex')
  .slice(0, 12);
await writeFile(
  resolve(destDir, 'version.json'),
  JSON.stringify({ cacheKey, wasmBytes: wasmBuf.byteLength, syncedAt: new Date().toISOString() }, null, 2),
);

console.log(`[sync-annadata-app-wasm] Copied ${files.length} files to ${destDir}`);
console.log(`[sync-annadata-app-wasm] Shim patch verified (${SHIM_MARKER})`);
console.log(`[sync-annadata-app-wasm] cacheKey=${cacheKey} wasmBytes=${wasmBuf.byteLength}`);
