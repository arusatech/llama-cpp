/**
 * Sidecar process lifecycle manager for llama-cpp desktop.
 * Supports NVIDIA (CUDA), AMD (ROCm), Intel (OpenVINO), Apple (Metal), Vulkan, and CPU.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');
const { createSidecarClient } = require('./sidecar-client.cjs');
const { backendToVariant } = require('./backend-selector.cjs');

const MAX_RESTART_ATTEMPTS = 2;
const HEALTH_INTERVAL_MS = 500;
const HEALTH_MAX_ATTEMPTS = 30;
const SHUTDOWN_GRACE_MS = 500;

function getRandomPort() {
  return 18080 + Math.floor(Math.random() * 2000);
}

function vulkanStderrImpliesGpuFailure(buf) {
  if (!buf || buf.length < 12) return false;
  return (
    /VK_ERROR_[A-Z0-9_]+/i.test(buf)
    || (/ggml_vulkan/i.test(buf) && /error|fail/i.test(buf))
    || /Vulkan.*(fail|error)/i.test(buf)
    || /llama_decode:\s*failed to decode/i.test(buf)
  );
}

function rocmStderrImpliesGpuFailure(buf) {
  if (!buf || buf.length < 12) return false;
  return (
    /rocblas\s*error/i.test(buf)
    || /tensilelibrary/i.test(buf)
    || /ROCm error/i.test(buf)
    || /hipblas/i.test(buf)
  );
}

/** Human-readable Windows NTSTATUS / common exit codes for sidecar crashes. */
function describeExitCode(code) {
  if (code == null) return null;
  const u = code < 0 ? code + 0x100000000 : code;
  const known = {
    0xC0000005: 'ACCESS_VIOLATION (native segfault — often Intel iGPU Vulkan during model/embed load)',
    0xC0000135: 'DLL_NOT_FOUND (missing runtime — check OpenVINO/Vulkan PATH)',
    0xC000007B: 'BAD_IMAGE_FORMAT (32/64-bit DLL mismatch)',
    0xC0000409: 'STACK_BUFFER_OVERRUN',
    0xC00000FD: 'STACK_OVERFLOW',
  };
  if (known[u]) return `${known[u]} [0x${u.toString(16).toUpperCase()}]`;
  if (u > 0xC0000000) return `NTSTATUS 0x${u.toString(16).toUpperCase()}`;
  return null;
}

/**
 * Resolve sidecar binary for platform, arch, and GPU backend variant.
 */
function resolveBinaryPath(deps) {
  const platform = (deps && deps.platform) || process.platform;
  const arch = (deps && deps.arch) || process.arch;
  const gpuBackend = (deps && deps.gpuBackend) || null;
  const variant = (deps && deps.variant) || (gpuBackend ? backendToVariant(gpuBackend, platform) : null);
  const resourcesPath = (deps && deps.resourcesPath) || process.resourcesPath;
  const _fs = (deps && deps.fs) || fs;

  const ext = platform === 'win32' ? '.exe' : '';
  const names = [];

  if (variant) {
    names.push(`${platform}-${arch}-${variant}${ext}`);
  }
  if (gpuBackend === 'rocm') {
    names.push(`${platform}-${arch}-rocm${ext}`);
  }
  if (gpuBackend === 'cuda') {
    names.push(`${platform}-${arch}-cuda${ext}`);
  }
  if (gpuBackend === 'vulkan') {
    names.push(`${platform}-${arch}-vulkan${ext}`);
  }
  if (
    gpuBackend === 'openvino'
    || gpuBackend === 'openvino-cpu'
    || gpuBackend === 'openvino-gpu'
    || gpuBackend === 'openvino-npu'
  ) {
    names.push(`${platform}-${arch}-openvino${ext}`);
  }
  names.push(`${platform}-${arch}${ext}`);

  const searchDirs = [];
  if (resourcesPath) {
    searchDirs.push(path.join(resourcesPath, 'sidecar'));
  }
  searchDirs.push(
    path.join(process.cwd(), 'extraResources', 'sidecar'),
    path.join(process.cwd(), 'sidecar', 'bin'),
    path.join(process.cwd(), 'sidecar', 'build', 'bin'),
  );

  for (const dir of searchDirs) {
    for (const name of names) {
      const p = path.join(dir, name);
      try {
        _fs.accessSync(p);
        return p;
      } catch (_) { /* next */ }
    }
  }

  return path.join(searchDirs[0], names[0]);
}

