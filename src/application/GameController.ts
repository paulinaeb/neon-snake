import { GameAudio } from '../core/audio/GameAudio';
import { EventBus } from '../core/events/EventBus';
import type { GameStorage, PlayerProfile } from '../core/storage/GameStorage';
import { LEVELS } from '../game/levels';
import { SnakeGame } from '../game/snakeGame';
import type { Direction, GameListener, GameSnapshot, PauseSource } from '../game/types';
import type { GameEventMap, RunEndReason } from './gameEvents';
import { immediateLifecycle, type SessionLifecycle, type SessionMetrics } from './sessionLifecycle';

const isActive = (snapshot: GameSnapshot): boolean => snapshot.phase === 'playing' || snapshot.phase === 'paused';

const beginsRun = (previous: GameSnapshot, next: GameSnapshot): boolean =>
  next.phase === 'playing' && ['menu', 'level-complete', 'game-over', 'finished'].includes(previous.phase);

const terminalReason = (snapshot: GameSnapshot): RunEndReason | null => {
  if (snapshot.phase === 'level-complete' || snapshot.phase === 'finished') return 'complete';
  if (snapshot.phase === 'game-over') return 'fail';
  if (snapshot.phase === 'menu') return 'quit';
  return null;
};

export class GameController {
  readonly events = new EventBus<GameEventMap>();

  private readonly audio: GameAudio;
  private profile: PlayerProfile;
  private previousSnapshot: GameSnapshot;
  private runStartedAt: number | null = null;
  private playerPauseActive = false;
  private systemPauseActive = false;
  private systemMuted = false;
  private ready = false;
  private transitions: Promise<void> = Promise.resolve();
  private transitionPending = false;
  private leavingRun = false;
  private playerPauseEnabled = true;

  constructor(
    private readonly simulation: SnakeGame,
    private readonly storage: GameStorage,
    private readonly lifecycle: SessionLifecycle = immediateLifecycle,
    private readonly log: (...args: unknown[]) => void = console.error
  ) {
    this.profile = storage.loadProfile();
    this.audio = new GameAudio(this.profile.playerMuted);
    this.previousSnapshot = simulation.getSnapshot();
    simulation.subscribe(this.handleSnapshot);
  }

  getSnapshot(): GameSnapshot {
    return this.simulation.getSnapshot();
  }

  getProfile(): Readonly<PlayerProfile> {
    return this.profile;
  }

  getAudioState(): { playerMuted: boolean; systemMuted: boolean; effectiveMuted: boolean } {
    return {
      playerMuted: this.audio.isPlayerMuted,
      systemMuted: this.systemMuted,
      effectiveMuted: this.audio.isEffectivelyMuted
    };
  }

  subscribe(listener: GameListener): () => void {
    return this.simulation.subscribe(listener);
  }

  markReady(): void {
    if (this.ready) return;
    this.ready = true;
    this.events.emit('ready', { occurredAt: Date.now() });
  }

  startNewGame(): void {
    this.runTransition(async () => {
      await this.leaveActiveRun();
      await this.beginRun(1, () => this.simulation.start());
    });
  }

  startAtLevel(level: number): void {
    const highestAllowedLevel = Math.min(this.profile.highestUnlockedLevel, LEVELS.length);
    if (!Number.isInteger(level) || level < 1 || level > highestAllowedLevel) return;
    this.goToLevel(level);
  }

  goToLevel(level: number): void {
    if (!Number.isInteger(level) || level < 1 || level > LEVELS.length) return;
    this.runTransition(() => this.switchToLevel(level));
  }

  restartLevel(): void {
    this.runTransition(async () => {
      const { level } = this.simulation.getSnapshot();
      await this.leaveActiveRun();
      await this.beginRun(level, () => this.simulation.restartLevel());
    });
  }

