import { drawCity, resolution, seeded } from "./scene";
import { clamp } from "./state";
import { OutsideRain, type RainLight } from "./outside-rain";

/** Device-local wall clock; unrelated to the animation clock or location APIs. */
export function buildingLightLevel(date: Date) {
  const hour =
    date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  if (hour >= 1 && hour < 5) return 0;
  if (hour >= 5 && hour < 8) return (hour - 5) / 3;
  if (hour >= 8 && hour < 22) return 1;
  return hour >= 22 ? (25 - hour) / 3 : (1 - hour) / 3;
}
export const windSpeed = (wind: number) => clamp(wind, -1, 1) * 34;
// Street east of the rail corridor, traced in normalized source-photo coordinates.
const road = [
  [0.587, 1.02],
  [0.587, 0.946],
  [0.593, 0.88],
  [0.588, 0.822],
  [0.573, 0.751],
  [0.572, 0.689],
  [0.558, 0.642],
  [0.532, 0.605],
];
export function roadPoint(progress: number) {
  const p = clamp(progress) * (road.length - 1),
    i = Math.min(road.length - 2, Math.floor(p));
  const t = p - i;
  return {
    x: road[i][0] * (1 - t) + road[i + 1][0] * t,
    y: road[i][1] * (1 - t) + road[i + 1][1] * t,
  };
}
function onRoad(x: number, y: number) {
  for (let i = 0; i < road.length - 1; i++) {
    const [ax, ay] = road[i],
      [bx, by] = road[i + 1];
    const t = clamp(
      ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) /
        ((bx - ax) ** 2 + (by - ay) ** 2),
    );
    if (Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)) < 0.006)
      return true;
  }
  return false;
}

