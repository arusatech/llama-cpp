#!/usr/bin/env node
/**
 * Optional internal dev: push native iOS artifacts + fresh tarball into annadata-app.
 *
 * Usage (from annadata-llama-cpp):
 *   npm run sync:dev:annadata-app:native
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.resolve(root, '..', 'annadata-app');
const pluginDir = path.join(appRoot, 'node_modules', 'llama-cpp-capacitor');
const tgzName = 'llama-cpp-capacitor-0.2.0-rc.0.tgz';
const tgzPath = path.join(root, tgzName);

function run(cmd, cwd = root) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

if (!fs.existsSync(appRoot)) {
  console.error(`annadata-app not found at ${appRoot}`);
  process.exit(1);
}

run('npm run pack:full');
run(`npm install file:${tgzPath}`, appRoot);
run('bash node_modules/llama-cpp-capacitor/scripts/ensure-llama-ios-xcframework.sh', appRoot);

const srcXcf = path.join(root, 'ios/Frameworks/llama-cpp.framework');
const dstFw = path.join(pluginDir, 'ios/Frameworks');
if (fs.existsSync(path.join(srcXcf, 'llama-cpp'))) {
  fs.mkdirSync(dstFw, { recursive: true });
  run(`rm -rf "${path.join(dstFw, 'llama-cpp.framework')}"`);
  run(`cp -R "${srcXcf}" "${dstFw}/"`);
} else {
  console.warn('No ios/Frameworks/llama-cpp.framework in plugin repo — device framework not copied.');
}

run('npx cap sync ios', appRoot);
console.log('\nNative sync complete. Clean-build the iOS app in Xcode (Product → Clean Build Folder).');
