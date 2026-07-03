package ai.annadata.plugin.capacitor;

import android.app.ActivityManager;
import android.content.Context;
import android.util.Log;
import java.io.File;
import java.util.HashMap;
import java.util.Map;

/**
 * Memory admission control for native model loading on Android.
 *
 * <p>This mirrors the Web/WASM {@code DefaultModelScheduler} + {@code wasmMemoryPolicy}
 * so that all three platforms share the same isomorphic admission semantics:
 * <ul>
 *   <li>A hard cap on concurrent loaded models (parity with WASM_MAX_CONCURRENT_MODELS = 5).</li>
 *   <li>Per-model footprint estimation based on GGUF file size.</li>
 *   <li>A device-memory guard that keeps a reserve free after each load.</li>
 * </ul>
 *
 * <p>Unlike the Web path (bounded by a single 2 GB WASM linear-memory pool), the native
 * ceiling is the device's available RAM as reported by {@link ActivityManager}. The class
 * therefore rejects a load when either the slot limit is reached or the projected free
 * memory after loading would fall below the reserve threshold.
 */
final class ModelAdmissionController {
    private static final String TAG = "ModelAdmission";

    /** Max concurrent native contexts. Parity with WASM_MAX_CONCURRENT_MODELS. */
    static final int MAX_CONCURRENT_MODELS = 5;

    /** Keep this much device RAM free after a model load (headroom for the app + OS). */
    static final long DEFAULT_RESERVE_BYTES = 512L * 1024 * 1024; // 512 MB

    /** Fallback footprint when the GGUF size cannot be determined. */
    private static final long UNKNOWN_MODEL_FOOTPRINT_BYTES = 512L * 1024 * 1024;

    enum DeniedBy { LIMIT, MEMORY }

    /** Result of an admission decision. */
    static final class Decision {
        final boolean allow;
        final DeniedBy deniedBy;      // null when allowed
        final String reason;          // null when allowed
        final long estimatedBytes;

        private Decision(boolean allow, DeniedBy deniedBy, String reason, long estimatedBytes) {
            this.allow = allow;
            this.deniedBy = deniedBy;
            this.reason = reason;
            this.estimatedBytes = estimatedBytes;
        }

        static Decision allowed(long estimatedBytes) {
            return new Decision(true, null, null, estimatedBytes);
        }

        static Decision denied(DeniedBy deniedBy, String reason, long estimatedBytes) {
            return new Decision(false, deniedBy, reason, estimatedBytes);
        }
    }

    /** Lightweight snapshot of device memory (mirrors the Web MemorySnapshot). */
    static final class MemorySnapshot {
        final long totalBytes;
        final long freeBytes;
        final boolean lowMemory;

        MemorySnapshot(long totalBytes, long freeBytes, boolean lowMemory) {
            this.totalBytes = totalBytes;
            this.freeBytes = freeBytes;
            this.lowMemory = lowMemory;
        }
    }

    private final Context appContext;
    private final int maxModels;
    private final long reserveBytes;

    ModelAdmissionController(Context appContext) {
        this(appContext, MAX_CONCURRENT_MODELS, DEFAULT_RESERVE_BYTES);
    }

    ModelAdmissionController(Context appContext, int maxModels, long reserveBytes) {
        this.appContext = appContext;
        this.maxModels = maxModels;
        this.reserveBytes = reserveBytes;
    }

