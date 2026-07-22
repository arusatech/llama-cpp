#ifndef CAPTTS_H
#define CAPTTS_H

#include <vector>
#include <string>
#include "llama.h"
#include "nlohmann/json.hpp"
#include "common.h"

using json = nlohmann::ordered_json;

namespace capllama {

// Forward declarations
struct llama_cap_context;

// TTS type enumeration
enum tts_type {
    UNKNOWN = -1,
    OUTETTS_V0_1 = 0,
    OUTETTS_V0_2 = 1,
    OUTETTS_V0_3 = 2,
};

// Audio completion result structure
struct llama_cap_audio_completion_result {
    std::string prompt;
    const char *grammar;
};

// TTS context for TTS-specific functionality
struct llama_cap_context_tts {
    // TTS state fields
    std::vector<llama_token> audio_tokens;
    std::vector<llama_token> guide_tokens;
    bool next_token_uses_guide_token = true;

    // Vocoder fields (from llama_cap_context_vocoder)
    common_init_result init_result;
    common_params params;
    llama_model *model = nullptr;
    llama_context *ctx = nullptr;
    tts_type type = UNKNOWN;

    // Constructor and destructor
    llama_cap_context_tts(const std::string &vocoder_model_path, int batch_size = -1);
    ~llama_cap_context_tts();

    // TTS utility methods
    tts_type getTTSType(llama_cap_context* main_ctx, json speaker = nullptr);
    llama_cap_audio_completion_result getFormattedAudioCompletion(llama_cap_context* main_ctx, const std::string &speaker_json_str, const std::string &text_to_speak);
    std::vector<llama_token> getAudioCompletionGuideTokens(llama_cap_context* main_ctx, const std::string &text_to_speak);
    std::vector<float> decodeAudioTokens(llama_cap_context* main_ctx, const std::vector<llama_token> &tokens);
    void setGuideTokens(const std::vector<llama_token> &tokens);
};

}

#endif /* CAPTTS_H */
