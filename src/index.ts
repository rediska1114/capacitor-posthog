import { registerPlugin } from '@capacitor/core';

import type { CapacitorPosthogPlugin } from './definitions';

const CapacitorPosthog = registerPlugin<CapacitorPosthogPlugin>('CapacitorPosthog', {
  web: () => import('./web').then((m) => new m.CapacitorPosthogWeb()),
});

export * from './definitions';
export { CapacitorPosthog };
