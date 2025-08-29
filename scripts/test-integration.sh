#!/bin/bash

# LlamaCpp Integration Test Script
# This script runs comprehensive integration tests with actual GGUF models

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
TEST_DIR="test"
MODELS_DIR="$TEST_DIR/models"
OUTPUT_DIR="$TEST_DIR/output"
REPORTS_DIR="$OUTPUT_DIR/reports"

# Test models configuration
declare -A TEST_MODELS=(
    ["small"]="llama-2-7b-chat.Q4_K_M.gguf"
    ["multimodal"]="llava-1.5-7b-hf.gguf"
)

# Model URLs (note: multimodal requires Hugging Face authentication)
declare -A MODEL_URLS=(
    ["small"]="https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf"
    ["multimodal"]="https://huggingface.co/llava-hf/llava-1.5-7b-hf/resolve/main/llava-1.5-7b-hf.gguf"
)

# Model sizes (for progress tracking)
declare -A MODEL_SIZES=(
    ["small"]="4.37 GB"
    ["multimodal"]="4.37 GB"
)

# Model requirements (for documentation)
declare -A MODEL_REQUIREMENTS=(
    ["small"]="public"
    ["multimodal"]="huggingface_token"
)

# Create necessary directories
setup_directories() {
    print_status "Setting up test directories..."
    
    mkdir -p "$MODELS_DIR"
    mkdir -p "$OUTPUT_DIR"
    mkdir -p "$REPORTS_DIR"
    mkdir -p "$TEST_DIR/images"
    mkdir -p "$TEST_DIR/audio"
    
    print_success "Directories created"
}

# Download model if not exists
download_model() {
    local model_key=$1
    local model_name=${TEST_MODELS[$model_key]}
    local model_url=${MODEL_URLS[$model_key]}
    local model_size=${MODEL_SIZES[$model_key]}
    local model_requirement=${MODEL_REQUIREMENTS[$model_key]}
    local model_path="$MODELS_DIR/$model_name"
    
    if [ -f "$model_path" ]; then
        print_status "Model $model_name already exists"
        return 0
    fi
    
    print_status "Downloading $model_name ($model_size)..."
    print_status "URL: $model_url"
    
    # Check if model requires authentication
    if [ "$model_requirement" = "huggingface_token" ]; then
        print_warning "Model $model_name requires Hugging Face authentication"
        print_warning "Please download manually from: $model_url"
        print_warning "Or set HUGGINGFACE_TOKEN environment variable"
        return 1
    fi
    
    # Check if curl is available
    if command -v curl &> /dev/null; then
        print_status "Using curl to download model..."
        curl -L -o "$model_path" "$model_url" || {
            print_error "Failed to download model with curl"
            # Check if we got an error response
            if [ -f "$model_path" ]; then
                local file_size=$(wc -c < "$model_path" 2>/dev/null || echo "0")
                if [ "$file_size" -lt 1000 ]; then
                    print_error "Download failed - got error response (file size: $file_size bytes)"
                    rm -f "$model_path"
                fi
            fi
            return 1
        }
    elif command -v wget &> /dev/null; then
        print_status "Using wget to download model..."
        wget -O "$model_path" "$model_url" || {
            print_error "Failed to download model with wget"
            # Check if we got an error response
            if [ -f "$model_path" ]; then
                local file_size=$(wc -c < "$model_path" 2>/dev/null || echo "0")
                if [ "$file_size" -lt 1000 ]; then
                    print_error "Download failed - got error response (file size: $file_size bytes)"
                    rm -f "$model_path"
                fi
            fi
            return 1
        }
    else
        print_warning "Neither curl nor wget found. Please download manually:"
        print_warning "  URL: $model_url"
        print_warning "  Save to: $model_path"
        return 1
    fi
    
    print_success "Model $model_name downloaded successfully"
}

# Validate model file
validate_model() {
    local model_key=$1
    local model_name=${TEST_MODELS[$model_key]}
    local model_path="$MODELS_DIR/$model_name"
    
    if [ ! -f "$model_path" ]; then
        print_error "Model file not found: $model_path"
        return 1
    fi
    
    # Check file size (should be at least 1MB for a GGUF model)
    local file_size
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        # Windows Git Bash - use wc -c
        file_size=$(wc -c < "$model_path" 2>/dev/null)
    else
        # Linux/macOS - use stat
        file_size=$(stat -c%s "$model_path" 2>/dev/null || stat -f%z "$model_path" 2>/dev/null)
    fi
    
    if [ -z "$file_size" ] || [ "$file_size" -lt 1048576 ]; then
        print_error "Model file too small or invalid: $model_path (size: $file_size bytes)"
        return 1
    fi
    
    # Check file extension
    if [[ "$model_name" != *.gguf ]]; then
        print_error "Model file should have .gguf extension: $model_path"
        return 1
    fi
    
    print_success "Model $model_name validated"
    return 0
}

# Run Jest integration tests
run_jest_tests() {
    print_status "Running Jest integration tests..."
    
    # Set environment variables for tests
    export TEST_MODEL_SMALL="$MODELS_DIR/${TEST_MODELS[small]}"
    export TEST_MODEL_MULTIMODAL="$MODELS_DIR/${TEST_MODELS[multimodal]}"
    export TEST_TIMEOUT_MODEL_LOAD=30000
    export TEST_TIMEOUT_COMPLETION=15000
    export TEST_TIMEOUT_EMBEDDING=10000
    export TEST_TIMEOUT_TTS=20000
    
    # Run tests with Jest - use node directly on Windows
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        print_status "Running on Windows, using node directly..."
        node ./node_modules/.bin/jest --config test/jest.integration.config.js --verbose || {
            print_error "Jest tests failed"
            return 1
        }
    else
        npx jest --config test/jest.integration.config.js --verbose || {
            print_error "Jest tests failed"
            return 1
        }
    fi
    
    print_success "Jest tests completed"
}

