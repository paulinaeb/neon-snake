import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import type { ServerConfig } from './config';

// Connects the Admin SDK to the Firestore Emulator. FIRESTORE_EMULATOR_HOST is set before the
// client is created, so no credentials are needed and no request can go to production Firestore.
// Credential discovery would still probe the Google Cloud metadata server; that is switched off.
export const connectFirestoreEmulator = (
  config: Pick<ServerConfig, 'projectId' | 'firestoreEmulatorHost'>,
  appName = 'neon-snake-analytics'
): { db: Firestore; close: () => Promise<void> } => {
  process.env.FIRESTORE_EMULATOR_HOST = config.firestoreEmulatorHost;
  process.env.METADATA_SERVER_DETECTION = 'none';
  const app: App = initializeApp({ projectId: config.projectId }, appName);
  const db = getFirestore(app);
  return { db, close: () => deleteApp(app) };
};

// Waits until the emulator answers so the backend can be started alongside it (e.g. pnpm dev:all).
export const waitForEmulator = async (host: string, timeoutMs = 60_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await fetch(`http://${host}/`, { signal: AbortSignal.timeout(1_000) });
      return;
    } catch {
      if (Date.now() > deadline) {
        throw new Error(`Firestore Emulator is not reachable at ${host}. Start it with "pnpm emulators".`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
};
