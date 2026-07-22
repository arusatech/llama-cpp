/**
 * Shared model storage paths for desktop (Windows, macOS, Linux).
 * Mirrors ref-code/annadata-vad-dt/src/main/model-store.cjs.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

function getModelsDir(deps) {
  const _platform = (deps && deps.platform) || process.platform;
  const _fs = (deps && deps.fs) || fs;
  const _os = (deps && deps.os) || os;

  let primary;
  switch (_platform) {
    case 'win32':
      primary = path.join(
        process.env.PROGRAMDATA || 'C:\\ProgramData',
        'annadata',
        'llama-cpp',
        'models',
      );
      break;
    case 'darwin':
      primary = '/Users/Shared/annadata/llama-cpp/models';
      break;
    case 'linux':
      primary = '/var/lib/annadata/llama-cpp/models';
      break;
    default:
      primary = path.join(_os.homedir(), 'annadata', 'llama-cpp', 'models');
  }

  const fallback = path.join(_os.homedir(), 'annadata', 'llama-cpp', 'models');

  try {
    _fs.mkdirSync(primary, { recursive: true });
    return primary;
  } catch (_) {
    _fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function getSettingsDir(deps) {
  return path.dirname(getModelsDir(deps));
}

module.exports = { getModelsDir, getSettingsDir };
