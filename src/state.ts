export interface ExperienceState {
  paused: boolean;
  hidden: boolean;
  sound: boolean;
  volume: number;
  intensity: number;
}
export const active = (s: ExperienceState) => !s.paused && !s.hidden;
export const audible = (s: ExperienceState) =>
  active(s) && s.sound && s.volume > 0 && s.intensity > 0;
export const clamp = (n: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, n));
export const dropLimit = (width: number, intensity: number) =>
  Math.round((width <= 640 ? 240 : 560) * (0.45 + 0.55 * clamp(intensity)));
export class FrameClock {
  private last: number | null = null;
  reset() {
    this.last = null;
  }
  tick(time: number, fps: number): number | null {
    if (this.last === null) {
      this.last = time;
      return 0;
    }
    const elapsed = time - this.last;
    if (elapsed < 1000 / fps - 0.5) return null;
    this.last = time;
    return Math.min(elapsed / 1000, 0.05);
  }
}
