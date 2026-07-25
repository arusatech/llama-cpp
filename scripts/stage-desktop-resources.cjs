#!/usr/bin/env node
/**
 * Stage sidecar binaries, ggml GPU plugins, and WASM assets into extraResources/
 * for electron-builder packaging.
 *
 * Usage: node scripts/stage-desktop-resources.cjs [--platform darwin|linux|win32]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcBin = path.join(root, 'sidecar', 'bin');
const dstRoot = path.join(root, 'extraResources', 'sidecar');

const platformArg = process.argv.find((a) => a.startsWith('--platform='));
const onlyPlatform = platformArg ? platformArg.split('=')[1] : null;

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dst) {
  if (!fs.existsSync(src)) return false;
  mkdirp(path.dirname(dst));
  fs.copyFileSync(src, dst);
  return true;
}

function copyDir(src, dst, filter) {
  if (!fs.existsSync(src)) return 0;
  mkdirp(dst);
  let n = 0;
  for (const name of fs.readdirSync(src)) {
    const sp = path.join(src, name);
    const dp = path.join(dst, name);
    const st = fs.statSync(sp);
    if (st.isDirectory()) {
      n += copyDir(sp, dp, filter);
    } else if (!filter || filter(name)) {
      fs.copyFileSync(sp, dp);
      n += 1;
    }
  }
  return n;
}

const BIN_PATTERNS = [
  /^darwin-(arm64|x64)$/,
  /^linux-x64(-(rocm|cuda|vulkan|openblas|openvino|cpu))?$/,
  /^win32-x64(-(rocm|cuda|vulkan|vulkan-openblas|openblas|openvino|cpu))?\.exe$/,
];

function shouldCopyBin(name) {
  return BIN_PATTERNS.some((re) => re.test(name));
}

function isGpuBackendPlugin(name) {
  return /ggml-(vulkan|cuda|hip|openvino|metal|blas)/i.test(name);
}

function stageSidecarBins() {
  if (!fs.existsSync(srcBin)) {
    console.error(`Missing ${srcBin} — run npm run build:sidecar first`);
    process.exit(1);
  }
  mkdirp(dstRoot);
  let copied = 0;
  for (const name of fs.readdirSync(srcBin)) {
    if (!shouldCopyBin(name) && !/\.(dll|so|dylib)$/i.test(name)) continue;
    // GPU plugins must live under ggml-plugins/ only — never next to the exe.
    if (isGpuBackendPlugin(name)) continue;
    if (onlyPlatform && !name.startsWith(onlyPlatform) && !/\.(dll|so|dylib)$/i.test(name)) {
      // Always allow runtime DLLs (e.g. libopenblas.dll) regardless of --platform filter.
      if (!/\.(dll|so|dylib)$/i.test(name)) continue;
    }
    if (onlyPlatform && shouldCopyBin(name) && !name.startsWith(onlyPlatform)) continue;
    const ok = copyFile(path.join(srcBin, name), path.join(dstRoot, name));
    if (ok) {
      copied += 1;
      console.log(`  staged ${name}`);
    }
  }
  return copied;
}

function stageGgmlPlugins() {
  // Prefer staged plugins under sidecar/bin/ggml-plugins/**
  const srcPlugins = path.join(srcBin, 'ggml-plugins');
  let n = 0;
  if (fs.existsSync(srcPlugins)) {
    n += copyDir(srcPlugins, path.join(dstRoot, 'ggml-plugins'), (name) =>
      /\.(so|dll|dylib)$/i.test(name) || !name.includes('.'),
    );
  }
  // Also pick up cmake copy folder if present (pre-stage)
  const buildPlugins = path.join(root, 'sidecar', 'build', 'ggml-plugins');
  if (fs.existsSync(buildPlugins)) {
    const plat = onlyPlatform || (process.platform === 'win32' ? 'win32' : process.platform);
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const dest = path.join(dstRoot, 'ggml-plugins', `${plat}-${arch}`);
    n += copyDir(buildPlugins, dest, (name) => /\.(so|dll|dylib)$/i.test(name));
  }
  if (n > 0) console.log(`  staged ${n} ggml plugin file(s)`);
  return n;
}

function stageRuntimeLibs() {
  const srcLibs = path.join(srcBin, 'runtime-libs');
  if (!fs.existsSync(srcLibs)) return 0;
  return copyDir(srcLibs, path.join(dstRoot, 'runtime-libs'), (n) =>
    /\.(so|dll|dylib)/i.test(n) || !n.includes('.'),
  );
}

function stageOpenVinoRuntime() {
  const src = path.join(srcBin, 'openvino-runtime');
  if (!fs.existsSync(src)) return 0;
  const n = copyDir(src, path.join(dstRoot, 'openvino-runtime'), (name) =>
    /\.(dll|so(\.\d+)*)$/i.test(name),
  );
  if (n > 0) console.log(`  staged ${n} OpenVINO runtime file(s)`);
  return n;
}

function stageWasm() {
  const srcWasm = path.join(root, 'dist', 'wasm');
  const dstWasm = path.join(root, 'extraResources', 'llama-wasm');
  if (!fs.existsSync(srcWasm)) {
    console.warn('  wasm: dist/wasm not found — run npm run build:pwa');
    return 0;
  }
  return copyDir(srcWasm, dstWasm);
}

function promoteDefaultWinSidecar() {
  const preferred = path.join(dstRoot, 'win32-x64.exe');
  if (fs.existsSync(preferred)) return;
  for (const alt of [
    'win32-x64-cpu.exe',
    'win32-x64-vulkan-openblas.exe',
    'win32-x64-vulkan.exe',
    'win32-x64-openvino.exe',
    'win32-x64-openblas.exe',
  ]) {
    const src = path.join(dstRoot, alt);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, preferred);
      console.log(`  promoted ${alt} → win32-x64.exe`);
      return;
    }
  }
}

console.log('Staging desktop resources...');
const bins = stageSidecarBins();
promoteDefaultWinSidecar();
const plugins = stageGgmlPlugins();
const libs = stageRuntimeLibs();
const ov = stageOpenVinoRuntime();
const wasm = stageWasm();

console.log(`Done: ${bins} sidecar binary(ies), ${plugins} plugin file(s), ${libs} runtime lib(s), ${ov} openvino file(s), ${wasm} wasm file(s)`);

if (bins === 0) {
  console.error('No sidecar binaries staged.');
  process.exit(1);
}
