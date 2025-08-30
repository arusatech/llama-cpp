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
      file: 'dist/plugin.cjs.js',
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
