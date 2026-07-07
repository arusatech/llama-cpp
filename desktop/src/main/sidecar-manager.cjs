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

function buildSpawnEnv(binaryPath, backendDir, forceCpu, deps) {
  const platform = (deps && deps.platform) || process.platform;
  const env = { ...process.env };

  if (backendDir) {
    if (platform === 'win32') {
      env.PATH = `${backendDir};${env.PATH || ''}`;
    } else {
      env.LD_LIBRARY_PATH = `${backendDir}:${env.LD_LIBRARY_PATH || ''}`;
      env.DYLD_LIBRARY_PATH = `${backendDir}:${env.DYLD_LIBRARY_PATH || ''}`;
    }
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
  const listeners = [];

  function emit() {
    const snap = { ...status };
    for (const fn of listeners) {
      try { fn(snap); } catch (_) { /* ignore */ }
    }
  }

  function buildSpawnArgs(modelPath, port, opts) {
    const args = [
      '--model', modelPath,
      '--host', '127.0.0.1',
      '--port', String(port),
    ];
    if (opts && opts.n_ctx) {
      args.push('--ctx-size', String(opts.n_ctx));
    }
    if (opts && opts.n_threads) {
      args.push('--threads', String(opts.n_threads));
    }
    const ngl = opts && opts.n_gpu_layers;
    if (status.forceCpu || opts?.forceCpu) {
      args.push('--no-gpu');
    } else if (ngl != null && ngl >= 0) {
      args.push('--n-gpu-layers', String(ngl));
    } else if (status.backend && status.backend !== 'cpu') {
      args.push('--n-gpu-layers', '99');
    }
    const backendDir = resolveBackendPluginDir(status.binaryPath || '', deps);
    if (backendDir) {
      args.push('--backend-dir', backendDir);
    }
    return args;
  }

  async function waitForHealth(port) {
    const c = _createClient(port);
    for (let i = 0; i < HEALTH_MAX_ATTEMPTS; i++) {
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
    if (!modelPath) {
      return { ok: false, reason: 'model-path-required' };
    }

    if (status.running && status.port) {
      return { ok: true, port: status.port };
    }

    const gpuBackend = selection && selection.gpuBackend;
    const variant = (selection && selection.variant) || null;
    status.variant = variant;
    status.backend = gpuBackend || (selection && selection.type) || 'cpu';
    status.binaryPath = _resolveBinaryPath({ ...deps, variant, gpuBackend });

    try {
      _fs.accessSync(status.binaryPath);
    } catch (_) {
      _log.warn(`[sidecar-manager] Binary not found: ${status.binaryPath}`);
      status.permanentWasmFallback = true;
      emit();
      return { ok: false, reason: 'binary-missing', path: status.binaryPath };
    }

    const port = options?.port || _getRandomPort();
    const backendDir = resolveBackendPluginDir(status.binaryPath, deps);
    const args = buildSpawnArgs(modelPath, port, options);
    const env = buildSpawnEnv(status.binaryPath, backendDir, status.forceCpu, deps);

    intentionalStop = false;
    accelStderr = '';

    childProcess = _spawn(status.binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env,
    });

    status.pid = childProcess.pid;
    status.port = port;

    childProcess.stderr.on('data', (chunk) => {
      const text = String(chunk);
      accelStderr = (accelStderr + text).slice(-65536);
      if (process.env.LLAMA_SIDECAR_VERBOSE === '1') {
        _log.info('[sidecar]', text.trim());
      }
    });

    childProcess.on('exit', (code) => {
      if (intentionalStop) {
        status.running = false;
        status.pid = null;
        emit();
        return;
      }

      const gpuFail =
        vulkanStderrImpliesGpuFailure(accelStderr)
        || rocmStderrImpliesGpuFailure(accelStderr);

      if (gpuFail && !status.forceCpu && options?.retryCpu !== false) {
        _log.warn('[sidecar-manager] GPU init failed — retrying CPU-only');
        status.forceCpu = true;
        status.restartCount += 1;
        status.running = false;
        emit();
        start({ ...options, forceCpu: true, retryCpu: false }).catch(() => {});
        return;
      }

      if (status.restartCount < MAX_RESTART_ATTEMPTS) {
        status.restartCount += 1;
        _log.warn(`[sidecar-manager] Unexpected exit (${code}), restart ${status.restartCount}`);
        status.running = false;
        emit();
        start(options).catch(() => {});
        return;
      }

      status.permanentWasmFallback = true;
      _log.warn('[sidecar-manager] Max restarts exceeded — WASM fallback');
      status.running = false;
      status.pid = null;
      emit();
    });

    const healthy = await waitForHealth(port);
    if (!healthy) {
      await stop();
      if (!status.forceCpu && options?.retryCpu !== false) {
        status.forceCpu = true;
        return start({ ...options, forceCpu: true, retryCpu: false });
      }
      status.permanentWasmFallback = true;
      emit();
      return { ok: false, reason: 'health-check-failed' };
    }

    client = _createClient(port);
    status.running = true;
    emit();
    return { ok: true, port };
  }

  async function stop() {
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
};
