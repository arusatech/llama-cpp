import Foundation

/// Memory admission control for native model loading on iOS.
///
/// This mirrors the Web/WASM `DefaultModelScheduler` + `wasmMemoryPolicy` so that all
/// three platforms share the same isomorphic admission semantics:
/// - A hard cap on concurrent loaded models (parity with `WASM_MAX_CONCURRENT_MODELS = 5`).
/// - Per-model footprint estimation based on GGUF file size.
/// - A device-memory guard that keeps a reserve free after each load.
///
/// Unlike the Web path (bounded by a single 2 GB WASM linear-memory pool), the iOS
/// ceiling is the per-process memory budget reported by `os_proc_available_memory()`
/// (the headroom before jetsam terminates the app). The controller rejects a load when
/// either the slot limit is reached or the projected available memory after loading
/// would fall below the reserve threshold.
final class ModelAdmissionController {

    /// Max concurrent native contexts. Parity with `WASM_MAX_CONCURRENT_MODELS`.
    static let maxConcurrentModels = 5

    /// Keep this much process memory free after a model load (headroom for app + OS).
    static let defaultReserveBytes: UInt64 = 512 * 1024 * 1024 // 512 MB

    /// Fallback footprint when the GGUF size cannot be determined.
    private static let unknownModelFootprintBytes: UInt64 = 512 * 1024 * 1024

    enum DeniedBy {
        case limit
        case memory
    }

    /// Result of an admission decision.
    struct Decision {
        let allow: Bool
        let deniedBy: DeniedBy?   // nil when allowed
        let reason: String?       // nil when allowed
        let estimatedBytes: UInt64

        static func allowed(_ estimatedBytes: UInt64) -> Decision {
            Decision(allow: true, deniedBy: nil, reason: nil, estimatedBytes: estimatedBytes)
        }

        static func denied(_ deniedBy: DeniedBy, _ reason: String, _ estimatedBytes: UInt64) -> Decision {
            Decision(allow: false, deniedBy: deniedBy, reason: reason, estimatedBytes: estimatedBytes)
        }
    }

    /// Lightweight snapshot of process/device memory (mirrors the Web MemorySnapshot).
    struct MemorySnapshot {
        let totalBytes: UInt64   // device physical memory
        let freeBytes: UInt64    // per-process available memory (headroom before jetsam)
    }

    private let maxModels: Int
    private let reserveBytes: UInt64

    init(maxModels: Int = ModelAdmissionController.maxConcurrentModels,
         reserveBytes: UInt64 = ModelAdmissionController.defaultReserveBytes) {
        self.maxModels = maxModels
        self.reserveBytes = reserveBytes
    }

    var maxModelCount: Int { maxModels }

    /// Estimate the resident footprint of a model once loaded.
    ///
    /// Native loading (mmap or full read) does not duplicate the GGUF the way a naive
    /// heap copy would, but the KV cache and compute buffers add headroom on top of the
    /// mapped weights. The multipliers below match the WASM policy's intent, scaled for
    /// native memory behaviour.
    ///
    /// - Parameters:
    ///   - fileBytes: GGUF file size in bytes (0 when unknown)
    ///   - embedding: whether the context is an embedding-only model (lighter headroom)
    static func estimateModelFootprint(fileBytes: UInt64, embedding: Bool) -> UInt64 {
        guard fileBytes > 0 else {
            return unknownModelFootprintBytes
        }
        let isLarge = fileBytes > 200 * 1024 * 1024
        let weightMultiplier: Double = embedding ? 1.15 : (isLarge ? 1.30 : 1.20)
        let proportionalHeadroom = UInt64((Double(fileBytes) * 0.12).rounded(.up))
        let minHeadroom: UInt64 = embedding ? 48 * 1024 * 1024 : 96 * 1024 * 1024
        let headroom = max(minHeadroom, proportionalHeadroom)
        let weights = UInt64((Double(fileBytes) * weightMultiplier).rounded(.up))
        return weights + headroom
    }

    /// Read the GGUF file size, returning 0 when the path is missing or unreadable.
    static func fileSizeBytes(_ modelPath: String) -> UInt64 {
        guard !modelPath.isEmpty else { return 0 }
        // Accept both plain paths and file:// URLs.
        let path: String
        if let url = URL(string: modelPath), url.isFileURL {
            path = url.path
        } else {
            path = modelPath
        }
        do {
            let attrs = try FileManager.default.attributesOfItem(atPath: path)
            if let size = attrs[.size] as? NSNumber {
                return size.uint64Value
            }
        } catch {
            return 0
        }
        return 0
    }

    /// Capture a process/device memory snapshot.
    ///
    /// `os_proc_available_memory()` (iOS 13+) reports the memory the app can still use
    /// before jetsam terminates it — a more meaningful guard than device-wide free RAM.
    func memorySnapshot() -> MemorySnapshot {
        let total = ProcessInfo.processInfo.physicalMemory
        var free: UInt64 = 0
        if #available(iOS 13.0, *) {
            let available = os_proc_available_memory()
            if available > 0 {
                free = UInt64(available)
            }
        }
        return MemorySnapshot(totalBytes: total, freeBytes: free)
    }

    /// Decide whether a new model may be admitted.
    ///
    /// - Parameters:
    ///   - currentlyLoaded: number of contexts already loaded
    ///   - modelPath: path to the GGUF being loaded (used to size the footprint)
    ///   - embedding: whether this is an embedding-only context
    func canAdmit(currentlyLoaded: Int, modelPath: String, embedding: Bool) -> Decision {
        let fileBytes = Self.fileSizeBytes(modelPath)
        let estimated = Self.estimateModelFootprint(fileBytes: fileBytes, embedding: embedding)

        // 1. Slot limit (parity with Web).
        if currentlyLoaded >= maxModels {
            return .denied(
                .limit,
                "Model slot limit reached (\(maxModels) concurrent contexts)",
                estimated
            )
        }

        // 2. Process-memory guard: keep `reserveBytes` free after the load.
        let mem = memorySnapshot()
        if mem.freeBytes > 0 {
            // Guard against unsigned underflow.
            if mem.freeBytes <= estimated || (mem.freeBytes - estimated) < reserveBytes {
                return .denied(
                    .memory,
                    "Insufficient memory: need ~\(toMb(estimated)) MB, "
                        + "\(toMb(mem.freeBytes)) MB available, "
                        + "\(toMb(reserveBytes)) MB reserve required",
                    estimated
                )
            }
        }

        return .allowed(estimated)
    }

    /// Snapshot of admission state for diagnostics / health reporting.
    func status(currentlyLoaded: Int) -> [String: Any] {
        let mem = memorySnapshot()
        return [
            "loadedModels": currentlyLoaded,
            "maxModels": maxModels,
            "deviceTotalBytes": mem.totalBytes,
            "processFreeBytes": mem.freeBytes,
            "reserveBytes": reserveBytes
        ]
    }

    private func toMb(_ bytes: UInt64) -> UInt64 {
        bytes / (1024 * 1024)
    }
}
