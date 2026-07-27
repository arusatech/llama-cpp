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
  listBackendOptions,
  backendToVariant,
  variantBinaryExists,
} = require('./backend-selector.cjs');
const { createSidecarManager, resolveBinaryPath } = require('./sidecar-manager.cjs');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

const CHANNEL_ENSURE = 'llama-desktop:ensure-sidecar';
const CHANNEL_STOP = 'llama-desktop:stop-sidecar';
const CHANNEL_STATUS = 'llama-desktop:sidecar-status';
const CHANNEL_BACKEND = 'llama-desktop:backend-status';
const CHANNEL_OVERRIDE = 'llama-desktop:set-backend-override';
const CHANNEL_GET_OVERRIDE = 'llama-desktop:get-backend-override';
const CHANNEL_MEMORY = 'llama-desktop:memory-snapshot';
const CHANNEL_SIDECAR_LOG = 'llama-desktop:sidecar-log';

/** Broadcast a sidecar lifecycle/stderr event to every renderer window. */
function broadcastSidecarEvent(event) {
  try {
    const { webContents } = require('electron');
    for (const wc of webContents.getAllWebContents()) {
      try {
        if (!wc.isDestroyed()) wc.send(CHANNEL_SIDECAR_LOG, event);
      } catch (_) { /* window may be closing */ }
    }
  } catch (_) { /* not running inside Electron (unit tests) */ }
}

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

function withBinaryProbe(deps) {
  const base = deps || {};
  if (typeof base.hasVariantBinary === 'function' || Array.isArray(base.availableVariants)) {
    return base;
  }
  const _fs = base.fs || fs;
  return {
    ...base,
    hasVariantBinary(variant) {
      if (variant == null || variant === 'cpu' || variant === 'openblas') return true;
      try {
        const p = resolveBinaryPath({
          ...base,
          variant,
          gpuBackend: variant === 'openvino' ? 'openvino-cpu' : variant,
        });
        _fs.accessSync(p);
        return true;
      } catch (_) {
        return false;
      }
    },
  };
}

