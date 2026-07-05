import { access, readdir, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

let pkg;
try {
  pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
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
const MIN_IOS_FRAMEWORK_BYTES = 2_000_000;
const MIN_ANDROID_SO_BYTES = 2_000_000;

const requiredArtifacts = [
  {
    path: 'android/src/main/jniLibs/arm64-v8a/libllama-cpp-arm64.so',
    reason: 'Android native runtime binary (arm64)',
    minBytes: MIN_ANDROID_SO_BYTES,
  },
  {
    path: 'ios/Frameworks/llama-cpp.framework/llama-cpp',
    reason: 'iOS native framework binary (arm64 device)',
    minBytes: MIN_IOS_FRAMEWORK_BYTES,
  },
  {
    path: 'ios/Frameworks/llama-cpp.framework/Info.plist',
    reason: 'iOS framework Info.plist',
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
  {
    path: 'dist/wasm/llama_engine_emscripten.mjs',
    reason: 'PWA Emscripten runtime',
  },
  {
    path: 'dist/esm/index.js',
    reason: 'TypeScript ESM plugin entry',
  },
  {
    path: 'dist/plugin.cjs.js',
    reason: 'TypeScript CJS plugin entry',
  },
  {
    path: 'scripts/ensure-llama-ios-xcframework.sh',
    reason: 'Consumer iOS simulator xcframework builder',
  },
  {
    path: 'ios/embed-metal-shaders.sh',
    reason: 'Metal shader embed script for iOS rebuilds',
  },
  {
    path: 'ios/metal-embed.cmake',
    reason: 'Metal embed CMake fragment',
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
  console.error('Run `npm run build:package:full` and retry packaging.');
  process.exit(1);
}

if (invalid.length > 0) {
  console.error('Packaging guard failed: artifact size looks incomplete.');
  for (const artifact of invalid) {
    console.error(
      `- ${artifact.path} is ${artifact.size} bytes (expected at least ${artifact.minBytes})`,
    );
  }
  console.error('');
  console.error('Run `npm run build:package:full` to rebuild native + PWA artifacts.');
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
    if (!entries.includes('LlamaNativeBridge.swift')) {
      errors.push(`${SPM_SWIFT_DIR}/LlamaNativeBridge.swift is required for dlopen native bridge.`);
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

function verifyIosMetalSymbols() {
  const binary = resolve(root, 'ios/Frameworks/llama-cpp.framework/llama-cpp');
  let nmOut = '';
  try {
    nmOut = execFileSync('nm', [binary], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (err) {
    console.error('Packaging guard failed: could not nm iOS framework binary.');
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const required = ['_lm_ggml_metallib_start', '_lm_ggml_metallib_end', '_lm_ggml_backend_metal_reg'];
  const missingSyms = required.filter((sym) => !nmOut.includes(sym));
  if (missingSyms.length > 0) {
    console.error('Packaging guard failed: iOS framework is missing Metal symbols.');
    for (const sym of missingSyms) {
      console.error(`- ${sym}`);
    }
    console.error('');
    console.error('Rebuild with Metal embed enabled (ios/CMakeLists.txt + ios/metal-embed.cmake).');
    process.exit(1);
  }
}

async function verifyPwaWasmQuality() {
  const errors = [];
  const engineJs = await readFile(resolve(root, 'dist/wasm/llama_engine.js'), 'utf8');
  const emscriptenMjs = await readFile(resolve(root, 'dist/wasm/llama_engine_emscripten.mjs'), 'utf8');

  if (!engineJs.includes('residentFootprint + estimated')) {
    errors.push('llama_engine.js missing footprint-based WASM admission (BGE+LFM2 pool fix).');
  }
  if (!engineJs.includes('_loadedModelBytes.size === 0')) {
    errors.push('llama_engine.js missing cold-load-only async pre-grow (avoids false 2 GiB reject).');
  }
  if (!engineJs.includes('export function load_model') || !engineJs.includes('export function embed')) {
    errors.push('llama_engine.js missing expected ESM exports (load_model / embed).');
  }
  if (!emscriptenMjs.includes('__wbindgen_add_to_stack_pointer:(d)=>')) {
    errors.push('llama_engine_emscripten.mjs missing wasm-bindgen JSPI shim patch.');
  }
  if (!emscriptenMjs.includes('cap_wasm_dylink_common_init_from_params')) {
    errors.push('llama_engine_emscripten.mjs missing cap_wasm_dylink common_init wire.');
  }

  if (errors.length > 0) {
    console.error('Packaging guard failed: PWA/WASM quality checks failed.');
    for (const message of errors) {
      console.error(`- ${message}`);
    }
    console.error('');
    console.error('Run `npm run build:pwa:full` and retry.');
    process.exit(1);
  }
}

function verifyReleaseVersion() {
  const version = String(pkg.version || '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`Packaging guard failed: version "${version}" is not a stable semver (expected X.Y.Z, not -rc).`);
    console.error('Set package.json version to 0.2.0 (or another stable release) before packing.');
    process.exit(1);
  }
}

await verifyIosSpmLayout();
verifyIosMetalSymbols();
await verifyPwaWasmQuality();
verifyReleaseVersion();

console.log(
  `Packaging guard passed for llama-cpp-capacitor@${pkg.version}: iOS (Metal) + Android arm64 + PWA/WASM + SPM layout.`,
);
