import './style.css';

import Phaser from 'phaser';

import { GameController } from './application/GameController';
import { LocalGameStorage } from './core/storage/GameStorage';
import { SnakeScene } from './game/scenes/SnakeScene';
import { SnakeGame } from './game/snakeGame';
import type { Direction, GamePhase, GameSnapshot } from './game/types';
import type { LogoSize } from './platform/famobi/GameInterface';
import { connectFamobi, createFamobiLifecycle, readFamobiFeatures } from './platform/famobi/famobiIntegration';

const requiredElement = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
};

const levelValue = requiredElement<HTMLElement>('#level-value');
const scoreValue = requiredElement<HTMLElement>('#score-value');
const bestValue = requiredElement<HTMLElement>('#best-value');
const fruitValue = requiredElement<HTMLElement>('#fruit-value');
const progressValue = requiredElement<HTMLElement>('#progress-value');
const overlay = requiredElement<HTMLElement>('#game-overlay');
const overlayEyebrow = requiredElement<HTMLElement>('#overlay-eyebrow');
const overlayTitle = requiredElement<HTMLElement>('#overlay-title');
const overlayCopy = requiredElement<HTMLElement>('#overlay-copy');
const primaryAction = requiredElement<HTMLButtonElement>('#primary-action');
const secondaryAction = requiredElement<HTMLButtonElement>('#secondary-action');
const pauseButton = requiredElement<HTMLButtonElement>('#pause-button');
const muteButton = requiredElement<HTMLButtonElement>('#mute-button');
const levelSelect = requiredElement<HTMLElement>('#level-select');
const loginAction = requiredElement<HTMLButtonElement>('#login-action');
const copyrightLogo = requiredElement<HTMLImageElement>('#copyright-logo');

// This module is loaded only after GameInterface.init() has resolved (see src/boot.ts).
const famobi = window.GameInterface;
famobi.sendPreloadProgress(0);
const log = (...args: unknown[]): void => famobi.log(...args);

const features = readFamobiFeatures(famobi);

const simulation = new SnakeGame();
const controller = new GameController(
  simulation,
  new LocalGameStorage(famobi.storage),
  createFamobiLifecycle(famobi),
  log
);
controller.setPlayerPauseEnabled(features.pause);
connectFamobi(famobi, controller, features);
const snakeScene = new SnakeScene(controller);
let currentSnapshot = controller.getSnapshot();

// UI elements the platform can hide (https://docs.famobi.com/ui UI-01, UI-02; /player Player-03).
muteButton.hidden = !features.audio;
pauseButton.hidden = !features.pause;
requiredElement<HTMLElement>('#pause-hint').hidden = !features.pause;
requiredElement<HTMLElement>('#score-stat').hidden = !features.score;
requiredElement<HTMLElement>('#best-stat').hidden = !features.score;
requiredElement<HTMLElement>('#level-stat').hidden = !features.progress;
requiredElement<HTMLElement>('#fruit-stat').hidden = !features.progress;
requiredElement<HTMLElement>('#hud').hidden = !features.score && !features.progress;

// Famobi copyright logo (https://docs.famobi.com/ui UI-03) at the smallest resolution covering its display size.
if (features.copyright) {
  const requiredPixels = 44 * window.devicePixelRatio;
  const logoSize: LogoSize =
    requiredPixels <= 64 ? 'small' : requiredPixels <= 128 ? 'medium' : requiredPixels <= 256 ? 'large' : 'xlarge';
  copyrightLogo.addEventListener('error', () => {
    copyrightLogo.hidden = true;
    log('Copyright logo could not be loaded:', copyrightLogo.src);
  });
  copyrightLogo.src = famobi.getCopyrightLogoURL(logoSize, 'dark');
  copyrightLogo.hidden = false;
}

// Phaser pauses its loop while the page is hidden; some portals require the game to keep running
// (https://docs.famobi.com/misc Miscellaneous-03).
class GameWithoutHiddenPause extends Phaser.Game {
  protected override onHidden(): void {}
  protected override onVisible(): void {}
}
const GameClass = features.visibilitychange ? Phaser.Game : GameWithoutHiddenPause;

