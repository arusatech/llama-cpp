/** @jest-environment node */

import { DesktopProvider } from '../../../src/isomorphic/provider.desktop';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function setSidecarPort(provider: DesktopProvider, port = 19001): void {
  provider.setSidecarPort(port);
  (globalThis as { __annadataSidecarPort?: number }).__annadataSidecarPort = port;
}

describe('DesktopProvider multi-model', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    (globalThis as { annadataLlama?: unknown }).annadataLlama = {
      getMemorySnapshot: async () => ({
        totalBytes: 16 * 1024 ** 3,
        freeBytes: 8 * 1024 ** 3,
        usedBytes: 8 * 1024 ** 3,
        pressure: 'low' as const,
      }),
      ensureSidecar: async () => ({ ok: true, port: 19001 }),
    };
  });

  it('loads up to 5 models via sidecar internal API', async () => {
    const provider = new DesktopProvider();
    setSidecarPort(provider);

    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/v1/internal/models/load')) {
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ ok: true, model_id: JSON.parse(String(init?.body)).model_id }),
        };
      }
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      };
    });

    for (let i = 0; i < 5; i++) {
      await provider.loadModel({
        modelId: `model-${i}`,
        modelPath: `/tmp/model-${i}.gguf`,
        modelBytes: 100 * 1024 * 1024,
      });
    }

    expect(provider.listLoadedModels()).toHaveLength(5);
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it('rejects 6th model with MODEL_LIMIT_REACHED from sidecar', async () => {
    const provider = new DesktopProvider();
    setSidecarPort(provider);

    let loadCount = 0;
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/v1/internal/models/load')) {
        loadCount += 1;
        if (loadCount > 5) {
          return {
            ok: false,
            status: 429,
            text: async () =>
              JSON.stringify({
                error: { message: 'model limit reached (5)', type: 'model_limit_reached' },
              }),
          };
        }
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ ok: true, model_id: JSON.parse(String(init?.body)).model_id }),
        };
      }
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      };
    });

    for (let i = 0; i < 5; i++) {
      await provider.loadModel({
        modelId: `model-${i}`,
        modelPath: `/tmp/model-${i}.gguf`,
        modelBytes: 50 * 1024 * 1024,
      });
    }

    await expect(
      provider.loadModel({
        modelId: 'model-6',
        modelPath: '/tmp/model-6.gguf',
        modelBytes: 50 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({ code: 'MODEL_LIMIT_REACHED' });
  });

  it('unloads model via DELETE and updates scheduler', async () => {
    const provider = new DesktopProvider();
    setSidecarPort(provider);

    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/v1/internal/models/load')) {
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ ok: true }),
        };
      }
      if (init?.method === 'DELETE') {
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ ok: true }),
        };
      }
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      };
    });

    await provider.loadModel({ modelId: 'a', modelPath: '/tmp/a.gguf', modelBytes: 1 });
    expect(provider.listLoadedModels()).toEqual(['a']);

    await provider.unloadModel('a');
    expect(provider.listLoadedModels()).toEqual([]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/internal/models/a'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('reports memory snapshot with registry info', async () => {
    const provider = new DesktopProvider();
    setSidecarPort(provider);

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/v1/internal/memory')) {
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ loaded_count: 2, max_models: 5 }),
        };
      }
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      };
    });

    const snap = await provider.getMemorySnapshot();
    expect(snap.loadedModelCount).toBe(2);
    expect(snap.maxModels).toBe(5);
    expect(snap.freeBytes).toBe(8 * 1024 ** 3);
  });
});
