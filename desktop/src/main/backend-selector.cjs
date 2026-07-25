/**
 * Backend ranking and selection for desktop llama-cpp.
 * Adapted from ref-code/annadata-vad-dt/src/main/backend-selector.cjs.
 */

const fs = require('fs');
const path = require('path');
const { getSettingsDir } = require('./model-store.cjs');

const NPU_RANK = ['coreml-npu', 'openvino-npu'];
const VALID_OVERRIDES = [
  'auto',
  'sidecar-npu',
  'sidecar-gpu',
  'sidecar-cpu',
  'wasm-cpu',
  // Explicit pins for Settings testing
  'vulkan',
  'openvino-cpu',
];

function getGpuRank(platform = process.platform) {
  if (platform === 'darwin') {
    return ['metal', 'cuda', 'rocm', 'openvino-gpu', 'vulkan'];
  }
  return ['vulkan', 'cuda', 'rocm', 'openvino-gpu'];
}

function getSettingsPath(deps) {
  return path.join(getSettingsDir(deps), 'settings.json');
}

function getUserOverride(deps) {
  const _fs = (deps && deps.fs) || fs;
  try {
    const raw = _fs.readFileSync(getSettingsPath(deps), 'utf8');
    const data = JSON.parse(raw);
    const value = data && data.backendOverride;
    if (!value || value === 'auto') return null;
    if (VALID_OVERRIDES.includes(value)) return value;
    return null;
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    return null;
  }
}

function setUserOverride(backend, deps) {
  const _fs = (deps && deps.fs) || fs;
  const settingsPath = getSettingsPath(deps);
  let data = {};
  try {
    data = JSON.parse(_fs.readFileSync(settingsPath, 'utf8'));
  } catch (_) { /* new file */ }
  data.backendOverride = backend;
  _fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  _fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Whether a sidecar variant binary is considered available.
 * Prefer deps.hasVariantBinary(variant) or deps.availableVariants (string[]) for tests /
 * packaging. Without those, all variants are treated as available (caller resolves the path).
 * @param {string|null} variant
 * @param {object} [deps]
 * @returns {boolean}
 */
function variantBinaryExists(variant, deps) {
  if (variant == null || variant === 'cpu' || variant === 'openblas') return true;
  if (deps && typeof deps.hasVariantBinary === 'function') {
    try {
      return !!deps.hasVariantBinary(variant);
    } catch (_) {
      return false;
    }
  }
  if (deps && Array.isArray(deps.availableVariants)) {
    return deps.availableVariants.includes(variant);
  }
  return true;
}

function findBestBackend(probeResult, rank, deps) {
  const platform = (deps && deps.platform) || process.platform;
  for (const name of rank) {
    const b = probeResult.backends.find((x) => x.name === name && x.available);
    if (!b) continue;
    const variant = backendToVariant(name, platform);
    if (!variantBinaryExists(variant, deps)) continue;
    return name;
  }
  return null;
}

/**
 * Map detected GPU backend name to sidecar binary variant suffix.
 * @param {string|null} gpuBackend
 * @param {NodeJS.Platform} platform
 * @returns {string}
 */
function backendToVariant(gpuBackend, platform) {
  if (platform === 'darwin') {
    if (gpuBackend === 'coreml-npu') return 'metal-coreml';
    return 'metal';
  }
  switch (gpuBackend) {
    case 'cuda': return 'cuda';
    case 'rocm': return 'rocm';
    case 'vulkan': return 'vulkan';
    case 'openvino-gpu':
    case 'openvino-npu':
    case 'openvino-cpu': return 'openvino';
    default: return 'vulkan-openblas';
  }
}

function selectBackend(probeResult, userOverride, deps) {
  const platform = (deps && deps.platform) || process.platform;
  const gpuRank = getGpuRank(platform);

  if (userOverride === 'wasm-cpu') {
    return { type: 'wasm-cpu', gpuBackend: null, variant: null, reason: 'User selected WASM CPU' };
  }
  if (userOverride === 'vulkan') {
    return {
      type: 'sidecar-gpu',
      gpuBackend: 'vulkan',
      variant: backendToVariant('vulkan', platform),
      reason: 'User selected Vulkan GPU',
    };
  }
  if (userOverride === 'openvino-cpu') {
    return {
      type: 'sidecar-cpu',
      gpuBackend: 'openvino-cpu',
      variant: backendToVariant('openvino-cpu', platform),
      reason: 'User selected OpenVINO CPU (GGML_OPENVINO_DEVICE=CPU)',
    };
  }
  if (userOverride === 'sidecar-cpu') {
    return { type: 'sidecar-cpu', gpuBackend: null, variant: 'cpu', reason: 'User selected native CPU' };
  }
  if (userOverride === 'sidecar-gpu') {
    const bestGpu = findBestBackend(probeResult, gpuRank, deps);
    if (bestGpu) {
      return {
        type: 'sidecar-gpu', gpuBackend: bestGpu, variant: backendToVariant(bestGpu, platform),
        reason: `User GPU override: ${bestGpu}`,
      };
    }
    return { type: 'wasm-cpu', gpuBackend: null, variant: null, reason: 'No GPU detected' };
  }
  if (userOverride === 'sidecar-npu') {
    const bestNpu = findBestBackend(probeResult, NPU_RANK, deps);
    if (bestNpu) {
      return {
        type: 'sidecar-npu', gpuBackend: bestNpu, variant: backendToVariant(bestNpu, platform),
        reason: `User NPU override: ${bestNpu}`,
      };
    }
  }

  // Auto: on darwin prefer CoreML NPU first; on win/linux prefer GPU before OpenVINO NPU
  // (OpenVINO sidecar is opt-in — often absent even when the runtime probes present).
  const tryNpu = () => {
    const bestNpu = findBestBackend(probeResult, NPU_RANK, deps);
    if (!bestNpu) return null;
    return {
      type: 'sidecar-npu', gpuBackend: bestNpu, variant: backendToVariant(bestNpu, platform),
      reason: `Auto-selected NPU: ${bestNpu}`,
    };
  };
  const tryGpu = () => {
    const bestGpu = findBestBackend(probeResult, gpuRank, deps);
    if (!bestGpu) return null;
    return {
      type: 'sidecar-gpu', gpuBackend: bestGpu, variant: backendToVariant(bestGpu, platform),
      reason: `Auto-selected GPU: ${bestGpu}`,
    };
  };

  if (platform === 'darwin') {
    const npu = tryNpu();
    if (npu) return npu;
    const gpu = tryGpu();
    if (gpu) return gpu;
  } else {
    const gpu = tryGpu();
    if (gpu) return gpu;
    const npu = tryNpu();
    if (npu) return npu;
  }

  if (platform !== 'darwin') {
    return {
      type: 'sidecar-cpu', gpuBackend: null, variant: 'openblas',
      reason: 'No accelerator detected — native CPU sidecar',
    };
  }

  return {
    type: 'wasm-cpu', gpuBackend: null, variant: null,
    reason: 'No accelerator on macOS — WASM fallback (or set sidecar-cpu override)',
  };
}

module.exports = {
  selectBackend,
  getUserOverride,
  setUserOverride,
  findBestBackend,
  getGpuRank,
  backendToVariant,
  variantBinaryExists,
  NPU_RANK,
  VALID_OVERRIDES,
};
