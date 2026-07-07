/**
 * Electron preload bridge — exposes annadataLlama API to renderer.
 *
 * Usage in preload script:
 *   require('llama-cpp-capacitor/desktop/preload')(contextBridge, ipcRenderer);
 */

/**
 * @param {import('electron').ContextBridge} contextBridge
 * @param {import('electron').IpcRenderer} ipcRenderer
 */
function installLlamaDesktopPreload(contextBridge, ipcRenderer) {
  const api = {
  ensureSidecar: (opts) => ipcRenderer.invoke('llama-desktop:ensure-sidecar', opts),
  stopSidecar: () => ipcRenderer.invoke('llama-desktop:stop-sidecar'),
  getSidecarStatus: () => ipcRenderer.invoke('llama-desktop:sidecar-status'),
  getBackendStatus: () => ipcRenderer.invoke('llama-desktop:backend-status'),
  setBackendOverride: (value) => ipcRenderer.invoke('llama-desktop:set-backend-override', value),
};

  contextBridge.exposeInMainWorld('annadataLlama', api);
  contextBridge.exposeInMainWorld('__annadataDesktop', true);

  ipcRenderer.invoke('llama-desktop:sidecar-status').then((st) => {
    if (st && st.running && st.port) {
      contextBridge.exposeInMainWorld('__annadataSidecarPort', st.port);
    }
  }).catch(() => {});

  ipcRenderer.on('llama-desktop:sidecar-port', (_evt, port) => {
    if (typeof port === 'number') {
      (globalThis).__annadataSidecarPort = port;
    }
  });
}

module.exports = installLlamaDesktopPreload;
