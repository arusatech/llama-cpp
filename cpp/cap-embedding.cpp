// C wrapper functions for iOS and Wasm embedding support

#include "cap-llama.h"
#include "llama.h"
#include "common.h"
#include "nlohmann/json.hpp"
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include <map>
#include <mutex>

#ifdef __EMSCRIPTEN__
#define WASM_EMBED_LOG(fmt, ...) fprintf(stderr, "@@WASM_EMBED@@ " fmt "\n", ##__VA_ARGS__)
#else
#define WASM_EMBED_LOG(fmt, ...) ((void)0)
#endif

using json = nlohmann::ordered_json;

// Global context storage for iOS
static std::map<int64_t, capllama::llama_cap_context*> g_contexts;
static std::mutex g_contexts_mutex;

extern "C" void llama_embedding_register_context(int64_t contextId, void* contextPtr) {
    if (contextPtr == nullptr) return;
    std::lock_guard<std::mutex> lock(g_contexts_mutex);
    g_contexts[contextId] = static_cast<capllama::llama_cap_context*>(contextPtr);
}

extern "C" void llama_embedding_unregister_context(int64_t contextId) {
    std::lock_guard<std::mutex> lock(g_contexts_mutex);
    g_contexts.erase(contextId);
}

static capllama::llama_cap_context * resolve_context(int64_t contextId) {
    std::lock_guard<std::mutex> lock(g_contexts_mutex);
    auto it = g_contexts.find(contextId);
    if (it == g_contexts.end() || it->second == nullptr) {
        return nullptr;
    }
    return it->second;
}

static int32_t parse_embd_normalize(const char * paramsJson) {
    int32_t embd_norm = 2; // euclidean / L2 — matches common_params default
    if (paramsJson == nullptr || paramsJson[0] == '\0') {
        return embd_norm;
    }
    try {
        json p = json::parse(paramsJson);
        if (p.contains("embd_normalize")) {
            embd_norm = p.at("embd_normalize").get<int32_t>();
        }
    } catch (...) {
        // keep default
    }
    return embd_norm;
}

// Returns pointer to thread-local storage valid until the next call on this thread.
extern "C" float* llama_embedding(int64_t contextId, const char* text, const char* paramsJson) {
    static thread_local std::vector<float> embedding_storage;

    if (text == nullptr) {
        WASM_EMBED_LOG("fail: null text ctx=%lld", (long long) contextId);
        return nullptr;
    }

    capllama::llama_cap_context * ctx_ptr = resolve_context(contextId);
    if (ctx_ptr == nullptr || ctx_ptr->ctx == nullptr || ctx_ptr->model == nullptr) {
        WASM_EMBED_LOG("fail: context not found ctx=%lld", (long long) contextId);
        return nullptr;
    }

    try {
        const int32_t n_embd = llama_model_n_embd(ctx_ptr->model);
        if (n_embd <= 0) {
            WASM_EMBED_LOG("fail: n_embd=%d", n_embd);
            return nullptr;
        }

        const int32_t embd_norm = parse_embd_normalize(paramsJson);
        const enum llama_pooling_type pooling_type = llama_pooling_type(ctx_ptr->ctx);
        const bool use_encode = llama_get_memory(ctx_ptr->ctx) == nullptr;

        WASM_EMBED_LOG(
            "begin ctx=%lld n_embd=%d pooling=%d encode=%d text_len=%zu",
            (long long) contextId,
            n_embd,
            (int) pooling_type,
            use_encode ? 1 : 0,
            std::strlen(text));

        std::string text_str(text);
        capllama::llama_cap_tokenize_result tokenize_result = ctx_ptr->tokenize(text_str, {});
        std::vector<llama_token> tokens = tokenize_result.tokens;
        if (tokens.empty()) {
            WASM_EMBED_LOG("fail: empty tokenization");
            return nullptr;
        }

        const int32_t max_tokens = (int32_t) llama_n_ubatch(ctx_ptr->ctx);
        if (max_tokens > 0 && (int32_t) tokens.size() > max_tokens) {
            WASM_EMBED_LOG("truncating tokens %zu -> %d (n_ubatch)", tokens.size(), max_tokens);
            tokens.resize((size_t) max_tokens);
        }

        llama_set_embeddings(ctx_ptr->ctx, true);

        llama_batch batch = llama_batch_get_one(tokens.data(), (int32_t) tokens.size());
        const int rc = use_encode
            ? llama_encode(ctx_ptr->ctx, batch)
            : llama_decode(ctx_ptr->ctx, batch);

        if (rc != 0) {
            WASM_EMBED_LOG("fail: %s rc=%d n_tokens=%zu",
                use_encode ? "llama_encode" : "llama_decode",
                rc,
                tokens.size());
            llama_set_embeddings(ctx_ptr->ctx, false);
            return nullptr;
        }

        llama_synchronize(ctx_ptr->ctx);

        float * data = nullptr;
        if (pooling_type == LLAMA_POOLING_TYPE_NONE) {
            data = llama_get_embeddings(ctx_ptr->ctx);
        } else {
            data = llama_get_embeddings_seq(ctx_ptr->ctx, 0);
        }

        if (data == nullptr) {
            WASM_EMBED_LOG("fail: null embedding ptr pooling=%d", (int) pooling_type);
            llama_set_embeddings(ctx_ptr->ctx, false);
            return nullptr;
        }

        embedding_storage.assign(data, data + n_embd);
        std::vector<float> normalized(n_embd);
        common_embd_normalize(embedding_storage.data(), normalized.data(), n_embd, embd_norm);
        embedding_storage = std::move(normalized);

        llama_set_embeddings(ctx_ptr->ctx, false);

        WASM_EMBED_LOG("ok ctx=%lld dim=%d norm=%d", (long long) contextId, n_embd, embd_norm);
        return embedding_storage.data();
    } catch (const std::exception & e) {
        WASM_EMBED_LOG("exception: %s", e.what());
        if (ctx_ptr && ctx_ptr->ctx) {
            llama_set_embeddings(ctx_ptr->ctx, false);
        }
        return nullptr;
    } catch (...) {
        WASM_EMBED_LOG("exception: unknown");
        if (ctx_ptr && ctx_ptr->ctx) {
            llama_set_embeddings(ctx_ptr->ctx, false);
        }
        return nullptr;
    }
}

extern "C" const char* llama_embedding_json(int64_t contextId, const char* text, const char* paramsJson) {
    static thread_local std::string json_buf;

    int32_t n_embd = 0;
    {
        capllama::llama_cap_context * ctx_ptr = resolve_context(contextId);
        if (ctx_ptr != nullptr && ctx_ptr->model != nullptr) {
            n_embd = llama_model_n_embd(ctx_ptr->model);
        }
    }

    float* floats = llama_embedding(contextId, text, paramsJson);
    if (!floats || n_embd <= 0) {
        json_buf = "{\"embedding\":[],\"error\":\"embed_failed\"}";
        return json_buf.c_str();
    }

    json_buf.clear();
    json_buf.reserve(16 + (size_t) n_embd * 14);
    json_buf += "{\"embedding\":[";
    for (int i = 0; i < n_embd; ++i) {
        if (i > 0) json_buf += ',';
        char tmp[32];
        std::snprintf(tmp, sizeof(tmp), "%.8g", static_cast<double>(floats[i]));
        json_buf += tmp;
    }
    json_buf += "]}";
    return json_buf.c_str();
}
