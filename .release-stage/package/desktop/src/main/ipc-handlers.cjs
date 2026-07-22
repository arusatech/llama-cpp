/**
 * Electron main-process IPC handlers for llama-cpp desktop sidecar.
 *
 * Usage in your Electron main process (after app.whenReady):
 *   const { registerLlamaDesktopIpc } = require('llama-cpp-pro/desktop/ipc-handlers');
 *   registerLlamaDesktopIpc({ ipcMain, app });
 */

// Require leaf modules directly — do NOT require ./index.cjs here (circular:
// index exports registerLlamaDesktopIpc from this file).
const { probe } = require('./gpu-probe.cjs');
const {
  selectBackend,
  getUserOverride,
  setUserOverride,
} = require('./backend-selector.cjs');
const { createSidecarManager } = require('./sidecar-manager.cjs');
const os = require('os');
const { execSync } = require('child_process');

const CHANNEL_ENSURE = 'llama-desktop:ensure-sidecar';
const CHANNEL_STOP = 'llama-desktop:stop-sidecar';
const CHANNEL_STATUS = 'llama-desktop:sidecar-status';
const CHANNEL_BACKEND = 'llama-desktop:backend-status';
const CHANNEL_OVERRIDE = 'llama-desktop:set-backend-override';
const CHANNEL_GET_OVERRIDE = 'llama-desktop:get-backend-override';
const CHANNEL_MEMORY = 'llama-desktop:memory-snapshot';

/**
 * macOS `os.freemem()` only counts truly free pages and is usually tiny while
 * inactive/purgeable pages are reclaimable. Prefer an "available" estimate so
 * model admission does not falsely reject on Darwin.
 */
function getAvailableSystemBytes(totalBytes) {
  if (process.platform === 'darwin') {
    try {
      const out = execSync('vm_stat', { encoding: 'utf8' });
      const pageSizeMatch = out.match(/page size of\s+(\d+)/i);
      const pageSize = pageSizeMatch ? Number(pageSizeMatch[1]) : 16384;
      const pages = (label) => {
        const m = out.match(new RegExp(`${label}:\\s+([\\d.]+)`, 'i'));
        return m ? Math.floor(Number(m[1].replace(/\./g, '')) * pageSize) : 0;
      };
      const available =
        pages('Pages free') +
        pages('Pages inactive') +
        pages('Pages speculative') +
        pages('Pages purgeable');
      if (available > 0) return Math.min(totalBytes, available);
    } catch {
      /* fall through */
    }
  }

  // Electron/Chromium may expose a better free figure than Node on some OSes.
  try {
    const info = process.getSystemMemoryInfo?.();
    if (info && typeof info.free === 'number' && info.free > 0) {
      // Chromium reports KB
      const chromeFree = info.free * 1024;
      if (chromeFree > os.freemem()) return Math.min(totalBytes, chromeFree);
    }
  } catch {
    /* ignore */
  }

  return os.freemem();
}

function detectBackend(deps) {
  const probeResult = probe(deps);
  const override = getUserOverride(deps);
  const selection = selectBackend(probeResult, override, deps);
  return { probe: probeResult, selection };
}

/**
 * @param {object} opts
 * @param {import('electron').IpcMain} opts.ipcMain
 * @param {import('electron').App} [opts.app]
 * @param {object} [opts.deps] - forwarded to sidecar manager / probe
 */
function registerLlamaDesktopIpc(opts) {
  const ipcMain = opts && opts.ipcMain;
  if (!ipcMain) {
    throw new Error('registerLlamaDesktopIpc requires ipcMain');
  }

  const manager = createSidecarManager(opts && opts.deps);
  let lastSelection = null;

  // Idempotent re-register (Electron hot reload / double whenReady).
  for (const ch of [
    CHANNEL_ENSURE,
    CHANNEL_STOP,
    CHANNEL_STATUS,
    CHANNEL_BACKEND,
    CHANNEL_OVERRIDE,
    CHANNEL_GET_OVERRIDE,
    CHANNEL_MEMORY,
  ]) {
    try {
      ipcMain.removeHandler(ch);
    } catch {
      /* ignore */
    }
  }

  ipcMain.handle(CHANNEL_ENSURE, async (_evt, payload) => {
    const { selection } = detectBackend(opts && opts.deps);
    lastSelection = selection;

    if (selection.type === 'wasm-cpu') {
      return { ok: false, reason: 'wasm-fallback', selection };
    }

    const st = manager.getStatus();
    let result = { ok: true, port: st.port };
    if (!st.running) {
      result = await manager.start({
        modelPath: payload && payload.modelPath,
        modelId: payload && payload.modelId,
        selection,
        n_ctx: payload && payload.n_ctx,
        n_gpu_layers: payload && payload.n_gpu_layers,
        n_threads: payload && payload.n_threads,
        retryCpu: true,
      });
    }

    if (!result.ok) {
      return { ...result, selection };
    }

    const gpuEnabled =
      selection.type === 'sidecar-gpu' || selection.type === 'sidecar-npu';
    return {
      ok: true,
      port: result.port,
      gpuEnabled,
      gpuBackend: selection.gpuBackend,
      reasonNoGpu: gpuEnabled ? undefined : 'Native CPU inference (OpenBLAS / Accelerate)',
      selection,
    };
  });

  ipcMain.handle(CHANNEL_STOP, async () => {
    await manager.stop();
    return { ok: true };
  });

  ipcMain.handle(CHANNEL_STATUS, async () => {
    const st = manager.getStatus();
    return {
      running: st.running,
      port: st.port,
      backend: st.backend,
      variant: st.variant,
      permanentWasmFallback: st.permanentWasmFallback,
    };
  });

  ipcMain.handle(CHANNEL_BACKEND, async () => {
    const detected = detectBackend(opts && opts.deps);
    const st = manager.getStatus();
    return { ...detected, sidecar: st, lastSelection };
  });

  ipcMain.handle(CHANNEL_OVERRIDE, async (_evt, value) => {
    setUserOverride(value, opts && opts.deps);
    return { ok: true };
  });

  ipcMain.handle(CHANNEL_GET_OVERRIDE, async () => {
    const value = getUserOverride(opts && opts.deps);
    return value || 'auto';
  });

  ipcMain.handle(CHANNEL_MEMORY, async () => {
    const totalBytes = os.totalmem();
    const freeBytes = getAvailableSystemBytes(totalBytes);
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usedRatio = totalBytes > 0 ? usedBytes / totalBytes : 0;
    return {
      totalBytes,
      usedBytes,
      freeBytes,
      pressure: usedRatio >= 0.85 ? 'high' : usedRatio >= 0.7 ? 'medium' : 'low',
    };
  });

  if (opts && opts.app) {
    opts.app.on('before-quit', () => {
      manager.stop().catch(() => {});
    });
  }

  return {
    manager,
    channels: {
      CHANNEL_ENSURE,
      CHANNEL_STOP,
      CHANNEL_STATUS,
      CHANNEL_BACKEND,
      CHANNEL_OVERRIDE,
      CHANNEL_GET_OVERRIDE,
      CHANNEL_MEMORY,
    },
  };
}

module.exports = { registerLlamaDesktopIpc };
