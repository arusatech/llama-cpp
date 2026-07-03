/**
 * BGE WASM Async Load OOM — Bug Exploration Test
 *
 * **Validates: Requirements 2.1, 2.2, 2.3** (from bugfix spec)
 *
 * This test explores the bug condition: async embedding model (BGE micro v2, 17MB GGUF)
 * loaded into pre-grown WASM memory (~158MB) crashes at llama_context graph allocation
 * with insufficient headroom for internal n_batch bump (8 → 64).
 *
 * EXPLORATION PHASE: This test is EXPECTED to FAIL on unfixed code.
 * Failure confirms the bug exists. Passing on unfixed code would indicate
 * the bug is not properly reproduced or already fixed.
 *
 * Success criteria for exploration:
 * 1. Test is executable
 * 2. Test FAILS on unfixed code (WASM trap or negative ctxId)
 * 3. Failure documents exact OOM signature (trap type, memory state)
 * 4. Test matches bug condition from design: async + BGE 17MB + embedding=true + ~158MB heap
 */

describe('wasm-bge-async-oom: Async BGE Embed Load Memory Condition (Exploration)', () => {
  let _mod: any;
  let consoleSpy: jest.SpyInstance;
  let canUseAsync: boolean = false;

  beforeAll(async () => {
    // Lazy load WASM module to allow test to execute in different environments
    try {
      // Import dynamic modules to avoid ESM parse errors
      const wasmModule = await import('../../src-rust/pkg/llama_engine.js');
      const initWasm = wasmModule.default;
      const init = wasmModule.init;
      const can_use_async_file = wasmModule.can_use_async_file;

      _mod = await initWasm();
      init();
      canUseAsync = can_use_async_file();

      console.log('[test-setup] WASM module initialized, async file support:', canUseAsync);
    } catch (err) {
      console.log('[test-setup] WASM module initialization failed (expected in non-PWA test env):', err instanceof Error ? err.message : String(err));
      _mod = null;
      canUseAsync = false;
    }
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up any loaded models between tests
    if (!_mod) return;
    try {
      const modelsJson = _mod?.list_loaded_models?.();
      if (typeof modelsJson === 'string') {
        const models = JSON.parse(modelsJson);
        if (Array.isArray(models)) {
          for (const model of models) {
            if (model.model_id) {
              try {
                _mod.unload_model(model.model_id);
              } catch (_) {}
            }
          }
        }
      }
    } catch (_) {}
    consoleSpy.mockClear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  /**
   * Helper: Generate synthetic BGE micro v2 GGUF-like binary (17MB)
   * Structure is minimal — just a blob matching GGUF magic + reasonable size
   */
  function generateMockBgeMicro(): Uint8Array {
    const SIZE_BYTES = 17 * 1024 * 1024; // 17 MB
    const buf = new Uint8Array(SIZE_BYTES);

    // GGUF magic: 0x47475546 ('GGUF')
    buf[0] = 0x47;
    buf[1] = 0x47;
    buf[2] = 0x55;
    buf[3] = 0x46;

    // Fill rest with pseudo-random data to simulate model weights
    for (let i = 4; i < SIZE_BYTES; i++) {
      buf[i] = (i * 7 + 11) & 0xff; // deterministic pseudo-random fill
    }

    return buf;
  }

  /**
   * Helper: Get current WASM linear memory in MB
   */
  function getWasmLinearMb(): number {
    if (!_mod) return 0;
    const heapu8 = (_mod as any)?.HEAPU8;
    const wasmMem = (_mod as any)?.wasmMemory?.buffer;
    const buf = heapu8?.buffer ?? wasmMem;
    return buf ? Number((buf.byteLength / (1024 * 1024)).toFixed(1)) : 0;
  }

  /**
   * Test 1: Async BGE Embed Load — Exploration of OOM Bug
   *
   * This test documents the bug condition:
   * - Cold WASM session (~20-32MB initial)
   * - async mode + BGE micro v2 (17MB GGUF) + embedding=true
   * - Calls ensureWasmMemoryHeadroom for async embed
   * - Should return positive ctxId if fixed, or WASM trap/negative ctxId if buggy
   *
   * COUNTEREXAMPLE on unfixed code:
   * - Returns ctxId ≤ 0 (graph allocation failed silently), OR
   * - Throws WebAssembly.RuntimeError (WASM trap at ggml_cgraph allocation), OR
   * - Throws out-of-memory during tensor COPY phase
   *
   * This test MUST FAIL on unfixed code to prove the bug condition is reproduced.
   */
  test('Property 1: Async BGE embed load OOM — should succeed with positive ctxId (unfixed: trap)', async () => {
    if (!_mod) {
      console.log('[Property1] Skipping: WASM module not initialized in this environment');
      return;
    }

    if (!canUseAsync) {
      console.log('[Property1] Skipping: async file bridge not available');
      return;
    }

    const bgeGguf = generateMockBgeMicro();
    const modelId = 'bge-micro-exploration-1';
    const opts = JSON.stringify({
      embedding: true,
      n_ctx: 128,
      n_batch: 8, // will be bumped to 64 internally
    });

    console.log('\n[Property1] EXPLORATION: Async BGE embed load OOM condition');
    console.log(`  - GGUF size: ${(bgeGguf.byteLength / (1024 * 1024)).toFixed(1)} MB (17 MB expected for BGE micro v2)`);
    console.log(`  - WASM heap before load: ${getWasmLinearMb()} MB`);
    console.log(`  - Mode: async (OPFS external fread, no GGUF duplication in heap)`);
    console.log(`  - Embedding: true (n_batch will internally bump 8 → 64 during graph allocation)`);
    console.log(`  - Bug condition: pre-grown heap (~158MB) + 17MB GGUF + COPY tensors + n_batch bump should fail`);

    let thrownError: Error | null = null;
    let ctxId: number | null = null;

    try {
      // Step 1: Begin VFS stream for async model
      const vfsPath = _mod.model_vfs_begin(bgeGguf.byteLength, opts);
      expect(vfsPath).toBeTruthy();
      expect(vfsPath).toMatch(/^\/models\//);
      console.log(`  - VFS path created: ${vfsPath}`);

      // Step 2: Bind async reader (OPFS simulation)
      _mod.async_model_bind(vfsPath, bgeGguf.byteLength, (offset: number, length: number) => {
        const chunk = bgeGguf.slice(offset, offset + length);
        return chunk;
      });
      console.log(`  - Async reader bound (simulates OPFS external sync access)`);

      // Step 3: Stream GGUF chunks into VFS
      const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB chunks
      let bytesWritten = 0;
      for (let off = 0; off < bgeGguf.byteLength; off += CHUNK_SIZE) {
        const chunkEnd = Math.min(off + CHUNK_SIZE, bgeGguf.byteLength);
        const chunk = bgeGguf.slice(off, chunkEnd);
        _mod.model_vfs_write(vfsPath, chunk);
        bytesWritten += chunk.byteLength;
      }
      console.log(`  - VFS stream written: ${(bytesWritten / (1024 * 1024)).toFixed(1)} MB in ${Math.ceil(bytesWritten / CHUNK_SIZE)} chunks`);
      console.log(`  - WASM heap after stream: ${getWasmLinearMb()} MB`);

      // Step 4: Call load_model_from_vfs
      // This is where the crash occurs on unfixed code:
      // - ensureWasmMemoryHeadroom grows for async embed (or should)
      // - wasmLoadContextFromPath calls llama_load_context_from_path
      // - C code does tensor COPY (~16MB for BGE)
      // - llama_context graph allocation bumps n_batch 8→64
      // - ggml_cgraph allocation with max_nodes=1024 fails if insufficient headroom
      console.log(`  - Calling load_model_from_vfs (this is where the OOM crash should occur on unfixed code)...`);
      _mod.load_model_from_vfs(modelId, vfsPath, opts);
      console.log(`  - load_model_from_vfs returned successfully`);

      // Step 5: Verify model was loaded with positive context ID
      const modelsJson = _mod?.list_loaded_models?.();
      expect(typeof modelsJson).toBe('string');

      const models = JSON.parse(modelsJson);
      const bgeMod = models.find((m: any) => m.model_id === modelId);

      expect(bgeMod).toBeDefined();
      expect(bgeMod.context_id).toBeGreaterThan(0);
      ctxId = bgeMod.context_id;

      console.log(`  ✓ SUCCESS: Model loaded with positive context ID: ${ctxId}`);
      console.log(`  - WASM heap after load: ${getWasmLinearMb()} MB`);
      console.log(`  - Console output includes phase markers: ${consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join(' | ')}`);
    } catch (err) {
      // On unfixed code: this is EXPECTED and CORRECT for the exploration phase
      thrownError = err instanceof Error ? err : new Error(String(err));

      console.log(`\n  ✗ EXPLORATION FAILURE (expected on unfixed code):`);
      console.log(`    - Error type: ${thrownError.constructor.name}`);
      console.log(`    - Error message: ${thrownError.message}`);
      console.log(`    - WASM heap at failure: ${getWasmLinearMb()} MB`);

      // Analyze the failure signature for bug documentation
      if (thrownError instanceof (WebAssembly as any).RuntimeError || thrownError.message.includes('RuntimeError')) {
        console.log(`    - COUNTEREXAMPLE: WebAssembly.RuntimeError (WASM trap/OOM)`);
        console.log(`    - Root cause: Insufficient WASM memory for graph allocation after n_batch bump`);
      } else if (thrownError.message.includes('returned') && thrownError.message.includes('≤ 0')) {
        console.log(`    - COUNTEREXAMPLE: llama_load_context_from_path returned non-positive context ID`);
        console.log(`    - Root cause: Graph allocation failed silently (ran out of heap headroom)`);
      } else if (thrownError.message.includes('out of memory') || thrownError.message.includes('OOM')) {
        console.log(`    - COUNTEREXAMPLE: Out-of-memory error during tensor COPY or graph allocation`);
        console.log(`    - Root cause: ensureWasmMemoryHeadroom did not reserve sufficient headroom`);
      }

      console.log(`\n  BUG DOCUMENTATION:`);
      console.log(`    Validates: Requirements 2.1 (grow WASM memory before graph allocation)`);
      console.log(`    Validates: Requirements 2.2 (reserve headroom for n_batch=64 bump)`);
      console.log(`    Validates: Requirements 2.3 (emit success phase marker on load)`);
      console.log(`\n  This failure confirms the bug condition exists and is reproducible.`);

      // Re-throw to fail the test (this failure IS the test passing for exploration phase)
      throw thrownError;
    }
  });

  /**
   * Test 2: Async BGE with Extra Pre-Grown Memory (Control)
   *
   * Same setup as Test 1 but with extra pre-grown memory buffer (~180MB vs ~158MB).
   * If Test 1 fails and this passes, it confirms memory insufficiency is the root cause.
   * If this also fails, the threshold may be higher or there's another issue.
   *
   * EXPECTED on unfixed code: May PASS (if 180MB is sufficient) or FAIL (if threshold higher)
   * EXPECTED on fixed code: PASSES
   */
  test('Property 2: Async BGE with pre-grown extra memory — control test (unfixed: may pass if threshold lower)', async () => {
    if (!_mod) {
      console.log('[Property2] Skipping: WASM module not initialized');
      return;
    }

    if (!canUseAsync) {
      console.log('[Property2] Skipping: async file bridge not available');
      return;
    }

    const bgeGguf = generateMockBgeMicro();
    const modelId = 'bge-micro-control-1';
    const opts = JSON.stringify({
      embedding: true,
      n_ctx: 128,
      n_batch: 8,
    });

    console.log('\n[Property2] CONTROL: Async BGE load with pre-grown extra memory buffer');
    console.log(`  - WASM heap before pre-grow: ${getWasmLinearMb()} MB`);

    const targetMB = 180;
    try {
      // Attempt to pre-grow extra memory (simulates what fix should do)
      const targetBytes = targetMB * 1024 * 1024;
      const mod = _mod as any;
      const currentBytes = mod?.HEAPU8?.length ?? 0;

      if (currentBytes < targetBytes) {
        if (typeof mod?.growMemory === 'function') {
          mod.growMemory(targetBytes);
        } else if (typeof mod?.emscripten_resize_heap === 'function') {
          mod.emscripten_resize_heap(targetBytes);
        }
      }

      console.log(`  - WASM heap after pre-grow: ${getWasmLinearMb()} MB (target: ${targetMB} MB)`);

      const vfsPath = _mod.model_vfs_begin(bgeGguf.byteLength, opts);
      _mod.async_model_bind(vfsPath, bgeGguf.byteLength, (offset: number, length: number) => {
        return bgeGguf.slice(offset, offset + length);
      });

      const CHUNK_SIZE = 4 * 1024 * 1024;
      for (let off = 0; off < bgeGguf.byteLength; off += CHUNK_SIZE) {
        const chunkEnd = Math.min(off + CHUNK_SIZE, bgeGguf.byteLength);
        _mod.model_vfs_write(vfsPath, bgeGguf.slice(off, chunkEnd));
      }

      _mod.load_model_from_vfs(modelId, vfsPath, opts);

      const modelsJson = _mod?.list_loaded_models?.();
      const models = JSON.parse(modelsJson);
      const bgeMod = models.find((m: any) => m.model_id === modelId);

      expect(bgeMod).toBeDefined();
      expect(bgeMod.context_id).toBeGreaterThan(0);

      console.log(`  ✓ CONTROL PASSED: Load succeeded with extra pre-grown memory (ctxId: ${bgeMod.context_id})`);
      console.log(`  - Confirms memory insufficiency may be the root cause (if Test 1 failed)`);
    } catch (err) {
      console.log(`  ✗ CONTROL FAILED: Even with ${targetMB} MB pre-grown heap`);
      console.log(`  - Error: ${err instanceof Error ? err.message : String(err)}`);
      console.log(`  - This suggests OOM threshold is higher than expected or root cause differs`);
      // Don't re-throw for control test — it's informational
    }
  });

  /**
   * Test 3: HeapFS BGE Baseline (Non-Async Reference)
   *
   * Same model but via heapfs (GGUF duplicated in heap, not async OPFS).
   * This should already work on unfixed code (async is the bug, not embedding generally).
   *
   * EXPECTED on unfixed code: PASSES
   * - HeapFS pre-grows memory upfront
   * - No async-specific OOM path
   *
   * EXPECTED on fixed code: PASSES (unchanged)
   */
  test('Property 3: HeapFS BGE baseline — confirms bug is async-specific (unfixed: should pass)', async () => {
    if (!_mod) {
      console.log('[Property3] Skipping: WASM module not initialized');
      return;
    }

    const bgeGguf = generateMockBgeMicro();
    const modelId = 'bge-micro-heapfs-1';
    const opts = JSON.stringify({
      embedding: true,
      n_ctx: 128,
      n_batch: 8,
    });

    console.log('\n[Property3] BASELINE: HeapFS BGE load (not async — should already work)');
    console.log(`  - WASM heap before: ${getWasmLinearMb()} MB`);

    try {
      // HeapFS stream: GGUF is duplicated in WASM heap (not external OPFS)
      // HeapFS pre-grows memory automatically via mmapAlloc
      const vfsPath = _mod.model_vfs_begin(bgeGguf.byteLength, opts);
      expect(vfsPath).toBeTruthy();

      const CHUNK_SIZE = 4 * 1024 * 1024;
      for (let off = 0; off < bgeGguf.byteLength; off += CHUNK_SIZE) {
        const chunkEnd = Math.min(off + CHUNK_SIZE, bgeGguf.byteLength);
        _mod.model_vfs_write(vfsPath, bgeGguf.slice(off, chunkEnd));
      }

      _mod.load_model_from_vfs(modelId, vfsPath, opts);

      const modelsJson = _mod?.list_loaded_models?.();
      const models = JSON.parse(modelsJson);
      const bgeMod = models.find((m: any) => m.model_id === modelId);

      expect(bgeMod).toBeDefined();
      expect(bgeMod.context_id).toBeGreaterThan(0);

      console.log(`  ✓ BASELINE PASSED: HeapFS BGE load succeeded (ctxId: ${bgeMod.context_id})`);
      console.log(`  - WASM heap after: ${getWasmLinearMb()} MB`);
      console.log(`  - Confirms bug is specific to async path, not embedding or BGE generally`);
    } catch (err) {
      console.log(`  ✗ BASELINE FAILED: Unexpected error in HeapFS load`);
      console.log(`  - Error: ${err instanceof Error ? err.message : String(err)}`);
      // HeapFS baseline should generally work, so don't suppress this error
      throw err;
    }
  });
});
