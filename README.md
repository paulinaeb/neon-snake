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

## Project structure

```text
src/
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
