import { WebPlugin } from '@capacitor/core';

import type { CapacitorPosthogPlugin } from './definitions';

export class CapacitorPosthogWeb extends WebPlugin implements CapacitorPosthogPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }
}