    /**
     * Estimate the resident footprint of a model once loaded.
     *
     * <p>Native loading (mmap or full read) does not duplicate the GGUF the way a naive
     * heap copy would, but the KV cache and compute buffers add headroom on top of the
     * mapped weights. The multipliers below match the WASM policy's intent, scaled for
     * native memory behaviour.
     *
     * @param fileBytes  GGUF file size in bytes (0 or negative when unknown)
     * @param embedding  whether the context is an embedding-only model (lighter headroom)
     */
    static long estimateModelFootprint(long fileBytes, boolean embedding) {
        if (fileBytes <= 0) {
            return UNKNOWN_MODEL_FOOTPRINT_BYTES;
        }
        // Weights (mapped) + a proportional slice for KV cache / compute buffers.
        double weightMultiplier;
        if (embedding) {
            weightMultiplier = 1.15;
        } else if (fileBytes > 200L * 1024 * 1024) {
            weightMultiplier = 1.30;
        } else {
            weightMultiplier = 1.20;
        }
        long proportionalHeadroom = (long) Math.ceil(fileBytes * 0.12);
        long minHeadroom = embedding ? 48L * 1024 * 1024 : 96L * 1024 * 1024;
        long headroom = Math.max(minHeadroom, proportionalHeadroom);
        return (long) Math.ceil(fileBytes * weightMultiplier) + headroom;
    }

    /** Read the GGUF file size, returning 0 when the path is missing or unreadable. */
    static long fileSizeBytes(String modelPath) {
        if (modelPath == null || modelPath.isEmpty()) {
            return 0L;
        }
        try {
            File f = new File(modelPath);
            return f.exists() ? f.length() : 0L;
        } catch (Exception e) {
            return 0L;
        }
    }

    /** Capture a device memory snapshot from {@link ActivityManager}. */
    MemorySnapshot memorySnapshot() {
        try {
            ActivityManager am = (ActivityManager) appContext.getSystemService(Context.ACTIVITY_SERVICE);
            if (am == null) {
                return new MemorySnapshot(0L, 0L, false);
            }
            ActivityManager.MemoryInfo info = new ActivityManager.MemoryInfo();
            am.getMemoryInfo(info);
            return new MemorySnapshot(info.totalMem, info.availMem, info.lowMemory);
        } catch (Exception e) {
            Log.w(TAG, "Failed to read memory snapshot: " + e.getMessage());
            return new MemorySnapshot(0L, 0L, false);
        }
    }

    /**
     * Decide whether a new model may be admitted.
     *
     * @param currentlyLoaded number of contexts already loaded
     * @param modelPath       path to the GGUF being loaded (used to size the footprint)
     * @param embedding       whether this is an embedding-only context
     */
    Decision canAdmit(int currentlyLoaded, String modelPath, boolean embedding) {
        long fileBytes = fileSizeBytes(modelPath);
        long estimated = estimateModelFootprint(fileBytes, embedding);

        // 1. Slot limit (parity with Web).
        if (currentlyLoaded >= maxModels) {
            return Decision.denied(
                DeniedBy.LIMIT,
                "Model slot limit reached (" + maxModels + " concurrent contexts)",
                estimated
            );
        }

        // 2. Device-memory guard: keep `reserveBytes` free after the load.
        MemorySnapshot mem = memorySnapshot();
        if (mem.lowMemory) {
            return Decision.denied(
                DeniedBy.MEMORY,
                "Device reported low-memory state; refusing to load model",
                estimated
            );
        }
        if (mem.freeBytes > 0) {
            long projectedFree = mem.freeBytes - estimated;
            if (projectedFree < reserveBytes) {
                return Decision.denied(
                    DeniedBy.MEMORY,
                    "Insufficient memory: need ~" + toMb(estimated) + " MB, "
                        + toMb(mem.freeBytes) + " MB free, "
                        + toMb(reserveBytes) + " MB reserve required",
                    estimated
                );
            }
        }

        return Decision.allowed(estimated);
    }

    /** Snapshot of admission state for diagnostics / health reporting. */
    Map<String, Object> status(int currentlyLoaded) {
        MemorySnapshot mem = memorySnapshot();
        Map<String, Object> m = new HashMap<>();
        m.put("loadedModels", currentlyLoaded);
        m.put("maxModels", maxModels);
        m.put("deviceTotalBytes", mem.totalBytes);
        m.put("deviceFreeBytes", mem.freeBytes);
        m.put("reserveBytes", reserveBytes);
        m.put("lowMemory", mem.lowMemory);
        return m;
    }

    int maxModels() {
        return maxModels;
    }

    private static long toMb(long bytes) {
        return bytes / (1024 * 1024);
    }
}
