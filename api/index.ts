import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from '../server/app.ts';
import { ensureInitialRealSync } from '../server/collector.ts';
import { store } from '../server/store.ts';

const app = createApiApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Only bootstrap on cold start if seed data was not bundled
  if (store.getState().alumni.length === 0) {
    await ensureInitialRealSync().catch((err) => {
      console.error('[vercel] Initial sync fallback error:', err);
    });
  }
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