export class CityLife {
  private city: HTMLCanvasElement;
  private lens: HTMLCanvasElement;
  private bright = document.createElement("canvas");
  private dark = document.createElement("canvas");
  private clouds = document.createElement("canvas");
  private outsideRain = new OutsideRain();
  private lights: RainLight[] = [];
  private w = 0;
  private scale = 1;
  private photoW = 0;
  private photoH = 0;
  private ox = 0;
  private oy = 0;
  private time = 0;
  private cloudX = 0;
  private elapsed = 0;
  private wind = 0.2;
  private enabled = false;
  private windows: {
    x: number;
    y: number;
    w: number;
    h: number;
    phase: number;
  }[] = [];
  constructor(city: HTMLCanvasElement, lens: HTMLCanvasElement) {
    this.city = city;
    this.lens = lens;
    // Cached, tileable, multi-scale cloud density; no per-frame noise generation.
    this.clouds.width = 256;
    this.clouds.height = 96;
    const ctx = this.clouds.getContext("2d");
    if (!ctx) throw new Error("Cloud canvas unavailable");
    const image = ctx.createImageData(256, 96),
      random = seeded(121);
    const grids = [8, 16, 32].map((n) => ({
      n,
      values: Array.from({ length: n * n }, () => random()),
    }));
    for (let y = 0; y < 96; y++)
      for (let x = 0; x < 256; x++) {
        let density = 0;
        for (let k = 0; k < grids.length; k++) {
          const { n, values } = grids[k],
            px = (x / 256) * n,
            py = (y / 96) * (n / 3);
          const ix = Math.floor(px),
            iy = Math.floor(py);
          let tx = px - ix,
            ty = py - iy;
          tx = tx * tx * (3 - 2 * tx);
          ty = ty * ty * (3 - 2 * ty);
          const v = (dx: number, dy: number) =>
            values[((iy + dy) % n) * n + ((ix + dx) % n)];
          density +=
            ((v(0, 0) * (1 - tx) + v(1, 0) * tx) * (1 - ty) +
              (v(0, 1) * (1 - tx) + v(1, 1) * tx) * ty) /
            2 ** k;
        }
        const a =
          clamp((density / 1.75 - 0.3) * 1.7) *
          Math.sin((y / 95) * Math.PI) ** 1.5;
        const i = (y * 256 + x) * 4;
        image.data.set([61, 79, 91, Math.round(a * 115)], i);
      }
    ctx.putImageData(image, 0, 0);
  }
  resize(w: number, h: number, photo?: HTMLImageElement) {
    this.w = w;
    this.scale = resolution(w, h);
    this.elapsed = 0;
    this.outsideRain.resize(w, h);
    drawCity(this.bright, w, h, photo, 0.6);
    this.enabled = Boolean(photo);
    this.lights = [
      { x: w * 0.32, y: h * 0.59, radius: w * 0.17, strength: 0.7, warm: true },
      { x: w * 0.7, y: h * 0.5, radius: w * 0.16, strength: 0.5, warm: false },
    ];
    for (const c of [this.city, this.lens, this.dark]) {
      c.width = this.bright.width;
      c.height = this.bright.height;
    }
    if (photo) {
      const cover = Math.max(
        (w + 24) / photo.naturalWidth,
        (h + 24) / photo.naturalHeight,
      );
      this.photoW = photo.naturalWidth * cover;
      this.photoH = photo.naturalHeight * cover;
      this.ox = (w - this.photoW) / 2;
      this.oy = (h - this.photoH) / 2;
      // Permanent street/shop lights stay on when office windows turn off.
      this.lights = Array.from({ length: 15 }, (_, i) => {
        const p = roadPoint(0.06 + (i / 14) * 0.88);
        const depth = clamp((p.y - 0.6) / 0.4);
        return {
          x: this.ox + (p.x + (i % 2 ? -0.003 : 0.003)) * this.photoW,
          y: this.oy + p.y * this.photoH,
          radius: 15 + depth * 30,
          strength: 0.95,
          warm: true,
        };
      });
      for (const [x, y, r, warm] of [
        [0.177, 0.499, 0.045, 1],
        [0.356, 0.508, 0.04, 1],
        [0.486, 0.52, 0.055, 0],
        [0.655, 0.657, 0.04, 1],
        [0.784, 0.699, 0.06, 0],
        [0.88, 0.546, 0.04, 1],
        [0.245, 0.694, 0.045, 0],
      ])
        this.lights.push({
          x: this.ox + x * this.photoW,
          y: this.oy + y * this.photoH,
          radius: this.photoW * r,
          strength: 0.6,
          warm: Boolean(warm),
        });
      const ctx = this.dark.getContext("2d")!;
      ctx.drawImage(this.bright, 0, 0);
      const data = ctx.getImageData(0, 0, this.dark.width, this.dark.height);
      this.windows = [];
      const random = seeded(949);
      for (let y = 0; y < data.height; y++)
        for (let x = 0; x < data.width; x++) {
          const px = (x / this.scale - this.ox) / this.photoW,
            py = (y / this.scale - this.oy) / this.photoH;
          if (py < 0.375 || onRoad(px, py)) continue;
          const i = (y * data.width + x) * 4,
            r = data.data[i],
            g = data.data[i + 1],
            b = data.data[i + 2];
          if (r > g * 1.7 && r > b * 1.5) continue; // keep red safety/aviation lights
          const l = Math.max(r, g, b) / 255;
          const skyLike =
            py < 0.46
              ? clamp((b / (g + 1) - 1.15) / 0.4) *
                clamp(((g - r) / (g + 1)) * 2)
              : 0;
          const emission =
            clamp((l - 0.075) / 0.3) *
            (1 - skyLike) *
            clamp((py - 0.375) / 0.025);
          // Keep diffuse facade detail instead of turning bright windows into black holes.
          data.data[i] = Math.round(
            r * (1 - emission) + Math.min(r, 15) * emission,
          );
          data.data[i + 1] = Math.round(
            g * (1 - emission) + Math.min(g, 25) * emission,
          );
          data.data[i + 2] = Math.round(
            b * (1 - emission) + Math.min(b, 33) * emission,
          );
          if (
            x % 9 === 0 &&
            y % 7 === 0 &&
            l > 0.32 &&
            this.windows.length < 1800 &&
            random() > 0.5
          )
            this.windows.push({
              x: x - 2,
              y: y - 1,
              w: 4,
              h: 3,
              phase: random() * 100,
            });
        }
      ctx.putImageData(data, 0, 0);
    }
    this.render(new Date());
  }
  setWind(value: number) {
    this.wind = clamp(value, -1, 1);
    this.outsideRain.setWind(value);
  }
  setIntensity(value: number) {
    this.outsideRain.setIntensity(value);
    this.render(new Date());
  }
  step(dt: number) {
    if (dt <= 0) return false;
    this.outsideRain.step(dt);
    this.time += dt;
    this.elapsed += dt;
    this.cloudX += (3 + windSpeed(this.wind) * 0.6) * dt;
    if (this.elapsed < (this.w <= 640 ? 1 / 15 : 1 / 20)) return false;
    this.elapsed = 0;
    this.render(new Date());
    return true;
  }
  refreshTime() {
    this.render(new Date());
  }
  private render(now: Date) {
    const c = this.lens.getContext("2d"),
      display = this.city.getContext("2d");
    if (!c || !display) throw new Error("City canvas unavailable");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    const level = buildingLightLevel(now);
    this.city.dataset.lights = level.toFixed(3);
    this.city.dataset.localHour = String(now.getHours());
    if (!this.enabled) c.drawImage(this.bright, 0, 0);
    else {
      c.drawImage(this.dark, 0, 0);
      c.globalAlpha = level;
      c.drawImage(this.bright, 0, 0);
      c.globalAlpha = 1;
      // Slowly dim selected real window pixels, not unrelated rectangles in the sky.
      for (const win of this.windows) {
        const cycle = Math.sin(this.time * 0.085 + win.phase);
        const off = clamp((cycle - 0.25) * 2) * 0.85 * level;
        if (off < 0.01) continue;
        c.globalAlpha = off;
        c.drawImage(
          this.dark,
          win.x,
          win.y,
          win.w,
          win.h,
          win.x,
          win.y,
          win.w,
          win.h,
        );
      }
      c.globalAlpha = 1;
      c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      c.save();
      c.beginPath();
      c.rect(0, 0, this.w, Math.max(0, this.oy + this.photoH * 0.394));
      c.clip();
      for (let layer = 0; layer < 2; layer++) {
        const width = this.w * 1.2,
          height = this.photoH * (layer ? 0.2 : 0.27);
        const shift =
          (((this.cloudX * (layer ? 0.55 : 1)) % width) + width) % width;
        c.globalAlpha = layer ? 0.48 : 0.7;
        for (let tile = -1; tile < 2; tile++)
          c.drawImage(
            this.clouds,
            shift + tile * width,
            this.oy + this.photoH * (layer ? 0.2 : 0.045),
            width,
            height,
          );
      }
      c.restore();
      c.globalAlpha = 1;
    }
    display.setTransform(1, 0, 0, 1, 0, 0);
    display.clearRect(0, 0, this.city.width, this.city.height);
    display.filter = `blur(${2.6 * this.scale}px)`;
    display.drawImage(this.lens, 0, 0);
    display.filter = "none";
    // Light cores and moving cars retain their own focus instead of vanishing in city blur.
    for (const target of [c, display]) {
      target.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      const movingLights = this.enabled ? this.drawLights(target) : [];
      this.outsideRain.draw(target, [...this.lights, ...movingLights]);
    }
  }
  private drawLights(c: CanvasRenderingContext2D) {
    for (const [i, light] of this.lights.entries()) {
      const { x, y, radius, warm } = light;
      const color = warm ? "246,193,123" : "162,206,225";
      const glow = c.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, `rgba(${color},${i < 15 ? 0.2 : 0.075})`);
      glow.addColorStop(0.25, `rgba(${color},0.035)`);
      glow.addColorStop(1, `rgba(${color},0)`);
      c.fillStyle = glow;
      c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      const r = i < 15 ? 0.8 + (1 - i / 15) * 0.7 : 1;
      c.fillStyle = `rgba(${color},0.8)`;
      c.beginPath();
      c.ellipse(x, y, r * 1.5, r, 0, 0, Math.PI * 2);
      c.fill();
      // Small wet-road reflection, aligned vertically below the lamp.
      const reflection = c.createLinearGradient(x, y, x, y + r * 12);
      reflection.addColorStop(0, `rgba(${color},0.16)`);
      reflection.addColorStop(1, `rgba(${color},0)`);
      c.fillStyle = reflection;
      c.fillRect(x - r, y + 2, r * 2, r * 12);
    }
    const lights: RainLight[] = [];
    for (let i = 0; i < 22; i++) {
      const dir = i % 2 ? 1 : -1;
      const progress =
        (((i / 22 + this.time * (0.018 + (i % 5) * 0.0017) * dir) % 1) + 1) % 1;
      const p = roadPoint(progress),
        lane = dir * 0.0017;
      const x = this.ox + (p.x + lane) * this.photoW,
        y = this.oy + p.y * this.photoH;
      const depth = clamp((p.y - 0.6) / 0.4),
        r = 0.9 + depth * 1.3;
      const color = dir > 0 ? "255,125,98" : "255,237,197";
      const glow = c.createRadialGradient(x, y, 0, x, y, r * 5);
      glow.addColorStop(0, `rgba(${color},0.55)`);
      glow.addColorStop(0.3, `rgba(${color},0.12)`);
      glow.addColorStop(1, `rgba(${color},0)`);
      c.fillStyle = glow;
      c.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
      c.fillStyle = dir > 0 ? "#fba18b" : "#fff5dc";
      c.fillRect(x - r, y, r * 0.7, r * 0.85);
      c.fillRect(x + r * 0.4, y, r * 0.7, r * 0.85);
      lights.push({ x, y, radius: r * 13, strength: 0.65, warm: true });
    }
    return lights;
  }
}
