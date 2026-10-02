import type { GameController } from '../../application/GameController';
import type { SessionLifecycle } from '../../application/sessionLifecycle';
import type { FamobiGameInterface } from './GameInterface';

// Feature flags are constant for a session and read once (https://docs.famobi.com/ui, /misc, /player).
export type FamobiFeatures = {
  audio: boolean;
  pause: boolean;
  score: boolean;
  progress: boolean;
  copyright: boolean;
  login: boolean;
  visibilitychange: boolean;
};

export const readFamobiFeatures = (sdk: FamobiGameInterface): FamobiFeatures => ({
  audio: sdk.hasFeature('audio'),
  pause: sdk.hasFeature('pause'),
  score: sdk.hasFeature('score'),
  progress: sdk.hasFeature('progress'),
  copyright: sdk.hasFeature('copyright'),
  login: sdk.hasFeature('login'),
  visibilitychange: sdk.hasFeature('visibilitychange')
});

// Level progress (0–1) as the integer percentage reported to Famobi.
const toPercent = (progress: number): number => Math.round(Math.min(1, Math.max(0, progress)) * 100);

// Lifecycle events: https://docs.famobi.com/game
export const createFamobiLifecycle = (sdk: FamobiGameInterface): SessionLifecycle => {
  let finishedReported = false;

  return {
    gameStart: (level) => sdk.gameStart(level),
    // Balancing metrics (https://docs.famobi.com/analytics), from the same run summary the game's analytics use.
    gameEnd: (run) =>
      sdk.gameEnd(run.reason, {
        metrics: { duration: run.durationMs, score: run.score, progress: toPercent(run.progress), level: run.level }
      }),
    gameFinished: async () => {
      // gameFinished marks full completion and may only be reported once per session.
      if (finishedReported) return;
      finishedReported = true;
      await sdk.gameFinished();
    },
    gamePause: () => sdk.gamePause(),
    gameResume: () => sdk.gameResume()
  };
};

export const connectFamobi = (
  sdk: FamobiGameInterface,
  controller: GameController,
  features: FamobiFeatures
): void => {
  // Loading (https://docs.famobi.com/start, /game): all game code is loaded once the scene is created.
  controller.events.on('ready', () => {
    sdk.sendPreloadProgress(100);
    sdk.gameReady();
  });

  // Score and progress (https://docs.famobi.com/game Game-08, Game-09).
  controller.events.on('scoreChanged', ({ score, level }) => sdk.sendScore(score, { level }));
  let reportedProgress: number | null = null;
  controller.events.on('progressChanged', ({ progress }) => {
    const percent = toPercent(progress);
    if (percent === reportedProgress) return;
    reportedProgress = percent;
    sdk.sendProgress(percent);
  });

  // External (master) pause and mute (https://docs.famobi.com/pause, /audio), plus pausing and muting
  // while the page is hidden unless the platform disables it (https://docs.famobi.com/misc Miscellaneous-03).
  let platformPaused = sdk.isPaused();
  let platformMuted = sdk.isMuted();
  let pageHidden = features.visibilitychange && document.hidden;
  const syncSystemState = (): void => {
    controller.setSystemPaused(platformPaused || pageHidden);
    controller.setSystemMuted(platformMuted || pageHidden);
  };
  sdk.onPauseStateChange((isPaused) => {
    platformPaused = isPaused;
    syncSystemState();
  });
  sdk.onMuteStateChange((isMuted) => {
    platformMuted = isMuted;
    syncSystemState();
  });
  if (features.visibilitychange) {
    document.addEventListener('visibilitychange', () => {
      pageHidden = document.hidden;
      if (!pageHidden) {
        // Another pause or mute (e.g. a running ad) may still be active when the page becomes visible again.
        platformPaused = sdk.isPaused();
        platformMuted = sdk.isMuted();
      }
      syncSystemState();
    });
  }
  syncSystemState();

  // Player mute reporting (https://docs.famobi.com/audio). Without audio controls the player cannot unmute,
  // so a stored player mute is not applied.
  if (!features.audio) controller.setPlayerMuted(false);
  let playerMuted = controller.getAudioState().playerMuted;
  sdk.gameMuted(playerMuted);
  controller.events.on('audioChanged', (state) => {
    if (state.playerMuted === playerMuted) return;
    playerMuted = state.playerMuted;
    sdk.gameMuted(playerMuted);
  });

  // Platform requests (https://docs.famobi.com/requests).
  sdk.onGoToHome(() => controller.quitToMenu());
  sdk.onQuitGame(() => controller.quitToMenu());
  sdk.onGoToNextLevel(() => controller.goToNextLevel());
  sdk.onGoToLevel((level) => controller.goToLevel(level));
  sdk.onRestartGame(() => controller.restartLevel());
  sdk.onGameOver(() => controller.forceGameOver());
};
