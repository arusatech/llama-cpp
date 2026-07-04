import Foundation

enum LlamaNativeBridge {
    enum Failure: LocalizedError {
        case missingSymbol(String)
        case modelNotFound(String)
        case initializationFailed(String)
        case completionFailed(String)
        case embeddingFailed(String)

        var errorDescription: String? {
            switch self {
            case .missingSymbol(let symbol):
                return "Native symbol \(symbol) is not linked. Rebuild llama-cpp.framework and run npm run ios:prepare."
            case .modelNotFound(let path):
                return "Model file not found at \(path)"
            case .initializationFailed(let details):
                return "Failed to initialize llama context: \(details)"
            case .completionFailed(let details):
                return "Failed to run local completion: \(details)"
            case .embeddingFailed(let details):
                return "Failed to run local embedding: \(details)"
            }
        }
    }

    private typealias InitContextFn = @convention(c) (UnsafePointer<CChar>, UnsafePointer<CChar>) -> Int64
    private typealias ReleaseContextFn = @convention(c) (Int64) -> Void
    private typealias RunCompletionFn = @convention(c) (Int64, UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>?
    private typealias FreeResultFn = @convention(c) (UnsafeMutablePointer<CChar>) -> Void
    private typealias StopCompletionFn = @convention(c) (Int64) -> Void
    private typealias RunEmbeddingJsonFn = @convention(c) (Int64, UnsafePointer<CChar>, UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>?

    private static var library: UnsafeMutableRawPointer? = {
        let fm = FileManager.default
        var candidates: [String] = []
        if let fw = Bundle.main.path(forResource: "llama-cpp", ofType: "framework") {
            candidates.append((fw as NSString).appendingPathComponent("llama-cpp"))
        }
        if let exec = Bundle.main.executablePath {
            candidates.append((exec as NSString).deletingLastPathComponent + "/Frameworks/llama-cpp.framework/llama-cpp")
        }
        for path in candidates where fm.fileExists(atPath: path) {
            if let handle = dlopen(path, RTLD_NOW) {
                return handle
            }
            print("[LlamaNativeBridge] dlopen failed for \(path): \(String(cString: dlerror()))")
        }
        print("[LlamaNativeBridge] llama-cpp framework binary not found; tried: \(candidates)")
        return nil
    }()

    private static func sym<T>(_ name: String, _ type: T.Type) throws -> T {
        guard let library else {
            throw Failure.missingSymbol(name)
        }
        guard let pointer = dlsym(library, name) else {
            throw Failure.missingSymbol(name)
        }
        return unsafeBitCast(pointer, to: T.self)
    }

    static func initContext(modelPath: String, paramsJson: String) throws -> Int64 {
        let normalizedPath = normalizeModelPath(modelPath)
        guard FileManager.default.fileExists(atPath: normalizedPath) else {
            throw Failure.modelNotFound(normalizedPath)
        }

        let initContext = try sym("llama_init_context", InitContextFn.self)
        let nativeContextId = normalizedPath.withCString { modelCString in
            paramsJson.withCString { paramsCString in
                initContext(modelCString, paramsCString)
            }
        }

        guard nativeContextId > 0 else {
            throw Failure.initializationFailed("native loader returned \(nativeContextId) for \(normalizedPath)")
        }

        return nativeContextId
    }

    static func releaseContext(_ contextId: Int64) {
        guard let releaseContext = try? sym("llama_release_context", ReleaseContextFn.self) else { return }
        releaseContext(contextId)
    }

    static func runCompletion(contextId: Int64, paramsJson: String) throws -> [String: Any] {
        let runCompletion = try sym("llama_run_completion", RunCompletionFn.self)
        let freeResult = try sym("llama_free_completion_result", FreeResultFn.self)

        let resultPointer = paramsJson.withCString { paramsCString in
            runCompletion(contextId, paramsCString)
        }

        guard let resultPointer else {
            throw Failure.completionFailed("native completion returned no result")
        }

        defer {
            freeResult(resultPointer)
        }

        return try decodeJsonDictionary(from: resultPointer, failure: Failure.completionFailed("native completion returned invalid JSON"))
    }

    static func runEmbedding(contextId: Int64, text: String, paramsJson: String) throws -> [String: Any] {
        let runEmbedding = try sym("llama_run_embedding_json", RunEmbeddingJsonFn.self)
        let freeResult = try sym("llama_free_completion_result", FreeResultFn.self)

        let resultPointer = text.withCString { textCString in
            paramsJson.withCString { paramsCString in
                runEmbedding(contextId, textCString, paramsCString)
            }
        }

        guard let resultPointer else {
            throw Failure.embeddingFailed("native embedding returned no result")
        }

        defer {
            freeResult(resultPointer)
        }

        return try decodeJsonDictionary(from: resultPointer, failure: Failure.embeddingFailed("native embedding returned invalid JSON"))
    }

    static func stopCompletion(_ contextId: Int64) {
        guard let stopCompletion = try? sym("llama_stop_completion", StopCompletionFn.self) else { return }
        stopCompletion(contextId)
    }

    private static func decodeJsonDictionary(
        from resultPointer: UnsafeMutablePointer<CChar>,
        failure: Failure
    ) throws -> [String: Any] {
        let jsonString = String(cString: resultPointer)
        guard let data = jsonString.data(using: .utf8) else {
            throw failure
        }
        let object = try JSONSerialization.jsonObject(with: data, options: [])
        guard let dictionary = object as? [String: Any] else {
            throw failure
        }
        return dictionary
    }

    private static func normalizeModelPath(_ modelPath: String) -> String {
        if modelPath.hasPrefix("file://") {
            return String(modelPath.dropFirst("file://".count))
        }
        return modelPath
    }
}
