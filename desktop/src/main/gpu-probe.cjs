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

function probeWindows(_fs) {
  const sys32 = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'System32');
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
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

  const openvinoCandidates = [
    path.join(sys32, 'openvino.dll'),
    // Staged next to the sidecar by scripts/stage-openvino-runtime.cjs
    path.join(process.env.LLAMA_SIDECAR_DIR || '', 'openvino-runtime', 'openvino.dll'),
    path.join(programFiles, 'Intel', 'openvino_2026', 'runtime', 'bin', 'intel64', 'Release', 'openvino.dll'),
    path.join(programFiles, 'Intel', 'openvino_2025', 'runtime', 'bin', 'intel64', 'Release', 'openvino.dll'),
  ];
  // winget MSIX OpenVINO 2026.x
  try {
    const { execSync } = require('child_process');
    const loc = execSync(
      'powershell -NoProfile -Command "Get-AppxPackage *OpenVINO* | Select-Object -ExpandProperty InstallLocation -First 1"',
      { encoding: 'utf8', windowsHide: true, timeout: 8000 },
    ).trim();
    if (loc) {
      openvinoCandidates.push(path.join(loc, 'runtime', 'bin', 'intel64', 'Release', 'openvino.dll'));
    }
  } catch (_) { /* ignore */ }
  // Also check relative to this module's packaged resources
  try {
    const res = process.resourcesPath || '';
    if (res) {
      openvinoCandidates.push(path.join(res, 'sidecar', 'openvino-runtime', 'openvino.dll'));
    }
  } catch (_) { /* ignore */ }
  const openvino = findLibrary(openvinoCandidates.filter(Boolean), _fs);
  backends.push({
    name: 'openvino-npu', kind: 'npu', available: openvino.found,
    reason: openvino.found ? `found ${openvino.path}` : 'OpenVINO runtime not found',
  });
  backends.push({
    name: 'openvino-gpu', kind: 'gpu', available: openvino.found,
    reason: openvino.found ? `found ${openvino.path}` : 'OpenVINO runtime not found',
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

module.exports = { probe };
