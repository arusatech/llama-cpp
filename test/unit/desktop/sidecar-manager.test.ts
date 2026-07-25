/** @jest-environment node */

const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  createSidecarManager,
  stageCpuOnlySidecar,
} = require('../../../desktop/src/main/sidecar-manager.cjs');

const {
  selectBackend,
  backendToVariant,
} = require('../../../desktop/src/main/backend-selector.cjs');

describe('sidecar-manager helpers', () => {
  test('exports createSidecarManager', () => {
    expect(typeof createSidecarManager).toBe('function');
  });

  test('createSidecarManager returns start/stop/status API', () => {
    const m = createSidecarManager({
      log: { info() {}, warn() {}, error() {} },
      fs: {
        existsSync: () => false,
        accessSync: () => {
          throw new Error('ENOENT');
        },
        mkdirSync() {},
        copyFileSync() {},
        readdirSync: () => [],
      },
      spawn: () => {
        throw new Error('spawn should not be called in this test');
      },
      platform: 'win32',
      arch: 'x64',
      resourcesPath: path.join(os.tmpdir(), 'no-sidecar'),
      cwd: os.tmpdir(),
    });
    expect(typeof m.start).toBe('function');
    expect(typeof m.stop).toBe('function');
    expect(typeof m.getStatus).toBe('function');
  });

  test('start with missing binary returns binary-missing and sets permanentWasmFallback', async () => {
    const m = createSidecarManager({
      log: { info() {}, warn() {}, error() {} },
      fs: {
        existsSync: () => false,
        accessSync: () => {
          const err = new Error('ENOENT');
          (err as Error & { code?: string }).code = 'ENOENT';
          throw err;
        },
        mkdirSync() {},
        copyFileSync() {},
        readdirSync: () => [],
      },
      spawn: () => {
        throw new Error('should not spawn');
      },
      platform: 'win32',
      arch: 'x64',
      resourcesPath: path.join(os.tmpdir(), 'missing-sidecar'),
      cwd: os.tmpdir(),
    });
    const result = await m.start({
      selection: { type: 'sidecar-cpu', variant: 'cpu', gpuBackend: null },
      forceCpu: true,
      retryCpu: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('binary-missing');
    expect(m.getStatus().permanentWasmFallback).toBe(true);
  });

  test('stageCpuOnlySidecar skips GPU plugin DLLs', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-stage-'));
    const srcDir = path.join(tmp, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    for (const [name, buf] of Object.entries({
      'win32-x64-cpu.exe': Buffer.from('exe'),
      'ggml-base.dll': Buffer.from('base'),
      'ggml-cpu.dll': Buffer.from('cpu'),
      'ggml-vulkan.dll': Buffer.from('vk'),
      'ggml-cuda.dll': Buffer.from('cu'),
    })) {
      fs.writeFileSync(path.join(srcDir, name), buf as Buffer);
    }
    try {
      const staged = stageCpuOnlySidecar({
        fs,
        platform: 'win32',
        arch: 'x64',
        binaryPath: path.join(srcDir, 'win32-x64-cpu.exe'),
        resourcesPath: srcDir,
        cwd: srcDir,
      });
      expect(typeof staged).toBe('string');
      const stagedNames = fs.readdirSync(path.dirname(staged));
      expect(stagedNames.some((n: string) => /vulkan|cuda/i.test(n))).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('backend matrix smoke (selector)', () => {
  test('openvino maps to openvino variant (not cuda-openvino)', () => {
    expect(backendToVariant('openvino-npu', 'win32')).toBe('openvino');
    expect(backendToVariant('openvino-gpu', 'win32')).toBe('openvino');
    expect(backendToVariant('vulkan', 'win32')).toBe('vulkan');
  });

  test('auto on win32 prefers GPU over NPU when both available', () => {
    const probe = {
      backends: [
        { name: 'openvino-npu', available: true, kind: 'npu' },
        { name: 'vulkan', available: true, kind: 'gpu' },
        { name: 'cpu', available: true, kind: 'cpu' },
      ],
    };
    const sel = selectBackend(probe, null, {
      platform: 'win32',
      availableVariants: ['vulkan', 'openvino', 'cpu'],
    });
    expect(sel.gpuBackend).toBe('vulkan');
    expect(sel.type).toBe('sidecar-gpu');
  });

  test('does not invent cuda-openvino when openvino binary missing', () => {
    const probe = {
      backends: [
        { name: 'openvino-npu', available: true, kind: 'npu' },
        { name: 'cpu', available: true, kind: 'cpu' },
      ],
    };
    const sel = selectBackend(probe, 'sidecar-npu', {
      platform: 'win32',
      availableVariants: ['cpu'],
    });
    expect(sel.variant).not.toBe('cuda-openvino');
  });
});
