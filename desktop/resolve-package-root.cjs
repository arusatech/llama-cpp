/**
 * Portable resolution of the llama-cpp-pro package root and dev extraResources.
 *
 * Used by host apps (PKC, annadata-app) during co-development (file:../llama-cpp-pro)
 * and after npm publish (require('llama-cpp-pro')).
 */

const path = require('path');
const fs = require('fs');

const SIBLING_DIR = 'llama-cpp-pro';

/**
 * @param {object} [opts]
 * @param {string} [opts.fromDir] - resolve installed package from this directory
 * @param {string} [opts.siblingOf] - fallback: <siblingOf>/../llama-cpp-pro
 * @returns {string}
 */
function resolvePackageRoot(opts = {}) {
  const fromEnv = process.env.LLAMA_CPP_PRO_ROOT;
  if (fromEnv) return path.resolve(fromEnv);

  const fromDir = opts.fromDir || process.cwd();
  try {
    return path.dirname(require.resolve('llama-cpp-pro/package.json', { paths: [fromDir] }));
  } catch {
    /* not installed from this tree yet */
  }

  if (opts.siblingOf) {
    return path.resolve(opts.siblingOf, '..', SIBLING_DIR);
  }

  // Loaded from llama-cpp-pro/desktop/resolve-package-root.cjs
  return path.resolve(__dirname, '..');
}

/**
 * Dev-only extraResources directory (sidecar + wasm staged by stage:desktop).
 * @param {object} [opts] - forwarded to resolvePackageRoot
 * @returns {string}
 */
function getDevExtraResourcesDir(opts = {}) {
  return path.join(resolvePackageRoot(opts), 'extraResources');
}

/**
 * resourcesPath for Electron: packaged → process.resourcesPath; dev → extraResources/.
 * @param {import('electron').App | null | undefined} app
 * @param {object} [opts] - forwarded to resolvePackageRoot (fromDir defaults to app.getAppPath())
 * @returns {string}
 */
function getResourcesPathForApp(app, opts = {}) {
  if (app && app.isPackaged) {
    return process.resourcesPath;
  }
  const resolveOpts = { ...opts };
  if (!resolveOpts.fromDir && app && typeof app.getAppPath === 'function') {
    resolveOpts.fromDir = app.getAppPath();
  }
  return getDevExtraResourcesDir(resolveOpts);
}

/**
 * Ensure a platform sidecar binary exists under resourcesPath (throws with build hint).
 * @param {string} resourcesPath
 * @param {object} [deps] - forwarded to resolveBinaryPath
 * @returns {string}
 */
function assertSidecarBinary(resourcesPath, deps) {
  const { resolveBinaryPath } = require('./src/main/sidecar-manager.cjs');
  const binary = resolveBinaryPath({ ...(deps || {}), resourcesPath });
  const _fs = (deps && deps.fs) || fs;
  if (!_fs.existsSync(binary)) {
    throw new Error(
      `llama-cpp-pro sidecar missing at ${binary}. ` +
        'From llama-cpp-pro run: npm run build:sidecar && npm run stage:desktop',
    );
  }
  return binary;
}

module.exports = {
  resolvePackageRoot,
  getDevExtraResourcesDir,
  getResourcesPathForApp,
  assertSidecarBinary,
};
