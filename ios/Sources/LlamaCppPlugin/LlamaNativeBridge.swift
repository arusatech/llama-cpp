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
                return "Native symbol \(symbol) is not linked. Rebuild the llama-cpp iOS framework and run npm run ios:prepare."
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

    @_silgen_name("llama_init_context")
    private static func cInitContext(_ modelPath: UnsafePointer<CChar>, _ paramsJson: UnsafePointer<CChar>) -> Int64

    @_silgen_name("llama_release_context")
    private static func cReleaseContext(_ contextId: Int64)

    @_silgen_name("llama_run_completion")
    private static func cRunCompletion(_ contextId: Int64, _ paramsJson: UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>?

    @_silgen_name("llama_free_completion_result")
    private static func cFreeCompletionResult(_ resultJson: UnsafeMutablePointer<CChar>)

    @_silgen_name("llama_stop_completion")
    private static func cStopCompletion(_ contextId: Int64)

    @_silgen_name("llama_run_embedding_json")
    private static func cRunEmbeddingJson(
        _ contextId: Int64,
        _ text: UnsafePointer<CChar>,
        _ paramsJson: UnsafePointer<CChar>
    ) -> UnsafeMutablePointer<CChar>?

    static func initContext(modelPath: String, paramsJson: String) throws -> Int64 {
        let normalizedPath = normalizeModelPath(modelPath)
        guard FileManager.default.fileExists(atPath: normalizedPath) else {
             throw Failure.modelNotFound(normalizedPath)
        }

        let nativeContextId = normalizedPath.withCString { modelCString in
            paramsJson.withCString { paramsCString in
                cInitContext(modelCString, paramsCString)
            }
        }

        guard nativeContextId > 0 else {
            throw Failure.initializationFailed("native loader returned \(nativeContextId) for \(normalizedPath)")
        }

        return nativeContextId
    }

    static func releaseContext(_ contextId: Int64) {
        cReleaseContext(contextId)
    }

    static func runCompletion(contextId: Int64, paramsJson: String) throws -> [String: Any] {
        let resultPointer = paramsJson.withCString { paramsCString in
            cRunCompletion(contextId, paramsCString)
        }

        guard let resultPointer else {
            throw Failure.completionFailed("native completion returned no result")
        }

        defer {
            cFreeCompletionResult(resultPointer)
        }

        let jsonString = String(cString: resultPointer)
        guard let data = jsonString.data(using: .utf8) else {
            throw Failure.completionFailed("native completion returned invalid UTF-8")
        }

        let object = try JSONSerialization.jsonObject(with: data, options: [])
        guard let dictionary = object as? [String: Any] else {
            throw Failure.completionFailed("native completion returned invalid JSON")
        }

        return dictionary
    }

    static func runEmbedding(contextId: Int64, text: String, paramsJson: String) throws -> [String: Any] {
        let resultPointer = text.withCString { textCString in
            paramsJson.withCString { paramsCString in
                cRunEmbeddingJson(contextId, textCString, paramsCString)
            }
        }

        guard let resultPointer else {
            throw Failure.embeddingFailed("native embedding returned no result")
        }

        defer {
            cFreeCompletionResult(resultPointer)
        }

        let jsonString = String(cString: resultPointer)
        guard let data = jsonString.data(using: .utf8) else {
            throw Failure.embeddingFailed("native embedding returned invalid UTF-8")
        }

        let object = try JSONSerialization.jsonObject(with: data, options: [])
        guard let dictionary = object as? [String: Any] else {
            throw Failure.embeddingFailed("native embedding returned invalid JSON")
        }

        return dictionary
    }

    static func stopCompletion(_ contextId: Int64) {
        cStopCompletion(contextId)
    }

    private static func normalizeModelPath(_ modelPath: String) -> String {
        if modelPath.hasPrefix("file://") {
            return String(modelPath.dropFirst("file://".count))
        }
        return modelPath
    }
}