const phaserGame = new GameClass({
  type: Phaser.AUTO,
  // Console output is not allowed in production (https://docs.famobi.com/misc Miscellaneous-01).
  banner: false,
  parent: 'game-container',
  width: 600,
  height: 600,
  backgroundColor: '#10182c',
  scene: [snakeScene],
  render: {
    antialias: true,
    pixelArt: false
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});

controller.events.on('ready', () => {
  // Blur and focus must not pause or mute; Phaser's own sound manager is otherwise unused.
  phaserGame.sound.pauseOnBlur = false;
});

const failureCopy: Record<NonNullable<GameSnapshot['failureReason']>, string> = {
  wall: 'You ran into the edge of the grid.',
  snake: 'You crossed your own trail.',
  obstacle: 'That barrier was tougher than it looked.',
  external: 'The run was ended by an external game command.'
};

// Score and level numbers only appear on result screens when the platform allows them.
const withScore = (scoreLine: string, copy: string): string => (features.score ? `${scoreLine} ${copy}` : copy);

const overlayContent: Record<
  Exclude<GamePhase, 'playing'>,
  (snapshot: GameSnapshot) => {
    eyebrow: string;
    title: string;
    copy: string;
    primary?: string;
    secondary?: string;
  }
> = {
  menu: () => ({
    eyebrow: 'Three levels',
    title: 'Ready to slither?',
    copy: 'Eat the fruit, avoid the walls, and clear every level.',
    primary: 'Start game'
  }),
  paused: (snapshot) =>
    snapshot.pauseSource === 'system'
      ? {
          eyebrow: 'Game paused',
          title: 'Please wait',
          copy: 'Gameplay will continue when the interruption has ended.'
        }
      : {
          eyebrow: 'Game paused',
          title: 'Take a breather',
          copy: 'Your run is waiting exactly where you left it.',
          primary: 'Resume',
          secondary: 'Exit to menu'
        },
  'level-complete': (snapshot) => ({
    eyebrow: features.progress
      ? `Level ${snapshot.level} clear`
      : 'Level clear',
    title: 'Nice moves!',
    copy: withScore(`Score ${snapshot.score}.`, 'The next grid is faster and a little less friendly.'),
    primary: 'Next level',
    secondary: 'Exit to menu'
  }),
  'game-over': (snapshot) => ({
    eyebrow: features.progress ? `Level ${snapshot.level}` : '',
    title: 'Game over',
    copy: snapshot.failureReason ? failureCopy[snapshot.failureReason] : 'That run came to an end.',
    primary: 'Try again',
    secondary: 'Exit to menu'
  }),
  finished: (snapshot) => ({
    eyebrow: 'All levels clear',
    title: 'Snake master!',
    copy: withScore(`Final score: ${snapshot.score}.`, 'You conquered every grid.'),
    primary: 'Play again',
    secondary: 'Main menu'
  })
};

const renderInterface = (snapshot: GameSnapshot): void => {
  currentSnapshot = snapshot;

  levelValue.textContent = String(snapshot.level);
  scoreValue.textContent = String(snapshot.score);
  bestValue.textContent = String(controller.getProfile().bestScore);
  fruitValue.textContent = `${snapshot.fruitEaten} / ${snapshot.target}`;
  progressValue.style.transform = `scaleX(${Math.min(1, snapshot.progress)})`;

  const canPause = snapshot.phase === 'playing' || snapshot.phase === 'paused';
  pauseButton.disabled = !canPause;
  pauseButton.setAttribute('aria-label', snapshot.phase === 'paused' ? 'Resume game' : 'Pause game');
  pauseButton.firstElementChild!.textContent = snapshot.phase === 'paused' ? '▶' : 'Ⅱ';
  levelSelect.hidden = snapshot.phase !== 'menu';
  loginAction.hidden = !features.login || snapshot.phase !== 'menu';
  levelSelect.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((button) => {
    const level = Number(button.dataset.level);
    button.disabled = level > controller.getProfile().highestUnlockedLevel;
  });

  if (snapshot.phase === 'playing') {
    overlay.hidden = true;
    return;
  }

  overlay.hidden = false;
  const content = overlayContent[snapshot.phase](snapshot);
  overlayEyebrow.textContent = content.eyebrow;
  overlayEyebrow.hidden = !content.eyebrow;
  overlayTitle.textContent = content.title;
  overlayCopy.textContent = content.copy;
  primaryAction.textContent = content.primary ?? '';
  primaryAction.hidden = !content.primary;
  secondaryAction.textContent = content.secondary ?? '';
  secondaryAction.hidden = !content.secondary;
};

const performPrimaryAction = (): void => {
  switch (currentSnapshot.phase) {
    case 'menu':
    case 'finished':
      controller.startNewGame();
      break;
    case 'paused':
      if (currentSnapshot.pauseSource === 'player') controller.togglePlayerPause();
      break;
    case 'level-complete':
      controller.goToNextLevel();
      break;
    case 'game-over':
      controller.restartLevel();
      break;
    case 'playing':
      break;
  }
};

const togglePause = (): void => {
  controller.togglePlayerPause();
};

const renderAudioState = (): void => {
  const audioState = controller.getAudioState();
  muteButton.setAttribute('aria-label', audioState.playerMuted ? 'Unmute audio' : 'Mute audio');
  muteButton.firstElementChild!.textContent = audioState.effectiveMuted ? '×' : '♪';
};

controller.subscribe(renderInterface);
controller.events.on('audioChanged', renderAudioState);
renderAudioState();

primaryAction.addEventListener('click', performPrimaryAction);
secondaryAction.addEventListener('click', () => controller.quitToMenu());
pauseButton.addEventListener('click', togglePause);
muteButton.addEventListener('click', () => controller.togglePlayerMuted());
// Login on the home screen (https://docs.famobi.com/player Player-02).
loginAction.addEventListener('click', () => {
  famobi.player.openLoginDialog().catch((error: unknown) => log('Login dialog failed', error));
});

document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach((button) => {
  button.addEventListener('click', () => {
    controller.move(button.dataset.direction as Direction);
    phaserGame.canvas.focus({ preventScroll: true });
  });
});

levelSelect.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((button) => {
  button.addEventListener('click', () => controller.startAtLevel(Number(button.dataset.level)));
});

window.addEventListener('beforeunload', () => {
  controller.dispose();
  phaserGame.destroy(true);
});
