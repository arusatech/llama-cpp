/**
 * Detect desktop (Electron / Tauri / Node) runtime vs mobile browser.
 */

import type { MemorySnapshot } from './provider.interface';

export function isElectronRuntime(): boolean {
  if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
    return true;
  }
  return false;
}

export function isDesktopRuntime(): boolean {
  if (isElectronRuntime()) return true;
  if (typeof globalThis !== 'undefined' && (globalThis as { __annadataDesktop?: boolean }).__annadataDesktop) {
    return true;
  }
  return false;
}

/** Sidecar HTTP port injected by Electron preload / main process. */
export function getDesktopSidecarPort(): number | null {
  const g = globalThis as { __annadataSidecarPort?: number };
  if (typeof g.__annadataSidecarPort === 'number' && g.__annadataSidecarPort > 0) {
    return g.__annadataSidecarPort;
  }
  if (typeof process !== 'undefined' && process.env.LLAMA_SIDECAR_PORT) {
    const p = parseInt(process.env.LLAMA_SIDECAR_PORT, 10);
    if (!Number.isNaN(p) && p > 0) return p;
  }
  return null;
}

export type DesktopBridge = {
  ensureSidecar: (opts: {
    modelPath?: string;
    modelId?: string;
    host?: string;
    port?: number;
    n_ctx?: number;
    n_gpu_layers?: number;
    n_threads?: number;
    embedding?: boolean;
  }) => Promise<{
    ok: boolean;
    port?: number;
    gpuEnabled?: boolean;
    gpuBackend?: string | null;
    reasonNoGpu?: string;
    reason?: string;
  }>;
  stopSidecar?: () => Promise<void>;
  getSidecarStatus?: () => Promise<{ running: boolean; port?: number | null; backend?: string | null }>;
  getBackendStatus?: () => Promise<Record<string, unknown>>;
  setBackendOverride?: (value: string) => Promise<void>;
  getMemorySnapshot?: () => Promise<MemorySnapshot>;
};

export function getDesktopBridge(): DesktopBridge | null {
  const g = globalThis as { annadataLlama?: DesktopBridge };
  return g.annadataLlama ?? null;
}
