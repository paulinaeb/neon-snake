import { FirestoreAnalyticsStore } from './analytics/store';
import { createApp } from './app';
import { readConfig } from './config';
import { connectFirestoreEmulator, waitForEmulator } from './firestore';

const main = async () => {
  const config = readConfig();
  console.log(`[analytics] waiting for Firestore Emulator at ${config.firestoreEmulatorHost} (project ${config.projectId})`);
  await waitForEmulator(config.firestoreEmulatorHost);

  const { db, close } = connectFirestoreEmulator(config);
  const server = createApp(new FirestoreAnalyticsStore(db)).listen(config.port, () => {
    console.log(`[analytics] backend listening on http://localhost:${config.port}`);
  });

  const shutdown = () => {
    server.close(() => void close().finally(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

main().catch((error: unknown) => {
  console.error('[analytics] failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
