import { registerPlugin } from '@capacitor/core';

import type { LlamaCppPlugin } from './definitions';

const LlamaCpp = registerPlugin<LlamaCppPlugin>('LlamaCpp', {
  web: () => import('./web').then((m) => new m.LlamaCppWeb()),
});

export * from './definitions';
export { LlamaCpp };
