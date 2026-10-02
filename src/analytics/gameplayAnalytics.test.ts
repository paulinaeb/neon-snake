import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GameController } from '../application/GameController';
import type { RunSummary } from '../application/gameEvents';
import type { SessionLifecycle } from '../application/sessionLifecycle';
import type { GameStorage, PlayerProfile } from '../core/storage/GameStorage';
import { SnakeGame } from '../game/snakeGame';
import type { Direction, GameSnapshot } from '../game/types';
import { Analytics } from './Analytics';
import type { AnalyticsEvent } from './events';
import { connectGameplayAnalytics } from './gameplayAnalytics';
import { MemoryTransport, type AnalyticsTransport } from './transports';

const BOARD = 20;
const vectors: Record<Direction, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

class MemoryStorage implements GameStorage {
  private profile: PlayerProfile = { bestScore: 0, highestUnlockedLevel: 3, totalRuns: 0, playerMuted: true };
  loadProfile = () => this.profile;
  saveProfile = (profile: PlayerProfile) => {
    this.profile = profile;
  };
}

// Records the run summaries the platform lifecycle (Famobi in the game) receives.
const recordingLifecycle = () => {
  const ends: RunSummary[] = [];
  const lifecycle: SessionLifecycle = {
    gameStart: async () => {},
    gameEnd: async (run) => {
      ends.push(run);
    },
    gameFinished: async () => {},
    gamePause: async () => {},
    gameResume: async () => {}
  };
  return { lifecycle, ends };
};

// Shortest safe path to the fruit, falling back to any safe move.
const nextDirection = (s: GameSnapshot): Direction => {
  const head = s.snake[0];
  const key = (x: number, y: number) => `${x},${y}`;
  const blocked = new Set([...s.obstacles, ...s.snake.slice(0, -1)].map((p) => key(p.x, p.y)));
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < BOARD && y < BOARD && !blocked.has(key(x, y));
  const previous = new Map<string, [string, Direction] | null>([[key(head.x, head.y), null]]);
  const queue: [number, number][] = [[head.x, head.y]];
  const target = key(s.food.x, s.food.y);
  while (queue.length) {
    const [x, y] = queue.shift()!;
    if (key(x, y) === target) break;
    for (const direction of Object.keys(vectors) as Direction[]) {
      const [dx, dy] = vectors[direction];
      const next = key(x + dx, y + dy);
      if (!previous.has(next) && free(x + dx, y + dy)) {
        previous.set(next, [key(x, y), direction]);
        queue.push([x + dx, y + dy]);
      }
    }
  }
  if (previous.has(target)) {
    let step = target;
    while (previous.get(step)![0] !== key(head.x, head.y)) step = previous.get(step)![0];
    const direction = previous.get(step)![1];
    if (direction !== opposite[s.direction]) return direction;
  }
  return (
    (Object.keys(vectors) as Direction[]).find(
      (d) => d !== opposite[s.direction] && free(head.x + vectors[d][0], head.y + vectors[d][1])
    ) ?? s.direction
  );
};

const setup = (transport: AnalyticsTransport = new MemoryTransport(), onError?: (error: unknown) => void) => {
  const { lifecycle, ends } = recordingLifecycle();
  const controller = new GameController(new SnakeGame(), new MemoryStorage(), lifecycle, () => {});
  connectGameplayAnalytics(controller.events, new Analytics(transport, onError));
  controller.markReady();

  const memory = transport instanceof MemoryTransport ? transport : null;
  const events = () => memory!.events;
  const ofType = <T extends AnalyticsEvent['type']>(type: T) =>
    events().filter((event) => event.type === type) as Extract<AnalyticsEvent, { type: T }>[];

  const command = async (run: () => void) => {
    run();
    await settle();
  };
  const playUntilLevelEnds = async () => {
    for (let ticks = 0; ticks < 5000 && controller.getSnapshot().phase === 'playing'; ticks += 1) {
      controller.move(nextDirection(controller.getSnapshot()));
      controller.tick();
    }
    await settle();
  };
  const eatOneFruit = async () => {
    const { score } = controller.getSnapshot();
    while (controller.getSnapshot().score === score && controller.getSnapshot().phase === 'playing') {
      controller.move(nextDirection(controller.getSnapshot()));
      controller.tick();
    }
    await settle();
  };
  const crash = async () => {
    // Without steering the snake keeps going straight until it leaves the board or hits an obstacle.
    for (let ticks = 0; ticks < BOARD * 2 && controller.getSnapshot().phase === 'playing'; ticks += 1) controller.tick();
    await settle();
  };

  return { controller, ends, events, ofType, command, playUntilLevelEnds, eatOneFruit, crash };
};

const isIsoUtc = (timestamp: string) => new Date(timestamp).toISOString() === timestamp;

