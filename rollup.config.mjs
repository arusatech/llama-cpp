export default {
  input: 'dist/esm/index.js',
  output: [
    {
      file: 'dist/plugin.js',
      format: 'iife',
      name: 'capacitorLlamaCpp',
      globals: {
        '@capacitor/core': 'capacitorExports',
        'tslib': 'tslib',
      },
      sourcemap: true,
      inlineDynamicImports: true,
    },
    {
      // Must be .cjs: package.json has "type":"module", so *.js is treated as ESM.
      file: 'dist/plugin.cjs',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
    },
  ],
  external: ['@capacitor/core', 'tslib'],
  onwarn(warning, warn) {
    // Suppress the "this has been rewritten to undefined" warning
    if (warning.code === 'THIS_IS_UNDEFINED') {
      return;
    }
    warn(warning);
  },
};
