#ifndef JNI_UTILS_H
#define JNI_UTILS_H

#include <jni.h>
#include <string>
#include <vector>
#include "cap-llama.h"

namespace jni_utils {

// Convert Java string to C++ string
std::string jstring_to_string(JNIEnv* env, jstring jstr);

// Convert C++ string to Java string
jstring string_to_jstring(JNIEnv* env, const std::string& str);

// Convert Java string array to C++ string vector
std::vector<std::string> jstring_array_to_string_vector(JNIEnv* env, jobjectArray jarray);

// Convert C++ string vector to Java string array
jobjectArray string_vector_to_jstring_array(JNIEnv* env, const std::vector<std::string>& vec);

// Convert Java boolean to C++ bool
bool jboolean_to_bool(jboolean jbool);

// Convert C++ bool to Java boolean
jboolean bool_to_jboolean(bool b);

// Convert Java int to C++ int
int jint_to_int(jint jint_val);

// Convert C++ int to Java int
jint int_to_jint(int val);

// Convert Java float to C++ float
float jfloat_to_float(jfloat jfloat_val);

// Convert C++ float to Java float
jfloat float_to_jfloat(float val);

// Convert Java long to C++ long
long jlong_to_long(jlong jlong_val);

// Convert C++ long to Java long
jlong long_to_jlong(long val);

// Convert Java double to C++ double
double jdouble_to_double(jdouble jdouble_val);

// Convert C++ double to Java double
jdouble double_to_jdouble(double val);

// Throw Java exception
void throw_java_exception(JNIEnv* env, const char* class_name, const char* message);

// Check if exception occurred
bool check_exception(JNIEnv* env);

// Get field ID safely
jfieldID get_field_id(JNIEnv* env, jclass clazz, const char* name, const char* sig);

// Get method ID safely
jmethodID get_method_id(JNIEnv* env, jclass clazz, const char* name, const char* sig);

// Find class safely
jclass find_class(JNIEnv* env, const char* name);

// Create object safely
jobject create_object(JNIEnv* env, jclass clazz, jmethodID constructor, ...);

// Call method safely
jobject call_method(JNIEnv* env, jobject obj, jmethodID method, ...);

// Call static method safely
jobject call_static_method(JNIEnv* env, jclass clazz, jmethodID method, ...);

// Set field safely
void set_field(JNIEnv* env, jobject obj, jfieldID field, ...);

// Get field safely
jobject get_field(JNIEnv* env, jobject obj, jfieldID field);

// Set static field safely
void set_static_field(JNIEnv* env, jclass clazz, jfieldID field, ...);

// Get static field safely
jobject get_static_field(JNIEnv* env, jclass clazz, jfieldID field);

// Convert llama_cap_context to jobject
jobject llama_context_to_jobject(JNIEnv* env, const capllama::llama_cap_context* context);

// Convert jobject to llama_cap_context
capllama::llama_cap_context* jobject_to_llama_context(JNIEnv* env, jobject obj);

// Convert completion result to jobject
jobject completion_result_to_jobject(JNIEnv* env, const capllama::completion_token_output& result);

// Convert jobject to completion parameters
common_params jobject_to_completion_params(JNIEnv* env, jobject obj);

// Convert chat parameters to jobject
jobject chat_params_to_jobject(JNIEnv* env, const common_chat_params& params);

// Convert jobject to chat parameters
common_chat_params jobject_to_chat_params(JNIEnv* env, jobject obj);

// Convert tokenize result to jobject
jobject tokenize_result_to_jobject(JNIEnv* env, const capllama::llama_cap_tokenize_result& result);

// Convert embedding result to jobject
jobject embedding_result_to_jobject(JNIEnv* env, const std::vector<float>& embedding);

// Convert rerank result to jobject
jobject rerank_result_to_jobject(JNIEnv* env, const std::vector<std::pair<size_t, float>>& results);

// Convert benchmark result to jobject
jobject benchmark_result_to_jobject(JNIEnv* env, const std::vector<float>& timings);

// Convert LoRA adapter info to jobject
jobject lora_adapter_info_to_jobject(JNIEnv* env, const common_adapter_lora_info& info);

// Convert jobject to LoRA adapter info
common_adapter_lora_info jobject_to_lora_adapter_info(JNIEnv* env, jobject obj);

// Convert multimodal support info to jobject
jobject multimodal_support_to_jobject(JNIEnv* env, bool vision, bool audio);

// Convert TTS result to jobject
jobject tts_result_to_jobject(JNIEnv* env, const std::vector<float>& audio_data, int sample_rate);

// Convert session data to jobject
jobject session_data_to_jobject(JNIEnv* env, const std::string& data);

// Convert jobject to session data
std::string jobject_to_session_data(JNIEnv* env, jobject obj);

} // namespace jni_utils

#endif // JNI_UTILS_H
