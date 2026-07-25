/** @jest-environment node */

const {
  selectBackend,
  backendToVariant,
  variantBinaryExists,
} = require('../../../desktop/src/main/backend-selector.cjs');

const probeWithVulkan = {
  backends: [
    { name: 'vulkan', kind: 'gpu', available: true },
    { name: 'cpu', kind: 'cpu', available: true },
  ],
};

const probeCpuOnly = {
  backends: [{ name: 'cpu', kind: 'cpu', available: true }],
};

const probeVulkanAndOpenvinoNpu = {
  backends: [
    { name: 'vulkan', kind: 'gpu', available: true },
    { name: 'openvino-npu', kind: 'npu', available: true },
    { name: 'cpu', kind: 'cpu', available: true },
  ],
};

const probeOpenvinoNpuOnly = {
  backends: [
    { name: 'openvino-npu', kind: 'npu', available: true },
    { name: 'cpu', kind: 'cpu', available: true },
  ],
};

describe('desktop backend-selector', () => {
  it('prefers Vulkan on Linux when available', () => {
    const sel = selectBackend(probeWithVulkan, null, { platform: 'linux' });
    expect(sel.type).toBe('sidecar-gpu');
    expect(sel.gpuBackend).toBe('vulkan');
    expect(sel.variant).toBe('vulkan');
  });

  it('falls back to native CPU on Linux without GPU', () => {
    const sel = selectBackend(probeCpuOnly, null, { platform: 'linux' });
    expect(sel.type).toBe('sidecar-cpu');
    expect(sel.variant).toBe('openblas');
  });

  it('honours wasm-cpu override', () => {
    const sel = selectBackend(probeWithVulkan, 'wasm-cpu', { platform: 'linux' });
    expect(sel.type).toBe('wasm-cpu');
  });

  it('honours vulkan override', () => {
    const sel = selectBackend(probeCpuOnly, 'vulkan', { platform: 'win32' });
    expect(sel.type).toBe('sidecar-gpu');
    expect(sel.gpuBackend).toBe('vulkan');
    expect(sel.variant).toBe('vulkan');
  });

  it('honours openvino-cpu override', () => {
    const sel = selectBackend(probeWithVulkan, 'openvino-cpu', { platform: 'win32' });
    expect(sel.type).toBe('sidecar-cpu');
    expect(sel.gpuBackend).toBe('openvino-cpu');
    expect(sel.variant).toBe('openvino');
  });

  it('maps CUDA / ROCm / Metal / OpenVINO to real variants', () => {
    expect(backendToVariant('cuda', 'win32')).toBe('cuda');
    expect(backendToVariant('rocm', 'linux')).toBe('rocm');
    expect(backendToVariant('metal', 'darwin')).toBe('metal');
    expect(backendToVariant('openvino-gpu', 'win32')).toBe('openvino');
    expect(backendToVariant('openvino-npu', 'linux')).toBe('openvino');
    expect(backendToVariant('openvino-cpu', 'win32')).toBe('openvino');
    expect(backendToVariant('coreml-npu', 'darwin')).toBe('metal-coreml');
  });

  it('auto-prefers GPU over OpenVINO NPU on Windows/Linux', () => {
    const sel = selectBackend(probeVulkanAndOpenvinoNpu, null, { platform: 'win32' });
    expect(sel.type).toBe('sidecar-gpu');
    expect(sel.gpuBackend).toBe('vulkan');
    expect(sel.variant).toBe('vulkan');
  });

  it('sidecar-npu override still selects openvino when probed', () => {
    const sel = selectBackend(probeVulkanAndOpenvinoNpu, 'sidecar-npu', { platform: 'linux' });
    expect(sel.type).toBe('sidecar-npu');
    expect(sel.gpuBackend).toBe('openvino-npu');
    expect(sel.variant).toBe('openvino');
  });

  it('skips OpenVINO when availableVariants omits openvino', () => {
    const sel = selectBackend(probeOpenvinoNpuOnly, null, {
      platform: 'win32',
      availableVariants: ['vulkan', 'cpu'],
    });
    expect(sel.type).toBe('sidecar-cpu');
    expect(sel.variant).toBe('openblas');
  });

  it('auto-selects openvino NPU when availableVariants includes openvino and no GPU', () => {
    const sel = selectBackend(probeOpenvinoNpuOnly, null, {
      platform: 'linux',
      availableVariants: ['openvino', 'cpu'],
    });
    expect(sel.type).toBe('sidecar-npu');
    expect(sel.variant).toBe('openvino');
  });

  it('variantBinaryExists respects availableVariants and hasVariantBinary', () => {
    expect(variantBinaryExists('openvino', { availableVariants: ['vulkan'] })).toBe(false);
    expect(variantBinaryExists('openvino', { availableVariants: ['openvino'] })).toBe(true);
    expect(variantBinaryExists('cpu', { availableVariants: [] })).toBe(true);
    expect(variantBinaryExists('vulkan', { hasVariantBinary: (v: string) => v === 'vulkan' })).toBe(true);
    expect(variantBinaryExists('cuda', { hasVariantBinary: () => false })).toBe(false);
  });
});