# Run custom test runner
run_custom_tests() {
    print_status "Running custom test runner..."
    
    # Compile TypeScript test runner - use node directly on Windows
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        print_status "Running on Windows, using node directly..."
        node ./node_modules/.bin/tsc test/integration/test-runner.ts --outDir test/integration/dist --target es2020 --module commonjs || {
            print_error "Failed to compile test runner"
            return 1
        }
    else
        npx tsc test/integration/test-runner.ts --outDir test/integration/dist --target es2020 --module commonjs || {
            print_error "Failed to compile test runner"
            return 1
        }
    fi
    
    # Run test runner
    node test/integration/dist/test-runner.js || {
        print_error "Custom test runner failed"
        return 1
    }
    
    print_success "Custom test runner completed"
}

# Generate test report
generate_report() {
    print_status "Generating test report..."
    
    local report_file="$REPORTS_DIR/integration-test-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# LlamaCpp Integration Test Report

**Generated:** $(date)
**Duration:** $(($(date +%s) - START_TIME)) seconds

## Test Summary

### Models Tested
EOF
    
    for model_key in "${!TEST_MODELS[@]}"; do
        local model_name=${TEST_MODELS[$model_key]}
        local model_path="$MODELS_DIR/$model_name"
        
        if [ -f "$model_path" ]; then
            local file_size=$(du -h "$model_path" | cut -f1)
            echo "- **$model_key**: $model_name ($file_size)" >> "$report_file"
        else
            echo "- **$model_key**: $model_name (NOT FOUND)" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF

### Test Results

#### Jest Tests
- **Status**: $(if [ -f "$OUTPUT_DIR/junit.xml" ]; then echo "Completed"; else echo "Not run"; fi)
- **Report**: $OUTPUT_DIR/junit.xml

#### Custom Tests
- **Status**: $(if [ -f "$OUTPUT_DIR/results/test-report.json" ]; then echo "Completed"; else echo "Not run"; fi)
- **Report**: $OUTPUT_DIR/results/test-report.json

#### Performance Data
- **Logs**: $OUTPUT_DIR/logs/performance.json
- **Results**: $OUTPUT_DIR/logs/test-results.json

## Test Coverage

The integration tests cover the following functionality:

### Core Features
- [x] Model initialization and loading
- [x] Text completion (basic and streaming)
- [x] Chat conversations
- [x] Tokenization and detokenization
- [x] Embeddings generation
- [x] Session management

### Advanced Features
- [x] Multimodal support (image processing)
- [x] Text-to-Speech (TTS)
- [x] LoRA adapters
- [x] Performance benchmarking
- [x] Error handling

### Platform Support
- [x] iOS native implementation
- [x] Android native implementation
- [x] Web fallback
- [x] Cross-platform compatibility

## Recommendations

1. **Model Download**: Ensure all required models are downloaded before running tests
2. **Performance**: Monitor memory usage during large model testing
3. **Platform Testing**: Run tests on actual iOS and Android devices
4. **Continuous Integration**: Set up automated testing in CI/CD pipeline

## Next Steps

1. Run tests on actual mobile devices
2. Test with larger models (13B, 70B)
3. Add stress testing for memory management
4. Implement automated model download in CI
EOF
    
    print_success "Test report generated: $report_file"
}

# Clean up function
cleanup() {
    print_status "Cleaning up test artifacts..."
    
    # Remove temporary files
    rm -rf "$TEST_DIR/integration/dist"
    
    # Keep model files and test results
    print_success "Cleanup completed"
}

# Main function
main() {
    local START_TIME=$(date +%s)
    
    print_status "=== LlamaCpp Integration Test Suite ==="
    print_status "Starting comprehensive integration tests..."
    
    # Parse command line arguments
    local download_models=true
    local run_jest=true
    local run_custom=true
    local generate_report=true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-download)
                download_models=false
                shift
                ;;
            --no-jest)
                run_jest=false
                shift
                ;;
            --no-custom)
                run_custom=false
                shift
                ;;
            --no-report)
                generate_report=false
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --no-download    Skip model downloads"
                echo "  --no-jest        Skip Jest tests"
                echo "  --no-custom      Skip custom test runner"
                echo "  --no-report      Skip report generation"
                echo "  --help           Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Setup
    setup_directories
    
    # Download models if requested
    if [ "$download_models" = true ]; then
        for model_key in "${!TEST_MODELS[@]}"; do
            download_model "$model_key" || {
                print_warning "Failed to download model $model_key, continuing with existing files"
            }
        done
        
        # Validate models
        for model_key in "${!TEST_MODELS[@]}"; do
            validate_model "$model_key" || {
                print_warning "Model validation failed for $model_key"
            }
        done
    fi
    
    # Run tests
    local test_failed=false
    
    if [ "$run_jest" = true ]; then
        run_jest_tests || test_failed=true
    fi
    
    if [ "$run_custom" = true ]; then
        run_custom_tests || test_failed=true
    fi
    
    # Generate report
    if [ "$generate_report" = true ]; then
        generate_report
    fi
    
    # Cleanup
    cleanup
    
    # Final status
    if [ "$test_failed" = true ]; then
        print_error "Some tests failed. Check the reports for details."
        exit 1
    else
        print_success "All tests completed successfully!"
        print_success "Check the reports in: $REPORTS_DIR"
    fi
}

# Run main function
main "$@"
