/**
 * Desktop runtime entry — GPU probe, backend selection, sidecar lifecycle.
 *
 * Usage (Electron main process):
 *   const desktop = require('llama-cpp-capacitor/desktop');
 *   const probe = desktop.probeGpu();
 *   const selection = desktop.selectBackend(probe);
 *   const manager = desktop.createSidecarManager();
 *   await manager.start({ modelPath: '/path/to/model.gguf', selection });
 */

const { probe } = require('./gpu-probe.cjs');
const {
  selectBackend,
  getUserOverride,
  setUserOverride,
} = require('./backend-selector.cjs');
const { createSidecarManager, resolveBinaryPath } = require('./sidecar-manager.cjs');
const { createSidecarClient } = require('./sidecar-client.cjs');
const { getModelsDir, getSettingsDir } = require('./model-store.cjs');

/**
 * Full desktop bootstrap: probe hardware, read user settings, select backend.
 * @param {object} [deps]
 * @returns {{ probe: object, selection: object }}
 */
function detectBackend(deps) {
  const probeResult = probe(deps);
  const override = getUserOverride(deps);
  const selection = selectBackend(probeResult, override, deps);
  return { probe: probeResult, selection };
}

module.exports = {
  probeGpu: probe,
  selectBackend,
  getUserOverride,
  setUserOverride,
  detectBackend,
  createSidecarManager,
  createSidecarClient,
  resolveBinaryPath,
  getModelsDir,
  getSettingsDir,
  registerLlamaDesktopIpc: require('./ipc-handlers.cjs').registerLlamaDesktopIpc,
  installPreload: require('./preload.cjs'),
  electronBuilder: require('../electron-builder.config.cjs'),
};
