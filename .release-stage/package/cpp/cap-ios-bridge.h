#pragma once

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// Core
int64_t  llama_init_context(const char *model_path, const char *params_json);
void     llama_release_context(int64_t context_id);
bool     llama_toggle_native_log(bool enabled);
char    *llama_run_completion(int64_t context_id, const char *params_json);
void     llama_free_completion_result(char *result_json);
void     llama_stop_completion(int64_t context_id);
/** JSON object: {"embedding":[float,...]} — free with llama_free_completion_result */
char    *llama_run_embedding_json(int64_t context_id, const char *text, const char *params_json);

// Rerank — returns JSON [{score,index},...]; free with llama_free_completion_result
char    *llama_rerank_json(int64_t context_id, const char *query, const char *docs_json);

// Bench — returns raw "[desc,size,nparams,ppAvg,ppStd,tgAvg,tgStd]"; free with llama_free_completion_result
char    *llama_bench(int64_t context_id, int32_t pp, int32_t tg, int32_t pl, int32_t nr);

// Session management — returns JSON; free with llama_free_completion_result
// NOTE: named llama_cap_* to avoid clashing with the deprecated bool-returning
// llama_load_session_file / llama_save_session_file in llama.h (llama-context.cpp).
char    *llama_cap_load_session_file(int64_t context_id, const char *filepath);
int32_t  llama_cap_save_session_file(int64_t context_id, const char *filepath, int32_t max_tokens);

// LoRA adapters
int32_t  llama_apply_lora_adapters(int64_t context_id, const char *lora_adapters_json);
void     llama_remove_lora_adapters(int64_t context_id);
/** Returns JSON [{path,scale},...]; free with llama_free_completion_result */
char    *llama_get_loaded_lora_adapters(int64_t context_id, const char *unused);

// Multimodal
int32_t  llama_init_multimodal(int64_t context_id, const char *mmproj_path, int32_t use_gpu);
int32_t  llama_is_multimodal_enabled(int64_t context_id);
/** Returns JSON {vision:bool,audio:bool}; free with llama_free_completion_result */
char    *llama_get_multimodal_support(int64_t context_id, const char *unused);
void     llama_release_multimodal(int64_t context_id);

// TTS / Vocoder
int32_t  llama_init_vocoder(int64_t context_id, const char *vocoder_path, int32_t n_batch);
int32_t  llama_is_vocoder_enabled(int64_t context_id);
/** Returns JSON {prompt,grammar?}; free with llama_free_completion_result */
char    *llama_get_formatted_audio_completion(int64_t context_id, const char *speaker_json, const char *text);
/** Returns JSON [token,...]; free with llama_free_completion_result */
char    *llama_get_audio_completion_guide_tokens(int64_t context_id, const char *text);
/** Returns JSON [float,...]; free with llama_free_completion_result */
char    *llama_decode_audio_tokens(int64_t context_id, const char *tokens_json);
void     llama_release_vocoder(int64_t context_id);

// GPU info — returns JSON {gpu:bool,reasonNoGPU:string}; free with llama_free_completion_result
char    *llama_get_context_gpu_info(int64_t context_id, const char *unused);

#ifdef __cplusplus
}
#endif
