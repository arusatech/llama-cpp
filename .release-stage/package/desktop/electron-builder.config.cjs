/**
 * electron-builder configuration for apps using llama-cpp-pro on desktop.
 *
 * Merge into your Electron app's package.json:
 *   const llamaDesktop = require('llama-cpp-pro/desktop/electron-builder');
 *   module.exports = { ...yourConfig, ...llamaDesktop.merge(yourConfig) };
 *
 * Or spread extraResources / entitlements manually from this module.
 */

const path = require('path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');

/** @param {string} [root] - llama-cpp-pro package root (default: auto) */
function getSidecarResourceEntries(root = PACKAGE_ROOT) {
  return {
    mac: [
      {
        from: path.join(root, 'extraResources/sidecar/darwin-${arch}'),
        to: 'sidecar/darwin-${arch}',
      },
      {
        from: path.join(root, 'extraResources/sidecar/ggml-plugins/darwin-${arch}'),
        to: 'sidecar/ggml-plugins/darwin-${arch}',
        filter: ['**/*'],
      },
    ],
    win: [
      {
        from: path.join(root, 'extraResources/sidecar/win32-${arch}.exe'),
        to: 'sidecar/win32-${arch}.exe',
      },
      {
        from: path.join(root, 'extraResources/sidecar/win32-${arch}-rocm.exe'),
        to: 'sidecar/win32-${arch}-rocm.exe',
      },
      {
        from: path.join(root, 'extraResources/sidecar/win32-${arch}-cuda.exe'),
        to: 'sidecar/win32-${arch}-cuda.exe',
      },
      {
        from: path.join(root, 'extraResources/sidecar/ggml-plugins/win32-${arch}'),
        to: 'sidecar/ggml-plugins/win32-${arch}',
        filter: ['**/*.dll'],
      },
      {
        from: path.join(root, 'extraResources/sidecar/runtime-libs/win32-${arch}'),
        to: 'sidecar/runtime-libs/win32-${arch}',
        filter: ['**/*.dll'],
      },
    ],
    linux: [
      {
        from: path.join(root, 'extraResources/sidecar/linux-${arch}'),
        to: 'sidecar/linux-${arch}',
      },
      {
        from: path.join(root, 'extraResources/sidecar/linux-${arch}-rocm'),
        to: 'sidecar/linux-${arch}-rocm',
      },
      {
        from: path.join(root, 'extraResources/sidecar/linux-${arch}-cuda'),
        to: 'sidecar/linux-${arch}-cuda',
      },
      {
        from: path.join(root, 'extraResources/sidecar/ggml-plugins/linux-${arch}'),
        to: 'sidecar/ggml-plugins/linux-${arch}',
        filter: ['**/*.so', '**/*.so.*'],
      },
      {
        from: path.join(root, 'extraResources/sidecar/runtime-libs/linux-${arch}'),
        to: 'sidecar/runtime-libs/linux-${arch}',
        filter: ['**/*.so', '**/*.so.*'],
      },
    ],
    wasm: [
      {
        from: path.join(root, 'dist/wasm'),
        to: 'llama-wasm',
        filter: ['**/*'],
      },
    ],
  };
}

/**
 * Recommended electron-builder fragment for llama-cpp desktop support.
 * @param {object} [opts]
 * @param {string} [opts.packageRoot]
 * @returns {object}
 */
function buildConfig(opts = {}) {
  const root = opts.packageRoot || PACKAGE_ROOT;
  const sidecar = getSidecarResourceEntries(root);

  return {
    asar: false,
    mac: {
      entitlements: path.join(root, 'desktop/entitlements.mac.plist'),
      entitlementsInherit: path.join(root, 'desktop/entitlements.mac.plist'),
      hardenedRuntime: true,
      gatekeeperAssess: false,
      extraResources: [...sidecar.mac, ...sidecar.wasm],
    },
    win: {
      extraResources: [...sidecar.win, ...sidecar.wasm],
    },
    linux: {
      extraResources: [...sidecar.linux, ...sidecar.wasm],
    },
    nsis: {
      oneClick: false,
      perMachine: true,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
    },
    deb: {
      depends: ['libvulkan1', 'libgomp1'],
    },
  };
}

/**
 * Deep-merge llama desktop resources into an existing electron-builder config.
 * @param {object} base - your app's electron-builder config
 * @param {object} [opts]
 * @returns {object}
 */
function merge(base = {}, opts = {}) {
  const llama = buildConfig(opts);
  const out = { ...base, ...llama, asar: base.asar ?? llama.asar };

  for (const platform of ['mac', 'win', 'linux']) {
    if (!out[platform]) out[platform] = {};
    const baseExtra = base[platform]?.extraResources ?? [];
    const llamaExtra = llama[platform]?.extraResources ?? [];
    out[platform] = {
      ...llama[platform],
      ...out[platform],
      extraResources: [...baseExtra, ...llamaExtra],
    };
    if (platform === 'mac' && base.mac?.entitlements) {
      out.mac.entitlements = base.mac.entitlements;
    }
  }

  return out;
}

module.exports = {
  buildConfig,
  merge,
  getSidecarResourceEntries,
  entitlementsMac: path.join(PACKAGE_ROOT, 'desktop/entitlements.mac.plist'),
  packageRoot: PACKAGE_ROOT,
};
