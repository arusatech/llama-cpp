#!/usr/bin/env node
/**
 * Preflight check before electron-builder packaging.
 *
 * Usage:
 *   node scripts/ensure-desktop-sidecar-bundle.cjs --platform win32|darwin|linux
 */

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const extra = path.join(root, 'extraResources', 'sidecar');

const arg = process.argv.find((a) => a.startsWith('--platform='));
const platform = arg ? arg.split('=')[1] : process.platform;

const REQUIRED = {
  darwin: ['darwin-arm64', 'darwin-x64'],
  linux: ['linux-x64'],
  win32: ['win32-x64.exe'],
};

const optional = {
  darwin: [],
  linux: ['linux-x64-rocm', 'linux-x64-cuda', 'linux-x64-vulkan'],
  win32: ['win32-x64-rocm.exe', 'win32-x64-cuda.exe', 'win32-x64-vulkan.exe'],
};

const required = REQUIRED[platform] || [];
const errors = [];

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
  process.exit(1);
}

const foundOptional = (optional[platform] || []).filter((n) =>
  fs.existsSync(path.join(extra, n)),
);
process.stdout.write(
  `Desktop bundle OK (${platform}): ${required.join(', ')}`
  + (foundOptional.length ? `; GPU variants: ${foundOptional.join(', ')}` : '')
  + '\n',
);
