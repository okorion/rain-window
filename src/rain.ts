import { seeded, resolution } from "./scene";
import { clamp, dropLimit, FrameClock } from "./state";

interface Drop {
  x: number;
  y: number;
  r: number;
  stretch: number;
  moving: boolean;
  wait: number;
  speed: number;
  phase: number;
  trail: { x: number; y: number; life: number }[];
}
export class Rain {
  private canvas: HTMLCanvasElement;
  private city: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private drops: Drop[] = [];
  private random = seeded(48912);
  private clock = new FrameClock();
  private frame = 0;
  private running = false;
  private width = 0;
  private height = 0;
  private scale = 1;
  private intensity = 0.5;
  private failed = false;
  private onFailure: () => void;
  constructor(
    canvas: HTMLCanvasElement,
    city: HTMLCanvasElement,
    onFailure: () => void,
  ) {
    this.canvas = canvas;
    this.city = city;
    this.onFailure = onFailure;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    this.ctx = ctx;
  }
  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.scale = resolution(w, h);
    this.canvas.width = Math.floor(w * this.scale);
    this.canvas.height = Math.floor(h * this.scale);
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.drops = Array.from({ length: dropLimit(w, this.intensity) }, () =>
      this.createDrop(true),
    );
    this.clock.reset();
    this.render();
  }
  private createDrop(initial = false, forceMoving = false): Drop {
    const moving = forceMoving || this.random() > 0.82;
    const drop: Drop = {
      x: this.random() * this.width,
      y: initial ? this.random() * this.height : -15,
      r: moving ? 4.5 + this.random() * 4 : 1.4 + this.random() ** 1.1 * 4.6,
      stretch: moving ? 1.55 : 1 + this.random() * 0.35,
      moving,
      wait: this.random() * 3,
      speed: 12 + this.random() * 24,
      phase: this.random() * Math.PI * 2,
      trail: [],
    };
    // Existing wet tracks make the glass legible before the first animation frame.
    if (initial && moving) {
      const length = 35 + this.random() * 110;
      for (let i = 0; i < 14; i++) {
        const distance = length * (1 - i / 14);
        drop.trail.push({
          x: drop.x + Math.sin(distance * 0.045) * 2,
          y: drop.y - distance,
          life: 2 + i / 7,
        });
      }
    }
    return drop;
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
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      for (const point of d.trail) point.life -= dt;
      d.trail = d.trail.filter((p) => p.life > 0);
      if (!d.moving || this.intensity === 0) continue;
      d.wait -= dt;
      if (d.wait > 0) continue;
      d.phase += dt * 1.2;
      const previous = { x: d.x, y: d.y, life: 4 };
      d.y +=
        d.speed *
        (0.3 + this.intensity) *
        dt *
        (0.5 + Math.abs(Math.sin(d.phase)));
      d.x += Math.sin(d.y * 0.022 + d.phase) * dt * 2.7;
      if (!d.trail.length || Math.abs(d.y - d.trail[d.trail.length - 1].y) > 2)
        d.trail.push(previous);
      if (d.trail.length > 90) d.trail.shift();
      if (d.y > this.height + 25) this.drops[i] = this.createDrop(false, true);
    }
  }
  private render() {
    if (this.failed) return;
    const c = this.ctx;
    c.clearRect(0, 0, this.width, this.height);
    for (const d of this.drops) {
      // A thin wet track persists briefly behind each travelling bead.
      if (d.trail.length > 1) {
        c.lineCap = "round";
        c.lineWidth = d.r * 0.5;
        for (let j = 1; j < d.trail.length; j++) {
          const a = d.trail[j - 1],
            b = d.trail[j];
          c.strokeStyle = `rgba(180,211,219,${b.life * 0.045})`;
          c.beginPath();
          c.moveTo(a.x, a.y);
          c.lineTo(b.x, b.y);
          c.stroke();
        }
      }
      const ry = d.r * d.stretch;
      c.save();
      c.beginPath();
      c.ellipse(d.x, d.y, d.r, ry, 0, 0, Math.PI * 2);
      c.clip();
      // Cropped, enlarged background: intentionally approximate refraction.
      const sourceR = d.r * 1.7 * this.scale;
      const sx = clamp(
        (d.x + d.r * 3) * this.scale - sourceR,
        0,
        Math.max(0, this.city.width - sourceR * 2),
      );
      const sy = clamp(
        (d.y - d.r * 2) * this.scale - sourceR,
        0,
        Math.max(0, this.city.height - sourceR * 2),
      );
      c.drawImage(
        this.city,
        sx,
        sy,
        sourceR * 2,
        sourceR * 2,
        d.x - d.r,
        d.y - ry,
        d.r * 2,
        ry * 2,
      );
      const sheen = c.createLinearGradient(
        d.x - d.r,
        d.y - ry,
        d.x + d.r,
        d.y + ry,
      );
      sheen.addColorStop(0, "#daf6ff88");
      sheen.addColorStop(0.25, "#d1ecf01a");
      sheen.addColorStop(0.65, "#031018a8");
      sheen.addColorStop(1, "#d8e8dcaa");
      c.fillStyle = sheen;
      c.fillRect(d.x - d.r, d.y - ry, d.r * 2, ry * 2);
      c.restore();
      c.strokeStyle = "#010912b0";
      c.lineWidth = 1.1;
      c.beginPath();
      c.ellipse(d.x, d.y, d.r, ry, 0, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = d.r > 2 ? "#def2f3bd" : "#bedce08a";
      c.lineWidth = 0.9;
      c.beginPath();
      c.ellipse(
        d.x - 0.2,
        d.y - 0.25,
        d.r * 0.75,
        ry * 0.8,
        0,
        Math.PI * 1.12,
        Math.PI * 1.65,
      );
      c.stroke();
      if (d.r > 2.6) {
        c.fillStyle = "#e5eee0d0";
        c.beginPath();
        c.ellipse(
          d.x + d.r * 0.17,
          d.y + ry * 0.62,
          d.r * 0.38,
          0.85,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
  }
  destroy() {
    this.setRunning(false);
    this.drops = [];
  }
}
