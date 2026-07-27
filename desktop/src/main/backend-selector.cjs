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
  // Explicit pins (Settings Active backend dropdown)
  'vulkan',
  'cuda',
  'rocm',
  'metal',
  'openvino-gpu',
  'openvino-cpu',
  'openvino-npu',
];

/** Human labels for Settings / diagnostics. */
const OVERRIDE_LABELS = {
  auto: 'Auto (recommended)',
  vulkan: 'Vulkan GPU',
  cuda: 'CUDA GPU',
  rocm: 'ROCm GPU',
  metal: 'Metal GPU',
  'openvino-gpu': 'OpenVINO GPU',
  'openvino-npu': 'OpenVINO NPU',
  'openvino-cpu': 'OpenVINO CPU',
  'sidecar-gpu': 'Native GPU (best available)',
  'sidecar-npu': 'Native NPU (best available)',
  'sidecar-cpu': 'Native CPU (OpenBLAS)',
  'wasm-cpu': 'WASM CPU',
};

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
  if (userOverride === 'vulkan' || userOverride === 'cuda' || userOverride === 'rocm' || userOverride === 'metal') {
    return {
      type: 'sidecar-gpu',
      gpuBackend: userOverride,
      variant: backendToVariant(userOverride, platform),
      reason: `User selected ${userOverride} GPU`,
    };
  }
  if (userOverride === 'openvino-gpu') {
    return {
      type: 'sidecar-gpu',
      gpuBackend: 'openvino-gpu',
      variant: backendToVariant('openvino-gpu', platform),
      reason: 'User selected OpenVINO GPU',
    };
  }
  if (userOverride === 'openvino-npu') {
    return {
      type: 'sidecar-npu',
      gpuBackend: 'openvino-npu',
      variant: backendToVariant('openvino-npu', platform),
      reason: 'User selected OpenVINO NPU',
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

/**
 * Build Settings dropdown options from hardware probe + optional binary check.
 * Unavailable options stay listed but `available: false` so the UI can disable them.
 *
 * @param {object} probeResult
 * @param {object} [deps]
 * @returns {Array<{ value: string, label: string, available: boolean, reason: string, kind: string }>}
 */
function listBackendOptions(probeResult, deps) {
  const platform = (deps && deps.platform) || process.platform;
  const backends = (probeResult && probeResult.backends) || [];
  const byName = {};
  for (const b of backends) {
    if (b && b.name) byName[b.name] = b;
  }
  const hw = (name) => !!(byName[name] && byName[name].available);
  const hwReason = (name, missing) =>
    (byName[name] && byName[name].reason) || missing;

  const binOk = (variant) => variantBinaryExists(variant, deps);
  const binReason = (variant) =>
    binOk(variant) ? `sidecar binary ${variant} present` : `sidecar binary '${variant}' not packaged`;

  const hasAnyGpu = backends.some((b) => b.kind === 'gpu' && b.available);
  const hasAnyNpu = backends.some((b) => b.kind === 'npu' && b.available);
  const hasOpenvinoRuntime = hw('openvino-gpu') || hw('openvino-npu');

  /** @type {Array<{ value: string, label: string, available: boolean, reason: string, kind: string }>} */
  const options = [
    {
      value: 'auto',
      label: OVERRIDE_LABELS.auto,
      available: true,
      reason: 'Pick best backend for this machine',
      kind: 'auto',
    },
  ];

  const pushHw = (value, probeName, variant, kind) => {
    // Skip platform-irrelevant entries (e.g. Metal on Windows).
    if (platform !== 'darwin' && (value === 'metal' || probeName === 'coreml-npu')) return;
    if (platform === 'darwin' && (value === 'vulkan' || value === 'cuda' || value === 'rocm')) return;

    const hardwareOk = hw(probeName);
    const binaryOk = variant == null ? true : binOk(variant);
    const available = hardwareOk && binaryOk;
    let reason = '';
    if (!hardwareOk) reason = hwReason(probeName, `${probeName} not detected`);
    else if (!binaryOk) reason = binReason(variant);
    else reason = hwReason(probeName, 'available');
    options.push({
      value,
      label: OVERRIDE_LABELS[value] || value,
      available,
      reason,
      kind,
    });
  };

  pushHw('vulkan', 'vulkan', 'vulkan', 'gpu');
  pushHw('cuda', 'cuda', 'cuda', 'gpu');
  pushHw('rocm', 'rocm', 'rocm', 'gpu');
  pushHw('metal', 'metal', 'metal', 'gpu');
  pushHw('openvino-gpu', 'openvino-gpu', 'openvino', 'gpu');
  pushHw('openvino-npu', 'openvino-npu', 'openvino', 'npu');

  {
    const binaryOk = binOk('openvino');
    const available = hasOpenvinoRuntime && binaryOk;
    options.push({
      value: 'openvino-cpu',
      label: OVERRIDE_LABELS['openvino-cpu'],
      available,
      reason: !hasOpenvinoRuntime
        ? 'OpenVINO runtime not detected'
        : !binaryOk
          ? binReason('openvino')
          : 'OpenVINO runtime found (device=CPU)',
      kind: 'cpu',
    });
  }

  options.push({
    value: 'sidecar-gpu',
    label: OVERRIDE_LABELS['sidecar-gpu'],
    available: hasAnyGpu,
    reason: hasAnyGpu ? 'At least one GPU backend detected' : 'No GPU detected',
    kind: 'gpu',
  });
  options.push({
    value: 'sidecar-npu',
    label: OVERRIDE_LABELS['sidecar-npu'],
    available: hasAnyNpu,
    reason: hasAnyNpu ? 'At least one NPU backend detected' : 'No NPU detected',
    kind: 'npu',
  });
  options.push({
    value: 'sidecar-cpu',
    label: OVERRIDE_LABELS['sidecar-cpu'],
    available: true,
    reason: 'Native CPU sidecar always available',
    kind: 'cpu',
  });
  options.push({
    value: 'wasm-cpu',
    label: OVERRIDE_LABELS['wasm-cpu'],
    available: true,
    reason: 'In-process WASM always available',
    kind: 'cpu',
  });

  return options;
}

module.exports = {
  selectBackend,
  getUserOverride,
  setUserOverride,
  findBestBackend,
  getGpuRank,
  backendToVariant,
  variantBinaryExists,
  listBackendOptions,
  OVERRIDE_LABELS,
  NPU_RANK,
  VALID_OVERRIDES,
};