describe('gameplay analytics', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
    let seed = 42;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('emits one gameplay_start with level, new playId and ISO timestamp when level 1 starts', async () => {
    const game = setup();
    await game.command(() => game.controller.startNewGame());

    const starts = game.ofType('gameplay_start');
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({ type: 'gameplay_start', level: 1 });
    expect(starts[0].playId).toMatch(/^[0-9a-f-]{32,36}$/);
    expect(isIsoUtc(starts[0].timestamp)).toBe(true);
    expect(game.ofType('score_change')).toHaveLength(0);
    expect(game.ofType('gameplay_end')).toHaveLength(0);
  });

  it('emits score_change with the game score and progress for the current play', async () => {
    const game = setup();
    await game.command(() => game.controller.startNewGame());
    await game.eatOneFruit();

    const [start] = game.ofType('gameplay_start');
    const changes = game.ofType('score_change');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ playId: start.playId, level: 1, score: 10, progress: 0.2 });
    expect(changes[0]).toMatchObject({
      score: game.controller.getSnapshot().score,
      progress: game.controller.getSnapshot().progress
    });
    expect(isIsoUtc(changes[0].timestamp)).toBe(true);
  });

  it('emits exactly one gameplay_end("complete") with final score, progress and duration', async () => {
    const game = setup();
    await game.command(() => game.controller.startNewGame());
    await game.playUntilLevelEnds();

    expect(game.controller.getSnapshot().phase).toBe('level-complete');
    const [start] = game.ofType('gameplay_start');
    const ends = game.ofType('gameplay_end');
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ playId: start.playId, level: 1, result: 'complete', score: 50, progress: 1 });
    expect(ends[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(ends[0].durationMs).toBe(Date.parse(ends[0].timestamp) - Date.parse(start.timestamp));
    expect(game.ofType('score_change').map((event) => event.score)).toEqual([10, 20, 30, 40, 50]);
    expect(game.ofType('score_change').every((event) => event.playId === start.playId)).toBe(true);
  });

  it('reports the same run summary to the platform lifecycle (Famobi metrics) and to analytics', async () => {
    const game = setup();
    await game.command(() => game.controller.startNewGame());
    await game.playUntilLevelEnds();

    const [end] = game.ofType('gameplay_end');
    expect(game.ends).toHaveLength(1);
    expect(game.ends[0]).toMatchObject({
      runId: end.playId,
      reason: end.result,
      level: end.level,
      score: end.score,
      progress: end.progress,
      durationMs: end.durationMs
    });
  });

  it('emits gameplay_end("fail") when the snake crashes', async () => {
    const game = setup();
    await game.command(() => game.controller.startNewGame());
    await game.eatOneFruit();
    await game.crash();

    expect(game.controller.getSnapshot().phase).toBe('game-over');
    const [start] = game.ofType('gameplay_start');
    expect(game.ofType('gameplay_end')).toEqual([
      expect.objectContaining({ playId: start.playId, level: 1, result: 'fail', score: 10, progress: 0.2 })
    ]);
  });

  it('emits gameplay_end("quit") when the player leaves an active level', async () => {
    const game = setup();
    await game.command(() => game.controller.startNewGame());
    await game.eatOneFruit();
    await game.command(() => game.controller.togglePlayerPause());
    await game.command(() => game.controller.quitToMenu());

    expect(game.controller.getSnapshot().phase).toBe('menu');
    const [start] = game.ofType('gameplay_start');
    const ends = game.ofType('gameplay_end');
    expect(ends).toEqual([expect.objectContaining({ playId: start.playId, result: 'quit', score: 10, progress: 0.2 })]);
    // The platform was told about the quit with the identical summary before the run was left.
    expect(game.ends).toEqual([expect.objectContaining({ runId: start.playId, reason: 'quit', durationMs: ends[0].durationMs })]);
  });

  it('starts a new playId on retry', async () => {
    const game = setup();
    await game.command(() => game.controller.startNewGame());
    await game.crash();
    await game.command(() => game.controller.restartLevel());

    const starts = game.ofType('gameplay_start');
    expect(starts).toHaveLength(2);
    expect(starts[1].level).toBe(1);
    expect(starts[1].playId).not.toBe(starts[0].playId);
  });

  it('starts a new playId with the next level number', async () => {
    const game = setup();
    await game.command(() => game.controller.startNewGame());
    await game.playUntilLevelEnds();
    await game.command(() => game.controller.goToNextLevel());

    const starts = game.ofType('gameplay_start');
    expect(starts.map((event) => event.level)).toEqual([1, 2]);
    expect(starts[1].playId).not.toBe(starts[0].playId);
    // The carried-over score at the start of level 2 is not a score change.
    expect(game.ofType('score_change').filter((event) => event.playId === starts[1].playId)).toHaveLength(0);
  });

  it('does not report a quit for menu navigation without an active play', async () => {
    const game = setup();
    await game.command(() => game.controller.quitToMenu()); // already in the menu
    await game.command(() => game.controller.startNewGame());
    await game.crash();
    await game.command(() => game.controller.quitToMenu()); // game over -> menu
    await game.command(() => game.controller.startNewGame());
    await game.playUntilLevelEnds();
    await game.command(() => game.controller.quitToMenu()); // level complete -> menu

    expect(game.ofType('gameplay_end').map((event) => event.result)).toEqual(['fail', 'complete']);
    expect(game.ends.map((run) => run.reason)).toEqual(['fail', 'complete']);
  });

  it('keeps gameplay working when the transport throws or rejects', async () => {
    for (const transport of [
      { send: () => { throw new Error('offline'); } },
      { send: () => Promise.reject(new Error('offline')) }
    ] as AnalyticsTransport[]) {
      const errors: unknown[] = [];
      const game = setup(transport, (error) => errors.push(error));
      await game.command(() => game.controller.startNewGame());
      await game.playUntilLevelEnds();
      await game.command(() => game.controller.goToNextLevel());

      expect(game.controller.getSnapshot()).toMatchObject({ phase: 'playing', level: 2, score: 50 });
      expect(game.ends.map((run) => run.reason)).toEqual(['complete']);
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('batches events from the same moment into one delivery', async () => {
    const send = vi.fn<(events: AnalyticsEvent[]) => Promise<void>>(async () => {});
    const game = setup({ send });
    await game.command(() => game.controller.startNewGame());
    while (game.controller.getSnapshot().phase === 'playing') await game.eatOneFruit();

    // The final fruit produces score_change and gameplay_end in the same tick.
    const lastBatch = send.mock.calls.at(-1)![0].map((event) => event.type);
    expect(lastBatch).toEqual(['score_change', 'gameplay_end']);
  });
});