function resolveBackendPluginDir(binaryPath, deps) {
  const platform = (deps && deps.platform) || process.platform;
  const arch = (deps && deps.arch) || process.arch;
  const resourcesPath = (deps && deps.resourcesPath) || process.resourcesPath;
  const _fs = (deps && deps.fs) || fs;

  const candidates = [
    path.join(path.dirname(binaryPath), 'ggml-plugins', `${platform}-${arch}`),
    path.join(path.dirname(binaryPath), 'runtime-libs', `${platform}-${arch}`),
    path.dirname(binaryPath),
  ];
  if (resourcesPath) {
    candidates.unshift(
      path.join(resourcesPath, 'sidecar', 'ggml-plugins', `${platform}-${arch}`),
      path.join(resourcesPath, 'sidecar', 'runtime-libs', `${platform}-${arch}`),
    );
  }

  for (const c of candidates) {
    try {
      if (_fs.existsSync(c)) return c;
    } catch (_) { /* skip */ }
  }
  return path.dirname(binaryPath);
}

/**
 * Stage a CPU-only copy of the sidecar in a clean directory.
 * GGML auto-loads every plugin DLL sitting next to the exe, so a GPU plugin
 * (e.g. ggml-vulkan.dll) in the staging folder makes even --no-gpu runs
 * initialize the GPU and crash on broken drivers. Copying the CPU binary and
 * only its CPU runtime libs into a separate folder guarantees a clean start.
 */
function stageCpuOnlySidecar(deps) {
  const platform = (deps && deps.platform) || process.platform;
  const arch = (deps && deps.arch) || process.arch;
  const _fs = (deps && deps.fs) || fs;

  const srcBin = (deps && deps.binaryPath) || resolveBinaryPath({ ...deps, variant: 'cpu', gpuBackend: null });
  _fs.accessSync(srcBin);
  const srcDir = path.dirname(srcBin);
  const destDir = path.join(os.tmpdir(), 'AcharyaAnnadata', 'sidecar-cpu', `${platform}-${arch}`);
  _fs.mkdirSync(destDir, { recursive: true });

  const wanted = [path.basename(srcBin)];
  for (const name of _fs.readdirSync(srcDir)) {
    if (/vulkan|cuda|rocm|hip|openvino|metal/i.test(name)) continue;
    if (!/\.(dll|so(\.\d+)*|dylib)$/i.test(name)) continue;
    try {
      if (_fs.statSync(path.join(srcDir, name)).isFile()) wanted.push(name);
    } catch (_) { /* skip */ }
  }

  for (const name of wanted) {
    const from = path.join(srcDir, name);
    const to = path.join(destDir, name);
    try {
      const src = _fs.statSync(from);
      let copy = true;
      try {
        copy = _fs.statSync(to).size !== src.size;
      } catch (_) { /* missing — copy */ }
      if (copy) _fs.copyFileSync(from, to);
    } catch (_) { /* best effort */ }
  }

  return path.join(destDir, path.basename(srcBin));
}

function prependLibPath(env, dir, platform) {
  if (!dir) return;
  if (platform === 'win32') {
    env.PATH = `${dir};${env.PATH || ''}`;
  } else {
    env.LD_LIBRARY_PATH = `${dir}:${env.LD_LIBRARY_PATH || ''}`;
    env.DYLD_LIBRARY_PATH = `${dir}:${env.DYLD_LIBRARY_PATH || ''}`;
  }
}

