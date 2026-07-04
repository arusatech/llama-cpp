#!/usr/bin/env bash
# Merge ggml headers into ggml-metal.metal and emit assembly that embeds the source
# for LM_GGML_METAL_EMBED_LIBRARY (runtime Metal shader compilation).
set -euo pipefail

COMMON="$1"
SOURCE="$2"
IMPL="$3"
OUT_ASM="$4"
OUT_METAL="$5"
TMP_METAL="${OUT_METAL}.tmp"

sed -e "/__embed_ggml-common.h__/r ${COMMON}" -e "/__embed_ggml-common.h__/d" < "${SOURCE}" > "${TMP_METAL}"
sed -e "/#include \"ggml-metal-impl.h\"/r ${IMPL}" -e "/#include \"ggml-metal-impl.h\"/d" < "${TMP_METAL}" > "${OUT_METAL}"
rm -f "${TMP_METAL}"

cat > "${OUT_ASM}" <<EOF
.section __DATA,__ggml_metallib
.globl _lm_ggml_metallib_start
_lm_ggml_metallib_start:
.incbin "${OUT_METAL}"
.globl _lm_ggml_metallib_end
_lm_ggml_metallib_end:
EOF
