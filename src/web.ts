import { WebPlugin } from '@capacitor/core';

import type { LlamaCppPlugin } from './definitions';

export class LlamaCppWeb extends WebPlugin implements LlamaCppPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }
}
