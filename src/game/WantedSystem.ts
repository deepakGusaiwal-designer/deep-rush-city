import { audioManager } from './AudioManager';

/** Heat needed to reach each star (index = star count). */
export const WANTED_THRESHOLDS = [0, 20, 60, 130, 240, 400];
export const MAX_HEAT = 520;

export type HeatReason =
  | 'pedestrian_hit'
  | 'pedestrian_tackle'
  | 'traffic_ram'
  | 'police_ram'
  | 'heist'
  | 'property';

/**
 * GTA-style wanted meter. Crimes add "heat"; heat only decays while no cop can see you.
 * Stars are derived from heat, so evading long enough drops you back to zero.
 */
export class WantedSystem {
  public heat: number = 0;
  public level: number = 0;
  /** Seconds since the last cop had eyes on the player */
  public evadeTimer: number = 0;
  /** Flashes true for one frame when a star is gained (HUD pulse). */
  public justIncreased: boolean = false;

  public onLevelChanged: ((level: number, prev: number) => void) | null = null;
  public onCleared: (() => void) | null = null;

  addHeat(amount: number, _reason: HeatReason) {
    if (amount <= 0) return;
    this.heat = Math.min(MAX_HEAT, this.heat + amount);
    this.evadeTimer = 0;
    this.recomputeLevel();
  }

  /** Force at least `stars` (used by the heist). */
  setMinimumStars(stars: number) {
    const target = WANTED_THRESHOLDS[Math.min(stars, 5)] + 5;
    if (this.heat < target) {
      this.heat = target;
      this.evadeTimer = 0;
      this.recomputeLevel();
    }
  }

  clear() {
    const prev = this.level;
    this.heat = 0;
    this.level = 0;
    this.evadeTimer = 0;
    if (prev !== 0 && this.onLevelChanged) this.onLevelChanged(0, prev);
  }

  /**
   * @param dt seconds
   * @param copHasEyes true when any cop is within sight range of the player
   */
  update(dt: number, copHasEyes: boolean) {
    this.justIncreased = false;
    if (this.level === 0 && this.heat <= 0) return;

    if (copHasEyes) {
      this.evadeTimer = 0;
      // Cops keep the pressure on, but heat still bleeds off very slowly
      this.heat = Math.max(0, this.heat - dt * 0.6);
    } else {
      this.evadeTimer += dt;
      // Grace period before the search cools, then steady decay (faster at low stars)
      if (this.evadeTimer > 3.0) {
        const decay = 6.5 - Math.min(4, this.level) * 0.8;
        this.heat = Math.max(0, this.heat - dt * decay);
      }
    }

    this.recomputeLevel();
  }

  private recomputeLevel() {
    let lvl = 0;
    for (let i = 5; i >= 1; i--) {
      if (this.heat >= WANTED_THRESHOLDS[i]) {
        lvl = i;
        break;
      }
    }

    if (lvl !== this.level) {
      const prev = this.level;
      this.level = lvl;
      if (lvl > prev) {
        this.justIncreased = true;
        audioManager.playWantedUp();
      }
      if (this.onLevelChanged) this.onLevelChanged(lvl, prev);
      if (lvl === 0 && prev > 0) {
        this.heat = 0;
        if (this.onCleared) this.onCleared();
      }
    }
  }

  /** 0..1 progress towards the next star (for the HUD meter). */
  get progressToNext(): number {
    if (this.level >= 5) return 1;
    const lo = WANTED_THRESHOLDS[this.level];
    const hi = WANTED_THRESHOLDS[this.level + 1];
    return Math.max(0, Math.min(1, (this.heat - lo) / (hi - lo)));
  }
}
