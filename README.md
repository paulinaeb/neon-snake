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

Requirements: Node.js 22 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Then open the local URL printed by Vite.

## Checks

```bash
pnpm check
pnpm test
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

**Transport.** In development builds events are kept in memory: inspect `window.__neonSnakeAnalytics.events` in the browser console, where each event is also printed with `console.debug`. Production builds currently use a no-op transport. Task 3 replaces it with an HTTP transport posting batches to `POST /api/analytics/events` on the Node.js backend; gameplay code does not change.

**Tests.** `pnpm test` runs `src/analytics/gameplayAnalytics.test.ts` against the real controller and simulation: start, score changes, complete, fail, quit, retry and next level (new `playId`s), menu navigation without a play, Famobi metrics matching the analytics summary, batching, and failing transports not affecting gameplay. The same flows were also checked in the browser through `window.__neonSnakeAnalytics`.

## Project structure

```text
src/
├── analytics/
│   ├── Analytics.ts
│   ├── events.ts
│   ├── gameplayAnalytics.ts
│   ├── gameplayAnalytics.test.ts
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
```

The game simulation remains independent from Phaser. An application controller coordinates commands, persistence, audio, and domain events. The Phaser scene adapts simulation state into graphics and input, while the HUD and menus remain accessible DOM elements.

Player preferences, the best score, completed runs, and unlocked levels are saved locally. Audio is generated in the browser without external media files.

The included workflow builds and deploys the game whenever the default branch is updated.

## License

MIT
