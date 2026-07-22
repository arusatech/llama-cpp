/**
 * TypeScript emits extensionless relative imports under moduleResolution:node.
 * Native ESM (Node + Vite exclude) needs explicit .js suffixes.
 */
const { readdirSync, readFileSync, writeFileSync, statSync } = require('node:fs');
const { join, extname } = require('node:path');

const esmRoot = join(__dirname, '..', 'dist', 'esm');

const IMPORT_RE =
  /(from\s+|import\s*\(\s*|export\s+\*\s+from\s+|export\s+\{[^}]*\}\s+from\s+)(['"])(\.[^'"]+?)\2/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (extname(p) === '.js') out.push(p);
  }
  return out;
}

function rewrite(source) {
  return source.replace(IMPORT_RE, (full, prefix, quote, spec) => {
    if (/\.(js|mjs|cjs|json|wasm)(\?|$)/.test(spec)) return full;
    return `${prefix}${quote}${spec}.js${quote}`;
  });
}

if (!statSync(esmRoot, { throwIfNoEntry: false })?.isDirectory()) {
  console.warn('[llama-cpp-pro] fix-esm-extensions: dist/esm missing');
  process.exit(0);
}

let changed = 0;
for (const file of walk(esmRoot)) {
  const before = readFileSync(file, 'utf8');
  const after = rewrite(before);
  if (after !== before) {
    writeFileSync(file, after);
    changed += 1;
  }
}

console.log(`[llama-cpp-pro] fixed ESM import extensions in ${changed} file(s)`);
