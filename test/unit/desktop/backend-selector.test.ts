/** @jest-environment node */

const { selectBackend, backendToVariant } = require('../../../desktop/src/main/backend-selector.cjs');

const probeWithVulkan = {
  backends: [
    { name: 'vulkan', kind: 'gpu', available: true },
    { name: 'cpu', kind: 'cpu', available: true },
  ],
};

const probeCpuOnly = {
  backends: [{ name: 'cpu', kind: 'cpu', available: true }],
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

  it('maps CUDA to cuda variant on Windows', () => {
    expect(backendToVariant('cuda', 'win32')).toBe('cuda');
    expect(backendToVariant('rocm', 'linux')).toBe('rocm');
    expect(backendToVariant('metal', 'darwin')).toBe('metal');
  });
});
