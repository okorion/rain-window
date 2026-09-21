import { seeded } from "./scene";
import { clamp } from "./state";

const wrap = (n: number, span: number) => ((n % span) + span) % span;

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
      const x =
        wrap(
          drop.x +
            this.drift * (35 + depth * 90) +
            Math.sin(this.time * 0.65 + phase) * depth * 5,
          this.w + 160,
        ) - 80;
      const y = wrap(drop.y + this.time * vy, this.h + 100) - 50;
      const exposure = 0.055 + depth * 0.075;
      return {
        x,
        y,
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
  draw(c: CanvasRenderingContext2D, light: number) {
    if (this.intensity === 0) return;
    c.save();
    // Soft airborne moisture, strongest near the distant skyline, not on the glass.
    const haze = c.createLinearGradient(0, 0, 0, this.h);
    const opacity = this.intensity * 0.065;
    haze.addColorStop(0, "rgba(106,139,158,0)");
    haze.addColorStop(0.42, `rgba(106,139,158,${opacity})`);
    haze.addColorStop(1, "rgba(106,139,158,0)");
    c.fillStyle = haze;
    c.fillRect(0, 0, this.w, this.h);
    c.lineCap = "round";
    // Draw dim broad shoulders then a fine core; avoids expensive per-drop blur.
    for (const p of this.streaks()) {
      const illumination =
        (0.65 + light * 0.35) *
        (0.65 + 0.35 * Math.sin((p.x / this.w) * 8 + (p.y / this.h) * 3) ** 2);
      c.strokeStyle = `rgba(174,200,212,${p.alpha * illumination})`;
      c.lineWidth = 0.45 + p.depth * 0.85;
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
