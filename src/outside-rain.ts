import { seeded } from "./scene";
import { clamp } from "./state";

const wrap = (n: number, span: number) => ((n % span) + span) % span;

export interface RainLight {
  x: number;
  y: number;
  radius: number;
  strength: number;
  warm: boolean;
}
export function rainIllumination(x: number, y: number, lights: RainLight[]) {
  let level = 0,
    warmth = 0;
  for (const light of lights) {
    const d = Math.hypot(
      (x - light.x) / light.radius,
      (y - light.y) / (light.radius * 1.3),
    );
    if (d >= 1) continue;
    const amount = (1 - d * d) ** 2 * light.strength;
    level += amount;
    if (light.warm) warmth += amount;
  }
  return { level: clamp(level), warm: warmth / Math.max(level, 0.001) };
}

/** Three depth bands between the skyline and the glass, in CSS pixels. */
export class OutsideRain {
  private random = seeded(731);
  private drops: {
    x: number;
    y: number;
    depth: number;
    speed: number;
    phase: number;
  }[] = [];
  private w = 1;
  private h = 1;
  private time = 0;
  private drift = 0;
  private intensity = 0.5;
  private wind = 0.2;
  resize(w: number, h: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.random = seeded(731);
    const count = Math.min(w <= 640 ? 420 : 900, Math.round((w * h) / 1350));
    this.drops = Array.from({ length: count }, (_, i) => ({
      x: this.random() * (this.w + 160),
      y: this.random() * (this.h + 100),
      depth: i % 10 < 6 ? 0.25 : i % 10 < 9 ? 0.58 : 1,
      speed: 0.75 + this.random() * 0.5,
      phase: this.random() * Math.PI * 2,
    }));
  }
  setIntensity(value: number) {
    this.intensity = clamp(value);
  }
  setWind(value: number) {
    this.wind = clamp(value, -1, 1);
  }
  step(dt: number) {
    if (dt <= 0 || this.intensity === 0) return;
    const step = Math.min(dt, 0.05);
    this.time += step;
    this.drift += this.wind * step;
  }
  /** Shared geometry lets display and refracted scene show exactly the same rain. */
  streaks() {
    const count = Math.round(this.drops.length * this.intensity);
    return this.drops.slice(0, count).map((drop) => {
      const { depth, speed, phase } = drop;
      const vy = (65 + depth * 145) * speed;
      const vx = this.wind * (35 + depth * 90);
      const travelX =
        drop.x +
        this.drift * (35 + depth * 90) +
        Math.sin(this.time * 0.65 + phase) * depth * 5;
      const travelY = drop.y + this.time * vy;
      const x = wrap(travelX, this.w + 160) - 80;
      const y = wrap(travelY, this.h + 100) - 50;
      const exposure = 0.025 + depth * 0.045;
      return {
        x,
        y,
        travelX,
        travelY,
        dx: vx * exposure,
        dy: vy * exposure,
        depth,
        alpha:
          (0.065 + depth * 0.13) *
          (0.7 + this.intensity * 0.3) *
          (0.75 + Math.sin(phase + this.time * 0.7) * 0.25),
      };
    });
  }
  draw(c: CanvasRenderingContext2D, lights: RainLight[]) {
    if (this.intensity === 0) return;
    c.save();
    // Moisture scatters light locally; the unlit sky stays dark and rain-free to the eye.
    for (const light of lights) {
      const r = light.radius;
      const mist = c.createRadialGradient(
        light.x,
        light.y,
        0,
        light.x,
        light.y,
        r,
      );
      const color = light.warm ? "225,194,149" : "153,192,213";
      mist.addColorStop(
        0,
        `rgba(${color},${0.045 * light.strength * this.intensity})`,
      );
      mist.addColorStop(1, `rgba(${color},0)`);
      c.fillStyle = mist;
      c.fillRect(light.x - r, light.y - r, r * 2, r * 2);
    }
    c.lineCap = "round";
    // Short, tapered exposures emerge from real light pools, with no uniform sky overlay.
    const pools = lights
      .slice(0, 22)
      .filter(
        (light) =>
          light.x + light.radius > 0 &&
          light.x - light.radius < this.w &&
          light.y + light.radius > 0 &&
          light.y - light.radius < this.h,
      );
    for (const [i, p] of this.streaks().entries()) {
      // Spend most of the bounded particle budget where backlighting makes rain visible.
      // Wrap at the dark edge of each pool, where opacity has already fallen to zero.
      if (pools.length && i % 5 !== 0) {
        const pool = pools[i % pools.length];
        p.x = pool.x + wrap(p.travelX, pool.radius * 2) - pool.radius;
        p.y = pool.y + wrap(p.travelY, pool.radius * 2.6) - pool.radius * 1.3;
      }
      const illumination = rainIllumination(p.x, p.y, lights);
      const alpha = p.alpha * illumination.level * 2.5;
      if (alpha < 0.008) continue;
      const color = illumination.warm > 0.5 ? "239,213,170" : "181,211,225";
      const trail = c.createLinearGradient(p.x - p.dx, p.y - p.dy, p.x, p.y);
      trail.addColorStop(0, `rgba(${color},0)`);
      trail.addColorStop(0.65, `rgba(${color},${alpha})`);
      trail.addColorStop(1, `rgba(${color},0)`);
      c.strokeStyle = trail;
      c.lineWidth = 0.5 + p.depth * 0.65;
      c.beginPath();
      c.moveTo(p.x - p.dx, p.y - p.dy);
      c.lineTo(p.x, p.y);
      c.stroke();
      c.globalAlpha = 0.16;
      c.lineWidth *= 3.5;
      c.stroke();
      c.globalAlpha = 1;
    }
    c.restore();
  }
}
