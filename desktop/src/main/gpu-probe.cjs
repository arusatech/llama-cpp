/**
 * GPU / NPU backend detection for desktop llama-cpp sidecar.
 * Adapted from ref-code/annadata-vad-dt/src/main/gpu-probe.cjs.
 */

const fs = require('fs');
const path = require('path');

function findLibrary(candidates, _fs) {
  for (const p of candidates) {
    try {
      if (_fs.existsSync(p)) return { found: true, path: p };
    } catch (_) { /* skip */ }
  }
  return { found: false };
}

function versionedCandidates(dirs, base) {
  const suffixes = ['', '.1', '.2', '.530', '.520', '.515', '.510'];
  const out = [];
  for (const d of dirs) {
    for (const s of suffixes) out.push(path.join(d, base + s));
  }
  return out;
}

/** Cached OpenVINO lookup — the MSIX powershell query is slow (~seconds). */
let cachedOpenVino;

/**
 * Locate the OpenVINO runtime and the directories that must be prepended to
 * PATH / LD_LIBRARY_PATH for the openvino sidecar to load (covers winget/MSIX
 * installs under WindowsApps, classic Program Files installs, and runtimes
 * staged next to the sidecar binary).
 *
 * @param {object} [deps]
 * @returns {{ found: boolean, dllPath?: string, binDirs: string[], reason: string }}
 */
function findOpenVinoRuntime(deps) {
  const _fs = (deps && deps.fs) || fs;
  const platform = (deps && deps.platform) || process.platform;
  const cacheable = !(deps && deps.fs);
  if (cacheable && cachedOpenVino !== undefined) return cachedOpenVino;

  let result;
  if (platform === 'win32') {
    const sys32 = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'System32');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const candidates = [
      path.join(sys32, 'openvino.dll'),
      // Staged next to the sidecar by scripts/stage-openvino-runtime.cjs
      path.join(process.env.LLAMA_SIDECAR_DIR || '', 'openvino-runtime', 'openvino.dll'),
      path.join(programFiles, 'Intel', 'openvino_2026', 'runtime', 'bin', 'intel64', 'Release', 'openvino.dll'),
      path.join(programFiles, 'Intel', 'openvino_2025', 'runtime', 'bin', 'intel64', 'Release', 'openvino.dll'),
    ];
    // winget MSIX OpenVINO 2026.x (WindowsApps)
    try {
      const { execSync } = require('child_process');
      const loc = execSync(
        'powershell -NoProfile -Command "Get-AppxPackage *OpenVINO* | Select-Object -ExpandProperty InstallLocation -First 1"',
        { encoding: 'utf8', windowsHide: true, timeout: 8000 },
      ).trim();
      if (loc) {
        candidates.push(path.join(loc, 'runtime', 'bin', 'intel64', 'Release', 'openvino.dll'));
      }
    } catch (_) { /* ignore */ }
    try {
      const res = (deps && deps.resourcesPath) || process.resourcesPath || '';
      if (res) {
        candidates.push(path.join(res, 'sidecar', 'openvino-runtime', 'openvino.dll'));
      }
    } catch (_) { /* ignore */ }

    const hit = findLibrary(candidates.filter(Boolean), _fs);
    if (!hit.found) {
      result = { found: false, binDirs: [], reason: 'OpenVINO runtime not found' };
    } else {
      // Layout: <root>/runtime/bin/intel64/Release/openvino.dll
      // TBB (required) lives at <root>/runtime/3rdparty/tbb/bin.
      const release = path.dirname(hit.path);
      const binDirs = [release];
      const runtime = path.dirname(path.dirname(path.dirname(release)));
      const tbbBin = path.join(runtime, '3rdparty', 'tbb', 'bin');
      try {
        if (_fs.existsSync(tbbBin)) binDirs.push(tbbBin);
      } catch (_) { /* ignore */ }
      result = { found: true, dllPath: hit.path, binDirs, reason: `found ${hit.path}` };
    }
  } else if (platform === 'linux') {
    const libDirs = ['/usr/lib', '/usr/lib64', '/usr/local/lib', '/opt/intel/openvino/runtime/lib/intel64'];
    const hit = findLibrary(versionedCandidates(libDirs, 'libopenvino.so'), _fs);
    result = hit.found
      ? { found: true, dllPath: hit.path, binDirs: [path.dirname(hit.path)], reason: `found ${hit.path}` }
      : { found: false, binDirs: [], reason: 'libopenvino.so not found' };
  } else {
    result = { found: false, binDirs: [], reason: `OpenVINO not probed on ${platform}` };
  }

  if (cacheable) cachedOpenVino = result;
  return result;
}