function buildSpawnEnv(binaryPath, backendDir, forceCpu, deps, backendName) {
  const platform = (deps && deps.platform) || process.platform;
  const _fs = (deps && deps.fs) || fs;
  const env = { ...process.env };

  prependLibPath(env, backendDir, platform);

  // OpenVINO redistributables staged next to the sidecar exe
  if (binaryPath && !forceCpu) {
    const ovRuntime = path.join(path.dirname(binaryPath), 'openvino-runtime');
    if (_fs.existsSync(ovRuntime)) {
      prependLibPath(env, ovRuntime, platform);
    }
  }

  // System-installed OpenVINO (incl. winget/MSIX under WindowsApps) — the
  // sidecar can't load openvino.dll unless its bin dirs are on PATH.
  if (!forceCpu && /^openvino/.test(backendName || '')) {
    try {
      const { findOpenVinoRuntime } = require('./gpu-probe.cjs');
      const ov = findOpenVinoRuntime(deps);
      if (ov.found) {
        for (const dir of ov.binDirs) {
          prependLibPath(env, dir, platform);
        }
      }
    } catch (_) { /* probe unavailable — rely on staged runtime */ }
  }

  // ggml-openvino reads GGML_OPENVINO_DEVICE (CPU|GPU|NPU); default in upstream is CPU.
  if (!forceCpu && backendName === 'openvino-npu') {
    env.GGML_OPENVINO_DEVICE = 'NPU';
  } else if (!forceCpu && backendName === 'openvino-gpu') {
    env.GGML_OPENVINO_DEVICE = 'GPU';
  } else if (!forceCpu && backendName === 'openvino-cpu') {
    env.GGML_OPENVINO_DEVICE = 'CPU';
  }

  if (forceCpu) {
    env.LLAMA_NO_GPU = '1';
  }

  return env;
}

