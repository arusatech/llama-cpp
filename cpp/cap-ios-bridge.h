#pragma once

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

int64_t llama_init_context(const char *model_path, const char *params_json);
void llama_release_context(int64_t context_id);
bool llama_toggle_native_log(bool enabled);
char *llama_run_completion(int64_t context_id, const char *params_json);
void llama_free_completion_result(char *result_json);
void llama_stop_completion(int64_t context_id);
/** JSON object: {"embedding":[float,...]} — free with llama_free_completion_result */
char *llama_run_embedding_json(int64_t context_id, const char *text, const char *params_json);

#ifdef __cplusplus
}
#endif