  goToNextLevel(): void {
    this.runTransition(async () => {
      const snapshot = this.simulation.getSnapshot();
      if (isActive(snapshot)) {
        await this.switchToLevel(Math.min(LEVELS.length, snapshot.level + 1));
        return;
      }
      if (snapshot.phase !== 'level-complete') return;
      await this.beginRun(snapshot.level + 1, () => this.simulation.nextLevel());
    });
  }

  quitToMenu(): void {
    this.runTransition(async () => {
      await this.leaveActiveRun();
      this.playerPauseActive = false;
      this.simulation.quitToMenu();
    });
  }

  forceGameOver(): void {
    // A run that is already being quit cannot also fail.
    if (this.leavingRun) return;
    this.playerPauseActive = false;
    this.simulation.forceGameOver();
  }

  move(direction: Direction): void {
    this.simulation.setDirection(direction);
  }

  tick(): void {
    if (this.leavingRun) return;
    this.simulation.step();
  }

  togglePlayerPause(): void {
    // While the platform holds the game paused, player pause input is ignored.
    if (!this.playerPauseEnabled || !isActive(this.simulation.getSnapshot()) || this.systemPauseActive) return;
    this.runTransition(async () => {
      const pausing = !this.playerPauseActive;
      await (pausing ? this.lifecycle.gamePause() : this.lifecycle.gameResume());
      if (!isActive(this.simulation.getSnapshot())) return;
      this.playerPauseActive = pausing;
      this.reconcilePauseState();
    });
  }

  // Platforms may remove the player pause entirely; external pauses keep working.
  setPlayerPauseEnabled(enabled: boolean): void {
    this.playerPauseEnabled = enabled;
  }

  setSystemPaused(paused: boolean): void {
    if (this.systemPauseActive === paused) return;
    this.systemPauseActive = paused;
    this.reconcilePauseState();
  }

  togglePlayerMuted(): void {
    this.setPlayerMuted(!this.audio.isPlayerMuted);
  }

  setPlayerMuted(muted: boolean): void {
    if (this.audio.isPlayerMuted === muted) return;
    this.audio.setPlayerMuted(muted);
    this.profile = { ...this.profile, playerMuted: muted };
    this.persistProfile();
    this.emitAudioState();
  }

  setSystemMuted(muted: boolean): void {
    if (this.systemMuted === muted) return;
    this.systemMuted = muted;
    this.audio.setSystemMuted(muted);
    this.emitAudioState();
  }

  dispose(): void {
    this.audio.dispose();
    this.events.clear();
  }

  private handleSnapshot = (snapshot: GameSnapshot): void => {
    const previous = this.previousSnapshot;
    const now = Date.now();

    if (beginsRun(previous, snapshot)) {
      this.runStartedAt = now;
      this.profile = { ...this.profile, totalRuns: this.profile.totalRuns + 1 };
      this.persistProfile();
      this.events.emit('runStarted', {
        level: snapshot.level,
        runNumber: this.profile.totalRuns,
        occurredAt: now
      });
    }

    if (snapshot.score !== previous.score) {
      const delta = snapshot.score - previous.score;
      if (delta > 0) this.audio.play('fruit');
      if (snapshot.score > this.profile.bestScore) {
        this.profile = { ...this.profile, bestScore: snapshot.score };
        this.persistProfile();
      }
      this.events.emit('scoreChanged', { level: snapshot.level, score: snapshot.score, delta });
    }

    if (snapshot.progress !== previous.progress || snapshot.level !== previous.level) {
      this.events.emit('progressChanged', {
        level: snapshot.level,
        progress: snapshot.progress,
        collected: snapshot.fruitEaten,
        target: snapshot.target
      });
    }

    const endReason = terminalReason(snapshot);
    if (endReason && isActive(previous) && this.runStartedAt !== null) {
      const durationMs = Math.max(0, now - this.runStartedAt);
      this.events.emit('runEnded', {
        level: previous.level,
        score: snapshot.score,
        progress: endReason === 'complete' ? 1 : previous.progress,
        reason: endReason,
        durationMs,
        occurredAt: now
      });
      this.runStartedAt = null;

      // Quits are reported by leaveActiveRun() before the run is left.
      if (endReason !== 'quit') {
        const metrics = this.runMetrics(snapshot, durationMs);
        const finished = snapshot.phase === 'finished';
        this.enqueue(async () => {
          await this.lifecycle.gameEnd(endReason, metrics);
          if (finished) await this.lifecycle.gameFinished();
        });
      }

      if (endReason === 'complete') {
        const highestUnlockedLevel = Math.min(LEVELS.length, snapshot.level + 1);
        if (highestUnlockedLevel > this.profile.highestUnlockedLevel) {
          this.profile = { ...this.profile, highestUnlockedLevel };
          this.persistProfile();
        }
        this.audio.play(snapshot.phase === 'finished' ? 'finished' : 'level-complete');
      } else if (endReason === 'fail') {
        this.audio.play('game-over');
      }
    }

    const pauseChanged = snapshot.phase === 'paused' !== (previous.phase === 'paused');
    const pauseSourceChanged = snapshot.pauseSource !== previous.pauseSource;
    if (pauseChanged || pauseSourceChanged) {
      this.events.emit('pauseChanged', {
        paused: snapshot.phase === 'paused',
        source: snapshot.pauseSource
      });
    }

    if (snapshot.phase === 'finished' && previous.phase !== 'finished') {
      this.events.emit('gameFinished', { score: snapshot.score, bestScore: this.profile.bestScore });
    }

    this.previousSnapshot = snapshot;
    this.events.emit('stateChanged', snapshot);
  };

