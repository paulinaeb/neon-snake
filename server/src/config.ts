export type ServerConfig = {
  port: number;
  projectId: string;
  firestoreEmulatorHost: string;
};

export const DEFAULT_PROJECT_ID = 'demo-neon-snake';
export const DEFAULT_FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

// This backend only ever talks to the Firestore Emulator. Firebase treats `demo-*` project IDs as
// emulator-only, so even a misconfigured environment cannot reach a real project.
export const readConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => {
  const projectId = env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
  const firestoreEmulatorHost = env.FIRESTORE_EMULATOR_HOST || DEFAULT_FIRESTORE_EMULATOR_HOST;
  const port = Number(env.PORT || 3001);

  if (!projectId.startsWith('demo-')) {
    throw new Error(`FIREBASE_PROJECT_ID must be a local demo-* project ID, got "${projectId}".`);
  }
  if (!/^[\w.-]+:\d+$/.test(firestoreEmulatorHost)) {
    throw new Error(`FIRESTORE_EMULATOR_HOST must be host:port, got "${firestoreEmulatorHost}".`);
  }
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT must be a valid port number, got "${env.PORT}".`);
  }
  return { port, projectId, firestoreEmulatorHost };
};
