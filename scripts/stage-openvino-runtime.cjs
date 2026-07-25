/**
 * Wire OpenVINO into the desktop sidecar build & packaging.
 *
 * Build (when OpenVINO Toolkit is installed):
 *   # Classic path:
 *   set OpenVINO_DIR=C:\Program Files\Intel\openvino_2025\runtime\cmake
 *   # Or winget MSIX 2026.x — auto-detected by build-sidecar-win.bat / this script
 *   scripts\build-sidecar-win.bat openvino
 *
 * This copies the OpenVINO runtime + NPU/GPU plugins (+ TBB) next to the sidecar so
 * ggml-openvino.dll can dlopen them at runtime. If OpenVINO is not installed,
 * the build skips the plugin and the backend selector falls back to Vulkan/CPU.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findMsixOpenVinoRoots() {
  const roots = [];
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-AppxPackage *OpenVINO* | Select-Object -ExpandProperty InstallLocation"',
      { encoding: 'utf8', windowsHide: true, timeout: 15000 },
    );
    for (const line of out.split(/\r?\n/)) {
      const p = line.trim();
      if (p && fs.existsSync(path.join(p, 'runtime', 'cmake', 'OpenVINOConfig.cmake'))) {
        roots.push(p);
      }
    }
  } catch (_) { /* no PowerShell / no package */ }
  // Fallback glob under WindowsApps (may be ACL-restricted)
  try {
    const wa = 'C:\\Program Files\\WindowsApps';
    if (fs.existsSync(wa)) {
      for (const name of fs.readdirSync(wa)) {
        if (!/OpenVINO/i.test(name)) continue;
        const p = path.join(wa, name);
        if (fs.existsSync(path.join(p, 'runtime', 'cmake', 'OpenVINOConfig.cmake'))) {
          roots.push(p);
        }
      }
    }
  } catch (_) { /* ACL */ }
  return roots;
}

function findOpenVinoRoots() {
  const candidates = [
    process.env.OPENVINO_ROOT,
    process.env.INTEL_OPENVINO_DIR,
    process.env.OpenVINO_DIR ? path.resolve(process.env.OpenVINO_DIR, '..', '..') : null,
    'C:\\Program Files\\Intel\\openvino_2026.2.0',
    'C:\\Program Files\\Intel\\openvino_2026',
    'C:\\Program Files\\Intel\\openvino_2025',
    'C:\\Program Files\\Intel\\openvino_2024',
    'C:\\Program Files (x86)\\Intel\\openvino_2025',
    '/opt/intel/openvino_2025',
    '/opt/intel/openvino',
    ...findMsixOpenVinoRoots(),
  ].filter(Boolean);
  // de-dupe, keep order
  const seen = new Set();
  return candidates.filter((p) => {
    const n = path.normalize(p);
    if (seen.has(n)) return false;
    seen.add(n);
    return fs.existsSync(p);
  });
}

function copyDlls(srcDir, destDir, _fs, predicate) {
  const copied = [];
  if (!_fs.existsSync(srcDir)) return copied;
  for (const name of _fs.readdirSync(srcDir)) {
    if (!/\.(dll|so(\.\d+)*)$/i.test(name)) continue;
    if (predicate && !predicate(name)) continue;
    const src = path.join(srcDir, name);
    const dst = path.join(destDir, name);
    try {
      _fs.copyFileSync(src, dst);
      copied.push(name);
    } catch (_) { /* best-effort (WindowsApps ACL, locked file, …) */ }
  }
  return copied;
}

function stageOpenVinoRuntime(destDir, deps = {}) {
  const _fs = deps.fs || fs;
  const roots = (deps.roots || findOpenVinoRoots());
  if (!roots.length) {
    return { ok: false, reason: 'openvino-not-installed' };
  }
  const root = roots[0];
  const binCandidates = [
    path.join(root, 'runtime', 'bin', 'intel64', 'Release'),
    path.join(root, 'runtime', 'bin', 'intel64'),
    path.join(root, 'bin', 'intel64', 'Release'),
  ];
  const binDir = binCandidates.find((p) => _fs.existsSync(p));
  if (!binDir) {
    return { ok: false, reason: 'openvino-bin-missing', root };
  }
  _fs.mkdirSync(destDir, { recursive: true });

  const copied = [];
  copied.push(...copyDlls(binDir, destDir, _fs, (name) =>
    /^openvino/i.test(name) || /npu/i.test(name)));

  // TBB (required by openvino.dll)
  const tbbCandidates = [
    path.join(root, 'runtime', '3rdparty', 'tbb', 'bin'),
    path.join(root, 'runtime', '3rdparty', 'tbb', 'redist', 'intel64', 'vc14'),
    path.join(root, 'runtime', '3rdparty', 'tbb', 'bin', 'intel64', 'vc14'),
  ];
  for (const tbb of tbbCandidates) {
    copied.push(...copyDlls(tbb, destDir, _fs, (name) =>
      /^tbb/i.test(name) && !/_debug\./i.test(name)));
  }

  const cmakeDir = path.join(root, 'runtime', 'cmake');
  return {
    ok: copied.length > 0,
    root,
    binDir,
    cmakeDir: _fs.existsSync(cmakeDir) ? cmakeDir : null,
    copied: [...new Set(copied)],
  };
}

module.exports = {
  findOpenVinoRoots,
  findMsixOpenVinoRoots,
  stageOpenVinoRuntime,
};

if (require.main === module) {
  const dest = process.argv[2] || path.join(__dirname, '..', 'extraResources', 'sidecar', 'openvino-runtime');
  const result = stageOpenVinoRuntime(dest);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
