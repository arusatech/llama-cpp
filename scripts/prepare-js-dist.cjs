/**
 * Runs on npm pack/install (prepare). Builds JS dist when missing; no-ops otherwise.
 */
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = join(__dirname, '..');
const marker = join(root, 'dist', 'esm', 'index.js');

if (existsSync(marker)) {
  process.exit(0);
}

const tsc = join(root, 'node_modules', '.bin', 'tsc');
if (!existsSync(tsc)) {
  console.warn(
    '[llama-cpp-capacitor] dist/ missing and local build tools not installed yet. Run: npm run build:js',
  );
  process.exit(0);
}

const r = spawnSync('npm', ['run', 'build:js'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);
