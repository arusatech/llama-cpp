import { access, readdir, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

try {
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  if (pkg.name !== 'llama-cpp-capacitor') {
    throw new Error('wrong package');
  }
} catch {
  console.error('Packaging guard: run from the llama-cpp-capacitor plugin root (directory containing package.json).');
  console.error('Example: cd /path/to/llama-cpp-capacitor && npm run verify:pack:artifacts');
  process.exit(1);
}
const SPM_SWIFT_DIR = 'ios/Sources/LlamaCppCapacitor';
const LEGACY_SWIFT_DIR = 'ios/Sources/LlamaCppPlugin';
const MIN_EMBEDDED_WASM_BYTES = 1_000_000;

const requiredArtifacts = [
  {
    path: 'android/src/main/jniLibs/arm64-v8a/libllama-cpp-arm64.so',
    reason: 'Android native runtime binary',
  },
  {
    path: 'ios/Frameworks/llama-cpp.framework/llama-cpp',
    reason: 'iOS native framework binary',
  },
  {
    path: 'dist/wasm/llama_engine.js',
    reason: 'PWA wasm JavaScript wrapper',
  },
  {
    path: 'dist/wasm/llama_engine.wasm',
    reason: 'PWA wasm binary',
    minBytes: MIN_EMBEDDED_WASM_BYTES,
  },
];

const missing = [];
const invalid = [];

for (const artifact of requiredArtifacts) {
  const absolutePath = resolve(root, artifact.path);
  try {
    await access(absolutePath, constants.R_OK);
  } catch {
    missing.push(artifact);
    continue;
  }

  if (artifact.minBytes != null) {
    const { size } = await stat(absolutePath);
    if (size < artifact.minBytes) {
      invalid.push({
        ...artifact,
        size,
      });
    }
  }
}

if (missing.length > 0) {
  console.error('Packaging guard failed: required artifacts are missing.');
  for (const artifact of missing) {
    console.error(`- ${artifact.path} (${artifact.reason})`);
  }
  console.error('');
  console.error('Run `npm run build:package` and retry packaging.');
  process.exit(1);
}

if (invalid.length > 0) {
  console.error('Packaging guard failed: wasm binary looks like a scaffold build.');
  for (const artifact of invalid) {
    console.error(
      `- ${artifact.path} is ${artifact.size} bytes (expected at least ${artifact.minBytes} for embedded llama.cpp)`,
    );
  }
  console.error('');
  console.error('Run `npm run build:pwa` to rebuild embedded wasm assets.');
  process.exit(1);
}

async function verifyIosSpmLayout() {
  const spmDir = resolve(root, SPM_SWIFT_DIR);
  const legacyDir = resolve(root, LEGACY_SWIFT_DIR);
  const packageSwiftPath = resolve(root, 'Package.swift');
  const errors = [];

  try {
    await access(legacyDir, constants.R_OK);
    errors.push(
      `${LEGACY_SWIFT_DIR} must not be shipped — use ${SPM_SWIFT_DIR} (matches Package.swift).`,
    );
  } catch {
    /* legacy folder absent: good */
  }

  try {
    const entries = await readdir(spmDir);
    if (!entries.some((name) => name.endsWith('.swift'))) {
      errors.push(`${SPM_SWIFT_DIR} must contain at least one .swift source file.`);
    }
  } catch {
    errors.push(`${SPM_SWIFT_DIR} is missing (CapApp-SPM expects this SPM target path).`);
  }

  try {
    const packageSwift = await readFile(packageSwiftPath, 'utf8');
    if (!packageSwift.includes('LlamaCppCapacitor')) {
      errors.push('Package.swift must expose product/target LlamaCppCapacitor.');
    }
    if (!packageSwift.includes(SPM_SWIFT_DIR)) {
      errors.push(`Package.swift must reference path "${SPM_SWIFT_DIR}".`);
    }
    if (packageSwift.includes('binaryTarget') && packageSwift.includes('llama-cpp.xcframework')) {
      errors.push(
        'Package.swift must not use binaryTarget llama-cpp.xcframework — native code loads via dlopen (see LlamaNativeBridge.swift).',
      );
    }
  } catch {
    errors.push('Package.swift is missing from plugin root.');
  }

  if (errors.length > 0) {
    console.error('Packaging guard failed: iOS SPM layout is invalid.');
    for (const message of errors) {
      console.error(`- ${message}`);
    }
    console.error('');
    console.error('Fix ios/Sources layout and Package.swift in this repo, then re-run build:package.');
    process.exit(1);
  }
}

await verifyIosSpmLayout();

console.log('Packaging guard passed: native + PWA artifacts and iOS SPM layout are valid.');