function probeWindows(_fs) {
  const sys32 = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'System32');
  const backends = [];

  const cuda = findLibrary([path.join(sys32, 'nvcuda.dll')], _fs);
  backends.push({
    name: 'cuda', kind: 'gpu', available: cuda.found,
    reason: cuda.found ? `found ${cuda.path}` : 'nvcuda.dll not found',
  });

  const rocmCandidates = [path.join(sys32, 'amdhip64.dll')];
  const rocm = findLibrary(rocmCandidates, _fs);
  backends.push({
    name: 'rocm', kind: 'gpu', available: rocm.found,
    reason: rocm.found ? `found ${rocm.path}` : 'amdhip64.dll not found',
  });

  const vulkan = findLibrary([path.join(sys32, 'vulkan-1.dll')], _fs);
  backends.push({
    name: 'vulkan', kind: 'gpu', available: vulkan.found,
    reason: vulkan.found ? `found ${vulkan.path}` : 'vulkan-1.dll not found',
  });

  const openvino = findOpenVinoRuntime({ fs: _fs, platform: 'win32' });
  backends.push({
    name: 'openvino-npu', kind: 'npu', available: openvino.found,
    reason: openvino.reason,
  });
  backends.push({
    name: 'openvino-gpu', kind: 'gpu', available: openvino.found,
    reason: openvino.reason,
  });

  return backends;
}

function probeDarwin(_fs) {
  const backends = [];
  backends.push({
    name: 'metal', kind: 'gpu', available: true,
    reason: 'Metal is always available on macOS',
  });
  const coreml = findLibrary([
    '/System/Library/Frameworks/CoreML.framework/CoreML',
  ], _fs);
  backends.push({
    name: 'coreml-npu', kind: 'npu', available: coreml.found,
    reason: coreml.found ? 'CoreML framework found (ANE on Apple Silicon)' : 'CoreML not found',
  });
  return backends;
}

function probeLinux(_fs) {
  const libDirs = [
    '/usr/lib', '/usr/lib64', '/usr/lib/x86_64-linux-gnu',
    '/usr/local/lib', '/usr/local/cuda/lib64', '/opt/rocm/lib',
  ];
  const backends = [];

  const cuda = findLibrary(versionedCandidates(libDirs, 'libcuda.so'), _fs);
  backends.push({
    name: 'cuda', kind: 'gpu', available: cuda.found,
    reason: cuda.found ? `found ${cuda.path}` : 'libcuda.so not found',
  });

  const rocm = findLibrary(versionedCandidates(libDirs, 'libamdhip64.so'), _fs);
  backends.push({
    name: 'rocm', kind: 'gpu', available: rocm.found,
    reason: rocm.found ? `found ${rocm.path}` : 'libamdhip64.so not found',
  });

  const vulkan = findLibrary(versionedCandidates(libDirs, 'libvulkan.so'), _fs);
  backends.push({
    name: 'vulkan', kind: 'gpu', available: vulkan.found,
    reason: vulkan.found ? `found ${vulkan.path}` : 'libvulkan.so not found',
  });

  const openvino = findLibrary(versionedCandidates(libDirs, 'libopenvino.so'), _fs);
  backends.push({
    name: 'openvino-gpu', kind: 'gpu', available: openvino.found,
    reason: openvino.found ? `found ${openvino.path}` : 'libopenvino.so not found',
  });
  backends.push({
    name: 'openvino-npu', kind: 'npu', available: openvino.found,
    reason: openvino.found ? `found ${openvino.path}` : 'OpenVINO not found',
  });

  return backends;
}

function probe(opts) {
  const _platform = (opts && opts.platform) || process.platform;
  const _fs = (opts && opts.fs) || fs;
  let backends = [];

  switch (_platform) {
    case 'win32': backends = probeWindows(_fs); break;
    case 'darwin': backends = probeDarwin(_fs); break;
    case 'linux': backends = probeLinux(_fs); break;
    default: backends = []; break;
  }

  backends.push({
    name: 'cpu', kind: 'cpu', available: true,
    reason: 'CPU fallback is always available',
  });

  return { backends };
}

module.exports = { probe, findOpenVinoRuntime };
