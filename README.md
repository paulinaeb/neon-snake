# Neon Snake

A compact browser game built with Phaser 3, TypeScript, Vite, and a DOM-based interface.

The game is integrated with the [Famobi GameInterface](https://docs.famobi.com).

## Gameplay

- Clear three increasingly fast levels.
- Eat the required number of fruit to advance.
- Avoid walls, your own trail, and level obstacles.
- Pause, resume, retry, or return to the main menu.
- Unlock levels, retain a best score, and restore mute preferences between sessions.
- Hear lightweight procedural sound effects without external audio assets.
- Play with arrow keys, WASD, swipe gestures, or the on-screen direction pad.

## Run locally

Requirements: Node.js 22 or newer, pnpm, and Java 11+ for the Firestore Emulator (the analytics backend only).

```bash
pnpm install
pnpm dev:all     # Firestore Emulator + analytics backend + game
```

| Command | Starts | URL |
| --- | --- | --- |
| `pnpm emulators` | Firestore Emulator and Emulator UI | Firestore `127.0.0.1:8080`, UI http://127.0.0.1:4000 |
| `pnpm dev:server` | Analytics backend (waits for the emulator) | http://localhost:3001 |
| `pnpm dev` | Game (Vite) | http://localhost:5173 |

The game works on its own with `pnpm dev`; without the backend, analytics delivery fails quietly (one console warning per batch).

## Checks

```bash
pnpm check          # game type check
pnpm check:server   # backend type check
pnpm test           # game, analytics and HTTP transport tests
pnpm test:server    # backend tests, on a throwaway Firestore Emulator
pnpm test:all       # both
pnpm build
pnpm preview
```

## Famobi testing

The SDK is loaded from `https://api.games.famobi.com/init.js`; on `localhost` it injects the local tester, which logs every GameInterface call to the console and shows a test menu (pause, mute, restart, next level, go to level, home, quit) once the game is ready.

Useful URL parameters:

- `?holdInit=1` holds SDK initialization; no game script loads until START is clicked.
- `?showLoadingOverlay=1` shows a loading overlay that disappears on `gameReady`.
- `?eventDelay=1000` delays the resolution of lifecycle promises to verify the game waits for them.
- `?gameId=<id>` switches the storage save slot.
- `?score=0`, `?progress=0`, `?pause=0`, `?audio=0`, `?copyright=0`, `?visibilitychange=0` turn off the corresponding `hasFeature` flags.

Locally, `getCopyrightLogoURL()` points to `gameInterfaceAssets/`, which only exists on Famobi hosting; the logo is hidden when it cannot be loaded.

## Gameplay analytics

The game records what happens in each gameplay attempt, independently of the Famobi SDK.

**Gameplay attempt (play).** A play starts when active gameplay begins on a level (Start, level select, Next level, Try again, or a platform request). It ends exactly once: when the level is completed, when the snake crashes, or when the player leaves the running level (exit from the pause menu or a platform home/quit/level request). Moving between menus while no level is running is not a play and records nothing.

**Events**

| Event | Fields | Sent when |
| --- | --- | --- |
| `gameplay_start` | `playId`, `level`, `timestamp` | Active gameplay begins |
| `score_change` | `playId`, `level`, `score`, `progress`, `timestamp` | Score or progress changes during a play (one event per change, never for unchanged values) |
| `gameplay_end` | `playId`, `level`, `result` (`complete` \| `fail` \| `quit`), `score`, `progress`, `durationMs`, `timestamp` | The play ends |

- `score` is the game's score, which carries over between levels of one game.
- `progress` is the share of the level's fruit target reached, from 0 to 1. Famobi receives the same value as a 0–100 integer.
- `playId` is a random UUID created when a play starts and shared by all of its events. A retry or the next level gets a new `playId`. It is not stored and not linked to the player; no personal data or persistent identifiers are recorded.
- `timestamp` is ISO 8601 UTC (`new Date().toISOString()`) of the moment the transition happened.
- `durationMs` is wall-clock time from the play's start to its end, including pauses. For a quit, the play ends when the player chooses to leave.

**Design.** The application controller is the only place that decides when a play starts, changes, and ends; it emits `runStarted`, `runUpdated`, and `runEnded`. The Famobi integration (`gameStart`, `gameEnd` with metrics) and the analytics module observe those same transitions, and Famobi's `gameEnd` metrics come from the same run summary as `gameplay_end`. `src/analytics/` only maps these events, tracks them with `analytics.track(event)`, and hands batches to a transport. Tracking is best effort: it never throws, never delays gameplay, and delivery errors are swallowed.

**Transport.** `HttpTransport` (`src/analytics/transports.ts`) posts each batch as `{ "events": [...] }` to `/api/analytics/events`, which Vite proxies to the backend (`server.proxy`/`preview.proxy`; override the target with `ANALYTICS_BACKEND_URL`). Delivery is best effort: one request per batch, a 5 s timeout, `keepalive` for the last batch on page close, no retries or offline buffer. A failed request is reported to `Analytics`, which swallows it (a one-line `console.warn` in development), so gameplay, lifecycle transitions and Famobi calls never wait for or depend on it. Development builds also keep events in memory: inspect `window.__neonSnakeAnalytics.events` in the browser console. Production builds only post when built with `VITE_ANALYTICS_ENDPOINT` set (the hosted game has no backend) and otherwise use a no-op transport.

**Tests.** `pnpm test` runs `src/analytics/gameplayAnalytics.test.ts` against the real controller and simulation: start, score changes, complete, fail, quit, retry and next level (new `playId`s), menu navigation without a play, Famobi metrics matching the analytics summary, batching, and failing transports not affecting gameplay. `src/analytics/transports.test.ts` covers the HTTP transport: request shape, error statuses, unreachable and hanging backends.

## Analytics backend

`server/` is a separate pnpm workspace package: TypeScript, Express 5, Firebase Admin SDK and Zod, run with `tsx`. It talks only to the **Firestore Emulator**; no Firebase project, login, credentials or service-account file is needed.

```text
browser ── POST /api/analytics/events ──> Vite proxy ──> Express (server/src/app.ts)
                                                           │  Zod validation (schema.ts)
                                                           ▼
                                           FirestoreAnalyticsStore (store.ts) ──> Firestore Emulator
GET /api/analytics/overview|levels <── aggregate.ts <── gameplay_end events
```

### API

| Method & path | Purpose | Responses |
| --- | --- | --- |
| `POST /api/analytics/events` | Store a batch `{ "events": [...] }` (1–100 events) | `201 { "accepted": n }`; `400 invalid_events` / `invalid_json`; `413` body > 64 kB; `415` not JSON |
| `GET /api/analytics/overview` | Totals over all finished plays | `200 { totalPlays, completedPlays, failedPlays, quitPlays, completionRate, averageScore, averageProgress, averageDurationMs }` |
| `GET /api/analytics/levels` | The same metrics per level, ordered by level | `200 [{ level, plays, completed, failed, quit, completionRate, averageScore, averageProgress, averageDurationMs }]` |
| `GET /api/health` | Liveness | `200 { "status": "ok" }` |

Errors have the form `{ "error": { "code", "message", "issues"?: [{ "path", "message" }] } }`. Unexpected failures return a generic `500 internal_error`; stack traces stay in the server log.

### Validation

Every event in the batch is validated before anything is stored, and the batch is **all-or-nothing**: one invalid event rejects the whole request with `400` listing each problem by path (e.g. `events.3.result`). Valid batches are written in a single Firestore batch, so storage is atomic too.

- `type` is `gameplay_start`, `score_change` or `gameplay_end`; each type accepts exactly its fields, and unknown fields are rejected rather than stored.
- `playId` is a UUID; `level` a positive integer; `timestamp` an ISO 8601 UTC date-time.
- `score` is a non-negative integer, `progress` a number from 0 to 1, `durationMs` a number ≥ 0; non-numbers, NaN and Infinity are rejected.
- `result` is `complete`, `fail` or `quit`.

### Firestore data

```text
analyticsEvents/{auto-generated ID}
  type        string     gameplay_start | score_change | gameplay_end
  playId      string     UUID shared by all events of one play
  level       number
  timestamp   timestamp  when the gameplay activity happened (client clock)
  receivedAt  timestamp  when the backend stored it (server timestamp)
  score       number     score_change, gameplay_end
  progress    number     score_change, gameplay_end
  result      string     gameplay_end
  durationMs  number     gameplay_end
```

One document per raw event; raw events are the source of truth and dashboards are computed from them. Document IDs are generated by Firestore (`playId` is not unique per document). There are no player or user records. `server/firestore.rules` denies all client access; only the backend writes, through the Admin SDK.

The read endpoints query `gameplay_end` events, the canonical record of a finished play. A play counts once even if its `gameplay_end` was stored twice; plays that started but never ended are not counted.

### Emulator safety

- Configuration lives in `server/firebase.json` (Firestore `127.0.0.1:8080`, UI `127.0.0.1:4000`) and `server/.firebaserc`.
- The project ID is `demo-neon-snake`. Firebase treats `demo-*` projects as emulator-only, and the backend refuses to start with any other project ID (`FIREBASE_PROJECT_ID`).
- The backend always sets `FIRESTORE_EMULATOR_HOST` (default `127.0.0.1:8080`) before creating the Firestore client, so it has no code path to production Firestore. It also disables the Google Cloud metadata-server probe that credential discovery would otherwise make.
- `pnpm test:server` starts a separate emulator from `server/firebase.test.json` (port 8180, project `demo-neon-snake-test`) via `firebase emulators:exec`, so tests never touch development data and can run while `pnpm dev:all` is up.
- `firebase-tools` is a dev dependency; no global install or `firebase login` is needed.

### Verify stored events

1. `pnpm dev:all`, open http://localhost:5173 and play (start, crash, retry, quit from the pause menu).
2. Open the Emulator UI at http://127.0.0.1:4000/firestore. The `analyticsEvents` collection shows one document per event with `timestamp` and `receivedAt`.
3. Check the aggregates at http://localhost:5173/api/analytics/overview and http://localhost:5173/api/analytics/levels (or port 3001 directly).

Emulator data is in memory and cleared when the emulator stops.

### Assumptions and limitations

- Emulator-only by design: deploying requires a real project, credentials, CORS or same-origin hosting, and authentication or rate limiting for the write endpoint, none of which is included.
- Aggregates are computed per request from all `gameplay_end` events. That is fine for local data. At scale, it would be replaced by pre-aggregated counters or a warehouse export.
- `timestamp` comes from the player's clock and is not checked for plausibility; `receivedAt` is the trustworthy server time.
- Delivery is best effort: batches sent while the backend is down are lost (no retries or offline buffer).

## Project structure

```text
src/
├── analytics/
│   ├── Analytics.ts
│   ├── events.ts
│   ├── gameplayAnalytics.ts
│   ├── gameplayAnalytics.test.ts
│   ├── transports.test.ts
│   └── transports.ts
├── application/
│   ├── GameController.ts
│   ├── gameEvents.ts
│   └── sessionLifecycle.ts
├── core/
│   ├── audio/
│   │   └── GameAudio.ts
│   ├── events/
│   │   └── EventBus.ts
│   └── storage/
│       └── GameStorage.ts
├── game/
│   ├── input.ts
│   ├── levels.ts
│   ├── scenes/
│   │   └── SnakeScene.ts
│   ├── snakeGame.ts
│   └── types.ts
├── platform/
│   └── famobi/
│       ├── GameInterface.ts
│       └── famobiIntegration.ts
├── boot.ts
├── main.ts
└── style.css

server/
├── src/
│   ├── analytics/
│   │   ├── aggregate.ts
│   │   ├── schema.ts
│   │   └── store.ts
│   ├── app.ts
│   ├── config.ts
│   ├── firestore.ts
│   └── index.ts
├── test/
├── firebase.json
├── firebase.test.json
└── firestore.rules
```

The game simulation remains independent from Phaser. An application controller coordinates commands, persistence, audio, and domain events. The Phaser scene adapts simulation state into graphics and input, while the HUD and menus remain accessible DOM elements.

Player preferences, the best score, completed runs, and unlocked levels are saved locally. Audio is generated in the browser without external media files.

The included workflow builds and deploys the game whenever the default branch is updated.

## License

MIT
