#!/usr/bin/env node
/**
 * Preflight check before electron-builder packaging.
 *
 * Usage:
 *   node scripts/ensure-desktop-sidecar-bundle.cjs
 *   node scripts/ensure-desktop-sidecar-bundle.cjs --platform=darwin|linux|win32
 *   node scripts/ensure-desktop-sidecar-bundle.cjs --arch=arm64|x64|universal
 *
 * By default, only the current host platform/arch binary is required
 * (correct for local Electron dev on Apple Silicon). Pass --arch=universal
 * on macOS to require both darwin-arm64 and darwin-x64.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const extra = path.join(root, 'extraResources', 'sidecar');

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('-')) {
    return process.argv[idx + 1];
  }
  return null;
}

const platform = argValue('platform') || process.platform;
const archOpt = argValue('arch');

function hostArchLabel() {
  const a = os.arch();
  if (a === 'arm64') return 'arm64';
  if (a === 'x64' || a === 'x86_64') return 'x64';
  return a;
}

function requiredBinaries(plat, archMode) {
  if (plat === 'darwin') {
    if (archMode === 'universal' || archMode === 'all') {
      return ['darwin-arm64', 'darwin-x64'];
    }
    const arch = archMode === 'x64' || archMode === 'arm64' ? archMode : hostArchLabel();
    return [`darwin-${arch}`];
  }
  if (plat === 'linux') {
    return ['linux-x64'];
  }
  if (plat === 'win32') {
    return ['win32-x64.exe'];
  }
  return [];
}

const optional = {
  darwin: [],
  linux: ['linux-x64-rocm', 'linux-x64-cuda', 'linux-x64-vulkan', 'linux-x64-openblas'],
  win32: ['win32-x64-rocm.exe', 'win32-x64-cuda.exe', 'win32-x64-vulkan.exe', 'win32-x64-openblas.exe'],
};

const required = requiredBinaries(platform, archOpt);
const errors = [];

if (!required.length) {
  process.stderr.write(`Unsupported platform: ${platform}\n`);
  process.exit(1);
}

for (const name of required) {
  const p = path.join(extra, name);
  if (!fs.existsSync(p)) {
    errors.push(`Missing required: extraResources/sidecar/${name}`);
  }
}

if (errors.length) {
  process.stderr.write('Desktop sidecar bundle incomplete:\n\n');
  for (const e of errors) process.stderr.write(`  • ${e}\n`);
  process.stderr.write('\nRun: npm run build:sidecar && npm run stage:desktop\n');
  if (platform === 'darwin') {
    process.stderr.write(
      'Tip: on Apple Silicon only darwin-arm64 is required for local Electron.\n' +
        '     For universal Mac packages: npm run verify:desktop:bundle -- --arch=universal\n',
    );
  }
  process.exit(1);
}

const foundOptional = (optional[platform] || []).filter((n) =>
  fs.existsSync(path.join(extra, n)),
);
process.stdout.write(
  `Desktop bundle OK (${platform}): ${required.join(', ')}` +
    (foundOptional.length ? `; GPU variants: ${foundOptional.join(', ')}` : '') +
    '\n',
);
