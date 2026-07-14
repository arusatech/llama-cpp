/**
 * Build TypeScript + Rollup JS without wiping dist/wasm (or workers).
 */
const { existsSync, mkdirSync, rmSync, renameSync, cpSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = join(__dirname, '..');
const dist = join(root, 'dist');
const stash = join(root, '.dist-stash');

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Stash large assets if present.
if (existsSync(stash)) rmSync(stash, { recursive: true, force: true });
mkdirSync(stash, { recursive: true });
for (const name of ['wasm', 'workers']) {
  const from = join(dist, name);
  if (existsSync(from)) {
    renameSync(from, join(stash, name));
  }
}

for (const name of [
  'esm',
  'plugin.js',
  'plugin.cjs',
  'plugin.cjs.js',
  'plugin.js.map',
  'plugin.cjs.map',
  'plugin.cjs.js.map',
  'docs.json',
]) {
  const p = join(dist, name);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

run(join(root, 'node_modules', '.bin', 'tsc'), []);
run(process.execPath, [join(root, 'scripts', 'fix-esm-extensions.cjs')]);
run(join(root, 'node_modules', '.bin', 'rollup'), ['-c', 'rollup.config.mjs']);
mkdirSync(dist, { recursive: true });
for (const name of ['wasm', 'workers']) {
  const from = join(stash, name);
  if (existsSync(from)) {
    cpSync(from, join(dist, name), { recursive: true });
  }
}
rmSync(stash, { recursive: true, force: true });

console.log('[llama-cpp-capacitor] build:js complete (wasm preserved if present)');
