/** @jest-environment node */

const { probe } = require('../../../desktop/src/main/gpu-probe.cjs');

describe('desktop gpu-probe', () => {
  const mockFs = {
    existsSync: (p: string) => {
      if (p.includes('nvcuda.dll')) return true;
      if (p.includes('vulkan-1.dll')) return false;
      return false;
    },
  };

  it('detects CUDA on Windows when nvcuda.dll exists', () => {
    const result = probe({ platform: 'win32', fs: mockFs });
    const cuda = result.backends.find((b: { name: string }) => b.name === 'cuda');
    expect(cuda).toBeDefined();
    expect(cuda.available).toBe(true);
  });

  it('always includes CPU fallback', () => {
    const result = probe({ platform: 'linux', fs: { existsSync: () => false } });
    const cpu = result.backends.find((b: { name: string }) => b.name === 'cpu');
    expect(cpu).toBeDefined();
    expect(cpu.available).toBe(true);
  });

  it('detects Metal on macOS', () => {
    const result = probe({ platform: 'darwin', fs: { existsSync: () => true } });
    const metal = result.backends.find((b: { name: string }) => b.name === 'metal');
    expect(metal).toBeDefined();
    expect(metal.available).toBe(true);
  });
});
