export type PlayerProfile = {
  bestScore: number;
  highestUnlockedLevel: number;
  totalRuns: number;
  playerMuted: boolean;
};

export interface GameStorage {
  loadProfile(): PlayerProfile;
  saveProfile(profile: PlayerProfile): void;
}

const defaultProfile = (): PlayerProfile => ({
  bestScore: 0,
  highestUnlockedLevel: 1,
  totalRuns: 0,
  playerMuted: false
});

// Key/value store with the localStorage get/set contract, e.g. window.localStorage or GameInterface.storage.
export type KeyValueStore = {
  getItem(key: string): unknown;
  setItem(key: string, value: string): void;
};

export class LocalGameStorage implements GameStorage {
  private readonly storageKey = 'neon-snake:profile';

  constructor(private readonly store: KeyValueStore = window.localStorage) {}

  loadProfile(): PlayerProfile {
    try {
      const storedProfile = this.store.getItem(this.storageKey);
      if (typeof storedProfile !== 'string' || !storedProfile) return defaultProfile();

      const value = JSON.parse(storedProfile) as Partial<PlayerProfile>;
      return {
        bestScore: this.nonNegativeInteger(value.bestScore, 0),
        highestUnlockedLevel: Math.min(3, Math.max(1, this.nonNegativeInteger(value.highestUnlockedLevel, 1))),
        totalRuns: this.nonNegativeInteger(value.totalRuns, 0),
        playerMuted: typeof value.playerMuted === 'boolean' ? value.playerMuted : false
      };
    } catch {
      return defaultProfile();
    }
  }

  saveProfile(profile: PlayerProfile): void {
    try {
      this.store.setItem(this.storageKey, JSON.stringify(profile));
    } catch {
      // The game remains playable when browser storage is unavailable.
    }
  }

  private nonNegativeInteger(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
  }
}
