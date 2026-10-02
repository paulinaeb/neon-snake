// Subset of the Famobi GameInterface used by this game.
// Reference: https://docs.famobi.com/api

export type EventParams = {
  metrics?: Record<string, number | string | boolean | null>;
};

export type ScoreType = 'live' | 'total' | 'level' | 'stage';

export type GameEndReason = 'complete' | 'fail' | 'quit';

export interface FamobiStorage {
  getItem(key: string): unknown;
  setItem(key: string, value: unknown): void;
  removeItem(key: string): void;
  clear(): void;
}

export interface FamobiGameInterface {
  init(load: (string | (() => void))[]): Promise<void>;
  sendPreloadProgress(progress: number): void;
  gameReady(isPlayerReady?: boolean): void;

  gameStart(level?: number, params?: EventParams): Promise<void>;
  gameEnd(reason: GameEndReason, params?: EventParams): Promise<void>;
  gameFinished(params?: EventParams): Promise<void>;
  gamePause(params?: EventParams): Promise<void>;
  gameResume(params?: EventParams): Promise<void>;

  sendScore(score: number, params?: { type?: ScoreType; level?: number; stage?: number }): void;
  sendProgress(progress: number): void;

  onGoToHome(callback: () => void): void;
  onGoToNextLevel(callback: () => void): void;
  onGoToLevel(callback: (level: number) => void): void;
  onRestartGame(callback: () => void): void;
  onQuitGame(callback: () => void): void;
  onGameOver(callback: () => void): void;

  gameMuted(isMuted?: boolean): void;
  isMuted(): boolean;
  onMuteStateChange(callback: (isMuted: boolean) => void): void;
  isPaused(): boolean;
  onPauseStateChange(callback: (isPaused: boolean) => void): void;

  storage: FamobiStorage;

  player: {
    openLoginDialog(): Promise<void>;
  };

  hasFeature(feature: Feature): boolean;
  getCopyrightLogoURL(size?: LogoSize, theme?: LogoTheme): string;
  log(...args: unknown[]): void;
}

export type Feature =
  | 'audio'
  | 'pause'
  | 'score'
  | 'progress'
  | 'credits'
  | 'version'
  | 'privacy'
  | 'copyright'
  | 'visibilitychange'
  | 'login';

export type LogoSize = 'small' | 'medium' | 'large' | 'xlarge';

export type LogoTheme = 'light' | 'dark';

declare global {
  interface Window {
    GameInterface: FamobiGameInterface;
  }
}
