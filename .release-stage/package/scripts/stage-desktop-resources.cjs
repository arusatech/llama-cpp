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
  /^linux-x64(-(rocm|cuda|vulkan|openblas))?$/,
  /^win32-x64(-(rocm|cuda|vulkan|openblas))?\.exe$/,
];

function shouldCopyBin(name) {
  return BIN_PATTERNS.some((re) => re.test(name));
}

function stageSidecarBins() {
  if (!fs.existsSync(srcBin)) {
    console.error(`Missing ${srcBin} — run npm run build:sidecar first`);
    process.exit(1);
  }
  mkdirp(dstRoot);
  let copied = 0;
  for (const name of fs.readdirSync(srcBin)) {
    if (!shouldCopyBin(name)) continue;
    if (onlyPlatform && !name.startsWith(onlyPlatform)) continue;
    const ok = copyFile(path.join(srcBin, name), path.join(dstRoot, name));
    if (ok) {
      copied += 1;
      console.log(`  staged ${name}`);
    }
  }
  return copied;
}

function stageGgmlPlugins() {
  const srcPlugins = path.join(srcBin, 'ggml-plugins');
  if (!fs.existsSync(srcPlugins)) return 0;
  return copyDir(srcPlugins, path.join(dstRoot, 'ggml-plugins'), (n) =>
    /\.(so|dll|dylib)/i.test(n) || !n.includes('.'),
  );
}

function stageRuntimeLibs() {
  const srcLibs = path.join(srcBin, 'runtime-libs');
  if (!fs.existsSync(srcLibs)) return 0;
  return copyDir(srcLibs, path.join(dstRoot, 'runtime-libs'), (n) =>
    /\.(so|dll|dylib)/i.test(n) || !n.includes('.'),
  );
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

console.log('Staging desktop resources...');
const bins = stageSidecarBins();
const plugins = stageGgmlPlugins();
const libs = stageRuntimeLibs();
const wasm = stageWasm();

console.log(`Done: ${bins} sidecar binary(ies), ${plugins} plugin file(s), ${libs} runtime lib(s), ${wasm} wasm file(s)`);

if (bins === 0) {
  console.error('No sidecar binaries staged.');
  process.exit(1);
}
