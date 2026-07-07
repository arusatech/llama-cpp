/**
 * Standalone desktop sidecar entry point.
 *
 * Loads optional ggml GPU backend plugins (libggml-vulkan.so, libggml-cuda.so, …)
 * from the executable directory, then runs cap_llama_server_main until SIGINT/SIGTERM.
 */

#include "cap-native-server.h"
#include "ggml-backend.h"
#include "llama.h"

#include <atomic>
#include <chrono>
#include <csignal>
#include <cstring>
#include <filesystem>
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

void load_dynamic_backends(int argc, char ** argv) {
    const char * dir = resolve_backend_dir(argc, argv);
    lm_ggml_backend_load_all_from_path(dir);
}

} // namespace

int main(int argc, char ** argv) {
    install_signal_handlers();
    llama_backend_init();
    load_dynamic_backends(argc, argv);

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
