/**
 * Standalone desktop sidecar entry point.
 *
 * Loads optional ggml GPU backend plugins (libggml-vulkan.so, ggml-openvino.dll, …)
 * from --backend-dir (preferred) and/or the executable directory, then runs
 * cap_llama_server_main until SIGINT/SIGTERM.
 *
 * IMPORTANT: backends must be loaded BEFORE llama_backend_init(). That function
 * only auto-loads when no backends are registered yet; loading twice (exe dir +
 * plugin dir) registers duplicate Vulkan devices and corrupts the heap.
 */

#include "cap-native-server.h"
#include "ggml-backend.h"
#include "llama.h"

#include <atomic>
#include <chrono>
#include <csignal>
#include <cstring>
#include <filesystem>
#include <string>
#include <thread>

namespace {

std::atomic<bool> g_shutdown{false};

void on_signal(int) {
    g_shutdown.store(true);
}

void install_signal_handlers() {
    std::signal(SIGINT, on_signal);
    std::signal(SIGTERM, on_signal);
#ifndef _WIN32
    std::signal(SIGHUP, on_signal);
#endif
}

const char * resolve_backend_dir(int argc, char ** argv) {
    for (int i = 1; i < argc - 1; i++) {
        if (argv[i] && std::strcmp(argv[i], "--backend-dir") == 0 && argv[i + 1]) {
            return argv[i + 1];
        }
    }
    return nullptr;
}

std::string exe_directory(char ** argv) {
    try {
        if (argv && argv[0] && argv[0][0]) {
            return std::filesystem::absolute(argv[0]).parent_path().string();
        }
    } catch (...) { /* fall through */ }
    return {};
}

/**
 * Load backend plugins once, from a single directory preference order:
 *   1. --backend-dir (GPU/NPU plugins staged by the Electron host)
 *   2. directory of this executable (CPU + any bundled plugins)
 *
 * GPU plugin DLLs should NOT also sit next to the exe when --backend-dir is
 * used — otherwise load_best can pick them up a second time.
 */
void load_dynamic_backends(int argc, char ** argv) {
    const char * plugin_dir = resolve_backend_dir(argc, argv);
    if (plugin_dir && plugin_dir[0]) {
        ggml_backend_load_all_from_path(plugin_dir);
    }
    // Always also try the exe directory so ggml-cpu (and shared ggml) resolve
    // when plugins live in a separate folder. load_best will still re-scan;
    // keep GPU plugins out of the exe dir to avoid duplicate Vulkan regs.
    const std::string exe_dir = exe_directory(argv);
    if (!exe_dir.empty() && !(plugin_dir && exe_dir == plugin_dir)) {
        ggml_backend_load_all_from_path(exe_dir.c_str());
    }
    if (!plugin_dir && exe_dir.empty()) {
        ggml_backend_load_all_from_path(nullptr);
    }
}

} // namespace

int main(int argc, char ** argv) {
    install_signal_handlers();

    // Register backends first so llama_backend_init() skips its default scan.
    load_dynamic_backends(argc, argv);
    llama_backend_init();

    if (cap_llama_server_main(argc, argv) != 0) {
        llama_backend_free();
        return 1;
    }

    while (!g_shutdown.load() && cap_llama_server_is_running()) {
        std::this_thread::sleep_for(std::chrono::milliseconds(200));
    }

    cap_llama_server_stop();
    llama_backend_free();
    return 0;
}
