#!/usr/bin/env node
/**
 * Assemble a publishable llama-cpp-pro tarball with mobile + desktop binaries.
 *
 * Typical flow:
 *   Mac:     ./build-variants.sh --variant minimal --with-desktop --desktop-arch=universal
 *   Windows: npm run build:sidecar:win && npm run stage:desktop
 *   Linux:   scripts/build-sidecar-linux-docker.bat   (or build on Linux host)
 *   Then:    node scripts/assemble-npm-release.mjs --from-npm=0.2.3 --bump [--publish]
 *
 * --from-npm=VERSION  Seed from published tarball (iOS/Android/WASM/darwin), then
 *                     overlay local staged win32/linux (+ plugins).
 * --bump              Patch-bump package.json version before packing.
 * --require-linux     Fail if local linux-x64 is missing (default: true when flag set).
 * --publish           Run npm publish after packing (requires npm login).
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stageRoot = join(root, '.release-stage');
const pkgDir = join(stageRoot, 'package');

function argFlag(name) {
  return process.argv.includes(`--${name}`);
}
function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const fromNpm = argValue('from-npm') || '0.2.3';
const bump = argFlag('bump');
const doPublish = argFlag('publish');
const requireLinux = argFlag('require-linux') || true; // always want linux for this release path

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function ensureSidecar(name) {
  const p = join(pkgDir, 'extraResources', 'sidecar', name);
  if (!existsSync(p)) {
    console.error(`Missing required sidecar after assemble: extraResources/sidecar/${name}`);
    process.exit(1);
  }
  console.log(`  OK ${name}`);
}

function overlayTree(srcDir, dstDir) {
  if (!existsSync(srcDir)) return 0;
  let n = 0;
  mkdirSync(dstDir, { recursive: true });
  for (const name of readdirSync(srcDir)) {
    const sp = join(srcDir, name);
    const dp = join(dstDir, name);
    const st = statSync(sp);
    if (st.isDirectory()) {
      n += overlayTree(sp, dp);
    } else {
      copyFileSync(sp, dp);
      console.log(`Overlayed ${sp.replace(root + '\\', '').replace(root + '/', '')}`);
      n += 1;
    }
  }
  return n;
}

mkdirSync(stageRoot, { recursive: true });

const tgz = join(stageRoot, `llama-cpp-pro-${fromNpm}.tgz`);
if (!existsSync(tgz)) {
  console.log(`Fetching llama-cpp-pro@${fromNpm}…`);
  run('npm', ['pack', `llama-cpp-pro@${fromNpm}`], { cwd: stageRoot });
}

if (existsSync(pkgDir)) rmSync(pkgDir, { recursive: true, force: true });
run('tar', ['-xzf', tgz], { cwd: stageRoot });

const localSidecar = join(root, 'extraResources', 'sidecar');
const stageSidecar = join(pkgDir, 'extraResources', 'sidecar');
mkdirSync(stageSidecar, { recursive: true });

// Overlay entire local sidecar tree (win32, linux, plugins, openblas, ggml runtime libs)
const overlaid = overlayTree(localSidecar, stageSidecar);
console.log(`Overlayed ${overlaid} local sidecar file(s)`);

// Prefer default win32 name expected by ensure-desktop-sidecar-bundle.cjs
const winDefault = join(stageSidecar, 'win32-x64.exe');
if (!existsSync(winDefault)) {
  for (const alt of ['win32-x64-cpu.exe', 'win32-x64-vulkan-openblas.exe', 'win32-x64-vulkan.exe']) {
    const p = join(stageSidecar, alt);
    if (existsSync(p)) {
      copyFileSync(p, winDefault);
      console.log(`Promoted ${alt} → win32-x64.exe`);
      break;
    }
  }
}

const pkgJsonPath = join(pkgDir, 'package.json');
const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
if (bump) {
  const parts = String(pkg.version).split('.').map((n) => parseInt(n, 10));
  parts[2] = (parts[2] || 0) + 1;
  pkg.version = parts.join('.');
  // Keep repo package.json in sync for consumers
  const rootPkgPath = join(root, 'package.json');
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
  rootPkg.version = pkg.version;
  writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`);
  writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`Bumped version → ${pkg.version}`);
}

console.log('Verifying staged binaries…');
ensureSidecar('darwin-arm64');
ensureSidecar('darwin-x64');
ensureSidecar('win32-x64.exe');
if (requireLinux) {
  ensureSidecar('linux-x64');
}
const iosBin = join(pkgDir, 'ios', 'Frameworks', 'llama-cpp.framework', 'llama-cpp');
const andBin = join(pkgDir, 'android', 'src', 'main', 'jniLibs', 'arm64-v8a', 'libllama-cpp-arm64.so');
if (!existsSync(iosBin)) {
  console.error('Missing iOS framework binary');
  process.exit(1);
}
if (!existsSync(andBin)) {
  console.error('Missing Android .so');
  process.exit(1);
}
console.log('  OK iOS framework');
console.log('  OK Android jniLibs');

console.log(`Packing llama-cpp-pro@${pkg.version}…`);
run('npm', ['pack', '--ignore-scripts'], { cwd: pkgDir });

const outTgz = join(pkgDir, `llama-cpp-pro-${pkg.version}.tgz`);
const destTgz = join(stageRoot, `llama-cpp-pro-${pkg.version}.tgz`);
if (existsSync(outTgz)) {
  copyFileSync(outTgz, destTgz);
  console.log(`Wrote ${destTgz}`);
}

if (doPublish) {
  console.log('Publishing…');
  // Publish the packed tarball with --ignore-scripts so prepublishOnly
  // (npm run build) does not wipe staged dist/wasm or fail on missing
  // rollup.config.mjs (dev-only, not in the package files list).
  run('npm', ['publish', destTgz, '--access', 'public', '--ignore-scripts']);
  console.log(`Published llama-cpp-pro@${pkg.version}`);
} else {
  console.log('Dry pack complete. Re-run with --publish after `npm login`.');
}