  private reconcilePauseState(): void {
    const pauseSource: Exclude<PauseSource, null> | null = this.systemPauseActive
      ? 'system'
      : this.playerPauseActive
        ? 'player'
        : null;

    if (pauseSource) this.simulation.pause(pauseSource);
    else this.simulation.resume();
  }

  // Commands that change the gameplay session run one at a time, and only once the game is ready;
  // input arriving meanwhile is ignored.
  private runTransition(task: () => Promise<void>): void {
    if (!this.ready || this.transitionPending) return;
    this.transitionPending = true;
    this.enqueue(async () => {
      try {
        await task();
      } finally {
        this.transitionPending = false;
      }
    });
  }

  // Transitions also wait for a pending natural gameEnd, so no screen is left before it resolves.
  private enqueue(task: () => Promise<void>): void {
    this.transitions = this.transitions.then(task).catch((error: unknown) => {
      this.log('Game transition failed', error);
    });
  }

  private async switchToLevel(level: number): Promise<void> {
    await this.leaveActiveRun();
    await this.beginRun(level, () => this.simulation.startAtLevel(level));
  }

  private async beginRun(level: number, start: () => void): Promise<void> {
    await this.lifecycle.gameStart(level);
    this.playerPauseActive = false;
    start();
    this.audio.play('start');
    // An external pause may have arrived while no run was active.
    this.reconcilePauseState();
  }

  private async leaveActiveRun(): Promise<void> {
    const snapshot = this.simulation.getSnapshot();
    if (!isActive(snapshot) || this.runStartedAt === null) return;
    // Gameplay is held until the platform has acknowledged the quit.
    this.leavingRun = true;
    try {
      await this.lifecycle.gameEnd('quit', this.runMetrics(snapshot, Math.max(0, Date.now() - this.runStartedAt)));
    } finally {
      this.leavingRun = false;
    }
    this.playerPauseActive = false;
    this.simulation.quitToMenu();
  }

  private runMetrics(snapshot: GameSnapshot, durationMs: number): SessionMetrics {
    return {
      level: snapshot.level,
      score: snapshot.score,
      fruitEaten: snapshot.fruitEaten,
      target: snapshot.target,
      durationMs
    };
  }

  private persistProfile(): void {
    this.storage.saveProfile(this.profile);
  }

  private emitAudioState(): void {
    this.events.emit('audioChanged', this.getAudioState());
  }
}
