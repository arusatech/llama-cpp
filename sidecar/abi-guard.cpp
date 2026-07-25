/**
 * Compile-time ABI guards for the desktop sidecar.
 *
 * The sidecar executable and ggml backend plugins (Vulkan / OpenVINO / …) must
 * share one ggml runtime. These static_asserts catch struct-layout drift at
 * build time so a mismatched plugin cannot silently corrupt memory the way
 * the old llama.rn + upstream-plugin hybrid did.
 */

#include "ggml.h"
#include "ggml-backend.h"

// Tensor layout is passed across the backend boundary in supports_op().
static_assert(sizeof(ggml_tensor) == GGML_TENSOR_SIZE,
              "ggml_tensor size mismatch vs GGML_TENSOR_SIZE");

// Caps bitfield must stay 4 bools (async, host_buffer, buffer_from_host_ptr, events).
static_assert(sizeof(ggml_backend_dev_caps) >= 4 * sizeof(bool),
              "ggml_backend_dev_caps unexpectedly small");

// Device props must include the upstream `device_id` field (added after the
// llama.rn fork snapshot). A props struct that is only name/description/
// memory/type/caps is too small and is the exact ABI break we hit before.
static_assert(sizeof(ggml_backend_dev_props) > sizeof(const char *) * 2 + sizeof(size_t) * 2 + sizeof(int) + sizeof(ggml_backend_dev_caps),
              "ggml_backend_dev_props missing device_id (ABI too old)");

// Force a translation unit reference so the asserts are always compiled in.
extern "C" int llama_cpp_pro_abi_guard_anchor(void) {
    return static_cast<int>(sizeof(ggml_backend_dev_props));
}
