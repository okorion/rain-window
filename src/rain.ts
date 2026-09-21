import { seeded, resolution } from "./scene";
import { clamp, dropLimit, FrameClock } from "./state";
import { WaterRenderer } from "./water-renderer";

interface Bead {
  x: number;
  y: number;
  r: number;
  age: number;
  life: number;
  moving: boolean;
  speed: number;
  wait: number;
  run: number;
  drift: number;
  targetDrift: number;
  stretch: number;
  seed: number;
}
interface Residue {
  x: number;
  y: number;
  r: number;
  life: number;
}

// Film, tiny beads and travelling drops use the same curved-cap optics.
export class Rain {
  private renderer: WaterRenderer;
  private drops: Bead[] = [];
  private residue: Residue[] = [];
  private random = seeded(48912);
  private clock = new FrameClock();
  private frame = 0;
  private running = false;
  private width = 0;
  private height = 0;
  private intensity = 0.5;
  private failed = false;
  private canvas: HTMLCanvasElement;
  private onFailure: () => void;
  constructor(
    canvas: HTMLCanvasElement,
    city: HTMLCanvasElement,
    onFailure: () => void,
  ) {
    this.canvas = canvas;
    this.onFailure = onFailure;
    this.renderer = new WaterRenderer(canvas, city);
  }
  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    const scale = resolution(w, h);
    this.canvas.width = Math.floor(w * scale);
    this.canvas.height = Math.floor(h * scale);
    this.drops = Array.from({ length: dropLimit(w, this.intensity) }, () =>
      this.createDrop(true),
    );
    this.residue = [];
    this.renderer.resize(w, h);
    this.clock.reset();
    this.render();
  }
  private createDrop(initial = false, moving = this.random() < 0.045): Bead {
    const r = moving
      ? 3.5 + this.random() * 3.8
      : 1.4 + this.random() ** 1.6 * 6;
    return {
      x: this.random() * this.width,
      y: initial || !moving ? this.random() * this.height : -20,
      r,
      age: initial ? 2 : 0,
      life: 12 + this.random() * 45,
      moving,
      speed: 0,
      wait: this.random() * 4,
      run: 0.3 + this.random() * 1.7,
      drift: 0,
      targetDrift: (this.random() - 0.5) * 8,
      stretch: 0.85 + this.random() * 0.3,
      seed: this.random() * 100,
    };
  }
  setIntensity(value: number) {
    this.intensity = clamp(value);
    const count = dropLimit(this.width, value);
    while (this.drops.length < count) this.drops.push(this.createDrop(true));
    this.drops.length = count;
    this.render();
  }
  setRunning(value: boolean) {
    if (value === this.running || this.failed) return;
    this.running = value;
    this.clock.reset();
    if (value) this.frame = requestAnimationFrame(this.animate);
    else cancelAnimationFrame(this.frame);
  }
  private animate = (time: number) => {
    if (!this.running) return;
    try {
      const dt = this.clock.tick(time, this.width <= 640 ? 30 : 60);
      if (dt !== null) {
        this.update(dt);
        this.render();
      }
      this.frame = requestAnimationFrame(this.animate);
    } catch {
      this.failed = true;
      this.running = false;
      this.onFailure();
    }
  };
  private update(dt: number) {
    if (this.intensity === 0) return;
    for (const p of this.residue) p.life -= dt;
    this.residue = this.residue.filter((p) => p.life > 0);
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      d.age += dt;
      if (!d.moving) {
        if (d.age > d.life) this.drops[i] = this.createDrop(false, false);
        continue;
      }
      d.wait -= dt;
      // Surface pinning competes with gravity: pauses followed by acceleration.
      const target =
        d.wait > 0 ? 0 : (18 + d.r * d.r * 2.3) * (0.35 + this.intensity);
      d.speed += (target - d.speed) * Math.min(1, dt * 5);
      if (d.wait <= 0) {
        d.run -= dt;
        if (d.run <= 0) {
          d.wait = this.random() * 1.6;
          d.run = 0.35 + this.random() * 2;
          d.targetDrift = (this.random() - 0.5) * 12;
        }
      }
      const oldX = d.x,
        oldY = d.y;
      d.drift += (d.targetDrift - d.drift) * Math.min(1, dt * 2);
      d.x += d.drift * dt * Math.min(1, d.speed / 30);
      d.y += d.speed * dt;
      const distance = d.y - oldY;
      // Discrete capillary beads at spatial intervals, never a luminous polyline.
      if (distance > 0.15) {
        const steps = Math.ceil(distance / 1.8);
        for (let j = 0; j < steps; j++) {
          const t = j / steps,
            y = oldY + distance * t;
          const pinch = 0.25 + 0.75 * Math.sin(y * 0.47 + d.seed) ** 4;
          this.residue.push({
            x: oldX + (d.x - oldX) * t,
            y,
            r: (0.4 + d.r * 0.14) * pinch,
            life: 0.35 + this.random() * 0.8,
          });
        }
      }
      // Bounded pickup approximation, not a fluid solver.
      if (distance > 0.2)
        for (const other of this.drops) {
          if (other.moving || other.age < 0.5) continue;
          if (
            Math.abs(other.x - d.x) < d.r &&
            other.y >= oldY - d.r &&
            other.y <= d.y + d.r
          ) {
            d.r = Math.min(
              8.2,
              Math.sqrt(d.r * d.r + other.r * other.r * 0.22),
            );
            other.age = other.life;
            other.r = 0;
          }
        }
      if (d.y > this.height + 30) this.drops[i] = this.createDrop(false, true);
    }
    const limit = this.width <= 640 ? 2200 : 5000;
    if (this.residue.length > limit)
      this.residue.splice(0, this.residue.length - limit);
  }
  private render() {
    if (this.failed) return;
    this.renderer.begin();
    for (const p of this.residue)
      this.renderer.bead(
        p.x,
        p.y,
        p.r,
        p.r * 1.8,
        Math.min(1, p.life * 2) * 0.22,
      );
    for (const d of this.drops) {
      const growth = Math.min(1, d.age / 0.8);
      const fade = d.moving ? 1 : Math.min(1, (d.life - d.age) / 2);
      const r = d.r * growth * Math.max(0, fade);
      const stretch = d.moving
        ? 1.15 + Math.min(0.6, d.speed / 170)
        : d.stretch;
      this.renderer.bead(d.x, d.y, r, r * stretch, 0.95, d.moving ? 1 : 0.25);
    }
    this.renderer.render();
  }
  destroy() {
    this.setRunning(false);
    cancelAnimationFrame(this.frame);
    this.renderer.destroy();
    this.drops = [];
    this.residue = [];
  }
}