function selectionMatchesRunning(st, selection) {
  if (!st || !st.running || !selection) return false;
  // Stuck on CPU after a GPU crash — never treat as matching a GPU/NPU pick.
  if (st.forceCpu && selection.gpuBackend) return false;
  if (selection.gpuBackend) {
    return st.backend === selection.gpuBackend && !st.forceCpu;
  }
  if (selection.type === 'sidecar-cpu') {
    return st.backend === 'cpu' || st.backend === 'sidecar-cpu' || !!st.forceCpu;
  }
  if (selection.type === 'sidecar-gpu' || selection.type === 'sidecar-npu') {
    // Auto-style types without a concrete gpuBackend — accept any non-cpu accelerator.
    return !!st.backend && st.backend !== 'cpu' && !st.forceCpu;
  }
  return true;
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

  const deps = withBinaryProbe(opts && opts.deps);
  if (typeof deps.onSidecarEvent !== 'function') {
    deps.onSidecarEvent = (event) => {
      const summary = event.type === 'stderr'
        ? `[llama-desktop] sidecar[${event.backend || '?'}] stderr (${(event.text || '').length} chars)`
        : `[llama-desktop] sidecar[${event.backend || event.from || '?'}] ${event.type}`
          + (event.reason ? `: ${event.reason}` : '')
          + (event.code != null ? ` (code ${event.code})` : '');
      if (event.type === 'exit' || event.type === 'fallback') console.warn(summary);
      else console.info(summary);
      broadcastSidecarEvent(event);
    };
  }
  const manager = createSidecarManager(deps);
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
    const { selection } = detectBackend(deps);
    lastSelection = selection;

    const invokeLabel = selection.gpuBackend || selection.type || 'unknown';
    console.info(`[llama-desktop] ensureSidecar → ${invokeLabel}`, {
      type: selection.type,
      gpuBackend: selection.gpuBackend,
      variant: selection.variant,
      reason: selection.reason,
      modelId: payload && payload.modelId,
      embedding: !!(payload && payload.embedding),
    });

    if (selection.type === 'wasm-cpu') {
      console.info('[llama-desktop] backend path = WASM CPU (no sidecar spawn)');
      return { ok: false, reason: 'wasm-fallback', selection };
    }

    let st = manager.getStatus();
    // If a CPU (or other) sidecar is already up but the user asked for Vulkan/etc.,
    // do not reuse it — stop and respawn for the requested selection.
    if (st.running && !selectionMatchesRunning(st, selection)) {
      console.info(
        `[llama-desktop] sidecar backend mismatch (running=${st.backend || 'unknown'}`
          + `${st.forceCpu ? ',forceCpu' : ''} vs want=${invokeLabel}) — restarting`,
      );
      await manager.stop({ resetFallbacks: true });
      st = manager.getStatus();
    }

    let result = { ok: true, port: st.port };
    if (!st.running) {
      console.info(`[llama-desktop] spawning sidecar for ${invokeLabel}`, {
        variant: selection.variant,
      });
      result = await manager.start({
        modelPath: payload && payload.modelPath,
        modelId: payload && payload.modelId,
        selection,
        n_ctx: payload && payload.n_ctx,
        n_gpu_layers: payload && payload.n_gpu_layers,
        n_threads: payload && payload.n_threads,
        retryCpu: true,
      });
    } else {
      console.info(
        `[llama-desktop] reusing sidecar port=${st.port} backend=${st.backend || invokeLabel}`,
      );
    }

    if (!result.ok) {
      console.warn('[llama-desktop] ensureSidecar failed', {
        reason: result.reason,
        selection,
      });
      return { ...result, selection };
    }

    const live = manager.getStatus();
    const gpuEnabled =
      !live.forceCpu
      && (selection.type === 'sidecar-gpu' || selection.type === 'sidecar-npu')
      && live.backend
      && live.backend !== 'cpu';
    console.info(
      `[llama-desktop] ensureSidecar OK → running=${live.backend || invokeLabel}`
        + ` port=${result.port} gpuEnabled=${gpuEnabled}`
        + `${live.forceCpu ? ' (CPU fallback active)' : ''}`,
    );
    return {
      ok: true,
      port: result.port,
      gpuEnabled,
      gpuBackend: live.forceCpu ? null : selection.gpuBackend,
      reasonNoGpu: gpuEnabled
        ? undefined
        : (live.forceCpu
          ? `CPU fallback after ${selection.gpuBackend || 'GPU'} startup failure`
          : (selection.gpuBackend === 'openvino-cpu'
            ? 'OpenVINO CPU inference (GGML_OPENVINO_DEVICE=CPU)'
            : 'Native CPU inference (OpenBLAS / Accelerate)')),
      selection,
      sidecar: {
        backend: live.backend,
        variant: live.variant,
        forceCpu: live.forceCpu,
      },
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
      forceCpu: st.forceCpu,
      permanentWasmFallback: st.permanentWasmFallback,
    };
  });

  ipcMain.handle(CHANNEL_BACKEND, async () => {
    const detected = detectBackend(deps);
    const st = manager.getStatus();
    const options = listBackendOptions(detected.probe, deps);
    return { ...detected, sidecar: st, lastSelection, options };
  });

  ipcMain.handle(CHANNEL_OVERRIDE, async (_evt, value) => {
    console.info(`[llama-desktop] setBackendOverride → ${value}`);
    // Reject selecting a disabled/unavailable backend from Settings.
    const detected = detectBackend(deps);
    const options = listBackendOptions(detected.probe, deps);
    const match = options.find((o) => o.value === value);
    if (value && value !== 'auto' && match && !match.available) {
      console.warn(`[llama-desktop] reject unavailable override ${value}: ${match.reason}`);
      return { ok: false, reason: match.reason || 'backend-unavailable', options };
    }
    setUserOverride(value, deps);
    try {
      await manager.stop({ resetFallbacks: true });
      console.info('[llama-desktop] stopped sidecar after backend override change');
    } catch (err) {
      console.warn('[llama-desktop] stop after override failed', err);
    }
    return { ok: true, options };
  });

  ipcMain.handle(CHANNEL_GET_OVERRIDE, async () => {
    const value = getUserOverride(deps);
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
