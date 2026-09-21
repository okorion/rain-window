import { clamp } from "./state";

export interface Impact {
  x: number;
  y: number;
  r: number;
  age: number;
  angle: number;
  satellites: { angle: number; distance: number; r: number }[];
}
export const IMPACT_LIFETIME = 0.48;
export const IMPACT_LIMIT = 32;

/** Random arrivals on the pane, independent of the display refresh rate. */
export class Impacts {
  items: Impact[] = [];
  private remaining = 0;
  private random: () => number;
  constructor(random: () => number) {
    this.random = random;
    this.reset();
  }
  reset() {
    this.items = [];
    this.remaining = this.interval();
  }
  private interval() {
    return -Math.log(Math.max(0.0001, 1 - this.random()));
  }
  step(dt: number, intensity: number, width: number, height: number): Impact[] {
    if (intensity <= 0 || dt <= 0) return [];
    dt = Math.min(dt, 0.05);
    for (const hit of this.items) hit.age += dt;
    this.items = this.items.filter((hit) => hit.age < IMPACT_LIFETIME);
    const rate =
      (1 + 23 * clamp(intensity) ** 1.3) *
      clamp((width * height) / 1_296_000, 0.4, 1);
    this.remaining -= rate * dt;
    const added: Impact[] = [];
    while (this.remaining <= 0 && added.length < 4) {
      this.remaining += this.interval();
      const r = 1.8 + this.random() ** 1.5 * 3.8;
      const angle = this.random() * Math.PI * 2;
      const hit: Impact = {
        x: this.random() * width,
        y: this.random() * height,
        r,
        age: 0,
        angle,
        satellites: Array.from({ length: r > 3.2 ? 4 : 2 }, (_, i) => ({
          angle: angle + i * 1.75 + this.random() * 0.65,
          distance: r * (1.1 + this.random() * 1.8),
          r: 0.35 + this.random() * 0.8,
        })),
      };
      this.items.push(hit);
      added.push(hit);
    }
    if (this.items.length > IMPACT_LIMIT)
      this.items.splice(0, this.items.length - IMPACT_LIMIT);
    return added;
  }
}

/** Fast contact spread, then damped recoil into a bead; no water-surface rings. */
export function impactShape(age: number) {
  const spread =
    age < 0.045
      ? 0.35 + (age / 0.045) * 1.2
      : 1 + 0.55 * Math.exp(-(age - 0.045) * 13) * Math.cos((age - 0.045) * 24);
  return {
    spread,
    flatten: 0.7 + 0.3 * Math.min(1, age / 0.22),
    irregularity: Math.max(0, 1 - age / 0.23),
  };
}