function createSidecarManager(deps) {
  const _fs = (deps && deps.fs) || fs;
  const _spawn = (deps && deps.spawn) || spawn;
  const _createClient = (deps && deps.createClient) || createSidecarClient;
  const _resolveBinaryPath = (deps && deps.resolveBinaryPath) || resolveBinaryPath;
  const _getRandomPort = (deps && deps.getRandomPort) || getRandomPort;
  const _log = (deps && deps.log) || console;
  /** Optional observer for sidecar lifecycle/stderr (any backend). */
  const _onEvent = (deps && typeof deps.onSidecarEvent === 'function')
    ? deps.onSidecarEvent
    : null;

  function notify(event) {
    if (!_onEvent) return;
    try {
      _onEvent({ at: new Date().toISOString(), ...event });
    } catch (_) { /* observer errors must not break the manager */ }
  }

  let status = {
    running: false,
    port: null,
    pid: null,
    backend: null,
    variant: null,
    binaryPath: null,
    restartCount: 0,
    permanentWasmFallback: false,
    forceCpu: false,
  };

  let childProcess = null;
  let client = null;
  let intentionalStop = false;
  let accelStderr = '';
  let accelStdout = '';
  const listeners = [];

  function emit() {
    const snap = { ...status };
    for (const fn of listeners) {
      try { fn(snap); } catch (_) { /* ignore */ }
    }
  }

  function buildSpawnArgs(modelPath, port, opts) {
    const args = [
      '--host', '127.0.0.1',
      '--port', String(port),
    ];
    if (modelPath) {
      args.push('--model', modelPath);
      if (opts && opts.modelId) {
        args.push('--model-id', String(opts.modelId));
      }
    }
    if (opts && opts.n_ctx) {
      args.push('--ctx-size', String(opts.n_ctx));
    }
    if (opts && opts.n_threads) {
      args.push('--threads', String(opts.n_threads));
    }
    const ngl = opts && opts.n_gpu_layers;
    const cpuOnly = status.forceCpu || opts?.forceCpu;
    if (cpuOnly) {
      args.push('--no-gpu');
    } else if (ngl != null && ngl >= 0) {
      args.push('--n-gpu-layers', String(ngl));
    } else if (status.backend && status.backend !== 'cpu') {
      args.push('--n-gpu-layers', '99');
    }
    // CPU-only runs must not point at the GPU plugin dir (auto-loads ggml-vulkan).
    if (!cpuOnly) {
      const backendDir = resolveBackendPluginDir(status.binaryPath || '', deps);
      if (backendDir) {
        args.push('--backend-dir', backendDir);
      }
    }
    return args;
  }

  async function waitForHealth(port, maxAttempts = HEALTH_MAX_ATTEMPTS, proc = null) {
    const c = _createClient(port);
    for (let i = 0; i < maxAttempts; i++) {
      // Do not keep waiting after this specific spawn has exited. In particular,
      // this prevents the failed GPU start from later stopping its CPU retry.
      if (proc && proc.exitCode != null) return false;
      try {
        const h = await c.health();
        if (h && h.status === 'ok') return true;
      } catch (_) { /* retry */ }
      await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS));
    }
    return false;
  }

  async function start(options) {
    if (status.permanentWasmFallback) {
      return { ok: false, reason: 'permanent-wasm-fallback' };
    }

    const selection = options && options.selection;
    const modelPath = options && options.modelPath;
    // Explicit GPU/NPU selection clears a sticky CPU fallback from a prior crash,
    // unless this start() call itself requested forceCpu (retry path).
    if (selection && selection.gpuBackend && !(options && options.forceCpu)) {
      if (status.forceCpu) {
        _log.info(
          `[sidecar-manager] clearing sticky forceCpu for explicit selection ${selection.gpuBackend}`,
        );
      }
      status.forceCpu = false;
    }
    const wantForceCpu = !!(status.forceCpu || (options && options.forceCpu));

    if (status.running && status.port) {
      return { ok: true, port: status.port };
    }

    let gpuBackend = selection && selection.gpuBackend;
    let variant = (selection && selection.variant) || null;
    // After a GPU crash, force the CPU binary — not the Vulkan binary with LLAMA_NO_GPU.
    if (wantForceCpu) {
      status.forceCpu = true;
      gpuBackend = null;
      variant = null;
      status.backend = 'cpu';
      status.variant = null;
      // Spawn from a folder without GPU plugin DLLs: GGML auto-loads every
      // plugin next to the exe, so ggml-vulkan.dll would crash CPU runs too.
      try {
        status.binaryPath = stageCpuOnlySidecar(deps);
      } catch (err) {
        _log.warn(`[sidecar-manager] CPU staging failed (${err}); using in-place binary`);
        status.binaryPath = _resolveBinaryPath({ ...deps, variant: 'cpu', gpuBackend: null });
      }
    } else {
      status.variant = variant;
      status.backend = gpuBackend || (selection && selection.type) || 'cpu';
      status.binaryPath = _resolveBinaryPath({ ...deps, variant, gpuBackend });
    }

    try {
      _fs.accessSync(status.binaryPath);
    } catch (_) {
      _log.warn(`[sidecar-manager] Binary not found: ${status.binaryPath}`);
      status.permanentWasmFallback = true;
      emit();
      return { ok: false, reason: 'binary-missing', path: status.binaryPath };
    }

    const port = options?.port || _getRandomPort();
    // CPU mode must not see the GPU plugin dir (PATH/LD_LIBRARY_PATH or --backend-dir).
    const backendDir = status.forceCpu ? null : resolveBackendPluginDir(status.binaryPath, deps);
    const args = buildSpawnArgs(modelPath, port, options);
    const env = buildSpawnEnv(status.binaryPath, backendDir, status.forceCpu, deps, status.backend);

    intentionalStop = false;
    accelStderr = '';
    accelStdout = '';

    _log.info('[sidecar-manager] spawn', {
      backend: status.backend,
      variant: status.variant,
      binaryPath: status.binaryPath,
      forceCpu: status.forceCpu,
      openvinoDevice: env.GGML_OPENVINO_DEVICE || null,
      port,
      args,
    });
    notify({
      type: 'spawn',
      backend: status.backend,
      variant: status.variant,
      binaryPath: status.binaryPath,
      forceCpu: status.forceCpu,
      openvinoDevice: env.GGML_OPENVINO_DEVICE || null,
      port,
    });

    childProcess = _spawn(status.binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env,
    });
    const spawnedProcess = childProcess;
    let startupComplete = false;

    status.pid = childProcess.pid;
    status.port = port;

    // Batch stderr for observers so token-level logs don't flood the app log.
    let stderrBatch = '';
    let stderrTimer = null;
    const spawnBackend = status.backend;
    const flushStderrBatch = () => {
      stderrTimer = null;
      if (!stderrBatch) return;
      const text = stderrBatch.slice(-8192);
      stderrBatch = '';
      notify({ type: 'stderr', backend: spawnBackend, text });
    };
    const queueStderr = (text) => {
      if (!_onEvent) return;
      stderrBatch += text;
      if (!stderrTimer) stderrTimer = setTimeout(flushStderrBatch, 1500);
    };

    // Drain stdout — leaving the pipe unread can deadlock the child when the
    // OS pipe buffer fills. Keep a rolling tail for failure diagnostics.
    childProcess.stdout.on('data', (chunk) => {
      const text = String(chunk);
      accelStdout = (accelStdout + text).slice(-65536);
      if (process.env.LLAMA_SIDECAR_VERBOSE === '1') {
        _log.info('[sidecar:stdout]', text.trim());
      }
    });

    childProcess.stderr.on('data', (chunk) => {
      const text = String(chunk);
      accelStderr = (accelStderr + text).slice(-65536);
      queueStderr(text);
      if (process.env.LLAMA_SIDECAR_VERBOSE === '1') {
        _log.info('[sidecar]', text.trim());
      }
    });

    spawnedProcess.on('exit', (code) => {
      if (stderrTimer) clearTimeout(stderrTimer);
      flushStderrBatch();

      if (intentionalStop) {
        status.running = false;
        status.pid = null;
        emit();
        return;
      }

      const gpuFail =
        vulkanStderrImpliesGpuFailure(accelStderr)
        || rocmStderrImpliesGpuFailure(accelStderr);
      const usingGpu = !status.forceCpu && status.backend && status.backend !== 'cpu';

      // During startup, the awaiting start() call owns fallback/retry. Starting
      // CPU here races the GPU health timer, which would later call stop() and
      // kill the healthy CPU child.
      if (!startupComplete) {
        _log.warn(
          `[sidecar-manager] Startup exit (${code})${usingGpu ? ` on ${status.backend}` : ''}`,
        );
        notify({
          type: 'exit',
          backend: spawnBackend,
          code,
          exitCodeLabel: describeExitCode(code),
          reason: gpuFail ? 'gpu-init-failed' : 'startup-exit',
          stderrTail: accelStderr.slice(-4000),
        });
        status.running = false;
        status.pid = null;
        emit();
        return;
      }

      // Any unexpected exit while on a GPU backend → switch to the CPU binary once.
      if (usingGpu && options?.retryCpu !== false) {
        _log.warn(
          `[sidecar-manager] ${gpuFail ? 'GPU init failed' : `Unexpected exit (${code}) on ${status.backend}`} — retrying CPU-only`,
        );
        notify({
          type: 'exit',
          backend: spawnBackend,
          code,
          exitCodeLabel: describeExitCode(code),
          reason: gpuFail ? 'gpu-init-failed' : 'unexpected-exit',
          stderrTail: accelStderr.slice(-4000),
        });
        notify({
          type: 'fallback',
          from: spawnBackend,
          to: 'cpu',
          reason: `CPU after ${status.backend || 'gpu'} failure (${code}${describeExitCode(code) ? `; ${describeExitCode(code)}` : ''})`,
        });
        status.forceCpu = true;
        status.restartCount += 1;
        status.running = false;
        status.pid = null;
        emit();
        start({
          ...options,
          forceCpu: true,
          retryCpu: false,
          selection: {
            type: 'sidecar-cpu',
            gpuBackend: null,
            variant: null,
            reason: `CPU after ${status.backend || 'gpu'} failure (${code})`,
          },
        }).catch(() => {});
        return;
      }

      if (status.restartCount < MAX_RESTART_ATTEMPTS) {
        status.restartCount += 1;
        _log.warn(`[sidecar-manager] Unexpected exit (${code}), restart ${status.restartCount}`);
        notify({
          type: 'exit',
          backend: spawnBackend,
          code,
          exitCodeLabel: describeExitCode(code),
          reason: `unexpected-exit (restart ${status.restartCount})`,
          stderrTail: accelStderr.slice(-4000),
        });
        status.running = false;
        emit();
        start(options).catch(() => {});
        return;
      }

      status.permanentWasmFallback = true;
      _log.warn('[sidecar-manager] Max restarts exceeded — WASM fallback');
      notify({
        type: 'fallback',
        from: spawnBackend,
        to: 'wasm-cpu',
        reason: `Max restarts exceeded after exit (${code}${describeExitCode(code) ? `; ${describeExitCode(code)}` : ''})`,
        stderrTail: accelStderr.slice(-4000),
      });
      status.running = false;
      status.pid = null;
      emit();
    });

    // CPU model load + warmup can exceed 15 seconds even for a ~100 MB model.
    const healthAttempts = wantForceCpu ? 240 : HEALTH_MAX_ATTEMPTS; // 120s CPU, 15s GPU
    const healthy = await waitForHealth(port, healthAttempts, spawnedProcess);
    if (!healthy) {
      // Only stop this spawn. A newer retry must never be killed by an older
      // start attempt finishing late.
      if (childProcess === spawnedProcess) await stop();
      if (!status.forceCpu && options?.retryCpu !== false) {
        status.forceCpu = true;
        notify({
          type: 'fallback',
          from: spawnBackend,
          to: 'cpu',
          reason: 'CPU fallback after GPU startup failure (health check failed)',
          stderrTail: accelStderr.slice(-4000),
        });
        return start({
          ...options,
          forceCpu: true,
          retryCpu: false,
          selection: {
            type: 'sidecar-cpu',
            gpuBackend: null,
            variant: null,
            reason: 'CPU fallback after GPU startup failure',
          },
        });
      }
      status.permanentWasmFallback = true;
      emit();
      notify({
        type: 'fallback',
        from: spawnBackend,
        to: 'wasm-cpu',
        reason: spawnedProcess.exitCode != null ? 'sidecar-exited-during-startup' : 'health-check-failed',
        stderrTail: accelStderr.slice(-4000),
      });
      return {
        ok: false,
        reason: spawnedProcess.exitCode != null ? 'sidecar-exited-during-startup' : 'health-check-failed',
        exitCode: spawnedProcess.exitCode,
        stderr: accelStderr.slice(-4000),
        stdout: accelStdout.slice(-4000),
      };
    }

    startupComplete = true;
    client = _createClient(port);
    status.running = true;
    emit();
    notify({ type: 'healthy', backend: spawnBackend, port, pid: status.pid });
    return { ok: true, port };
  }

  async function stop(options) {
    intentionalStop = true;
    if (childProcess && !childProcess.killed) {
      childProcess.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, SHUTDOWN_GRACE_MS));
      if (!childProcess.killed) childProcess.kill('SIGKILL');
    }
    childProcess = null;
    client = null;
    status.running = false;
    status.port = null;
    status.pid = null;
    // User override / explicit restart must be allowed to try GPU again.
    if (options && options.resetFallbacks) {
      status.forceCpu = false;
      status.permanentWasmFallback = false;
      status.restartCount = 0;
      status.backend = null;
      status.variant = null;
      status.binaryPath = null;
      _log.info('[sidecar-manager] stop — fallbacks cleared (ready for new backend selection)');
    }
    emit();
  }

  function getClient() {
    return client;
  }

  function getStatus() {
    return { ...status };
  }

  function onStatusChange(fn) {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  return {
    start, stop, getClient, getStatus, onStatusChange, resolveBinaryPath,
  };
}

module.exports = {
  createSidecarManager,
  resolveBinaryPath,
  resolveBackendPluginDir,
  getRandomPort,
  stageCpuOnlySidecar,
};
