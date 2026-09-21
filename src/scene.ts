export function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}
export function resolution(
  w: number,
  h: number,
  dpr = window.devicePixelRatio || 1,
) {
  return Math.min(
    dpr,
    w <= 640 ? 1.5 : 2,
    Math.sqrt((w <= 640 ? 1_000_000 : 2_100_000) / (w * h)),
  );
}
export function drawCity(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  photo?: HTMLImageElement,
  blur = 3.2,
) {
  if (photo) {
    const scale = resolution(w, h);
    canvas.width = Math.floor(w * scale);
    canvas.height = Math.floor(h * scale);
    const c = canvas.getContext("2d");
    if (!c) throw new Error("Canvas unavailable");
    c.setTransform(scale, 0, 0, scale, 0, 0);
    const cover = Math.max(
      (w + 24) / photo.naturalWidth,
      (h + 24) / photo.naturalHeight,
    );
    const width = photo.naturalWidth * cover,
      height = photo.naturalHeight * cover;
    // One cached optical blur. Real architecture stays recognizable behind the glass.
    c.filter = `blur(${blur}px) saturate(0.82) brightness(0.96)`;
    c.drawImage(photo, (w - width) / 2, (h - height) / 2, width, height);
    c.filter = "none";
    c.fillStyle = "rgba(4, 22, 34, 0.08)";
    c.fillRect(0, 0, w, h);
    return;
  }
  const scale = resolution(w, h);
  canvas.width = Math.floor(w * scale);
  canvas.height = Math.floor(h * scale);
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Canvas unavailable");
  c.setTransform(scale, 0, 0, scale, 0, 0);
  const sw = Math.max(w, h * 1.35),
    offset = (w - sw) / 2;
  c.translate(offset, 0);
  const random = seeded(73471);
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#0b1928");
  sky.addColorStop(0.48, "#203c46");
  sky.addColorStop(1, "#08151d");
  c.fillStyle = sky;
  c.fillRect(-offset, 0, w, h);
  const glow = (
    x: number,
    y: number,
    r: number,
    rgb: string,
    alpha: number,
  ) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(0.2, `rgba(${rgb},${alpha * 0.55})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  };
  glow(sw * 0.52, h * 0.48, h * 0.45, "62,125,129", 0.3);
  // Blur the completed cached scene once, not thousands of individual windows.
  for (let i = 0; i < 25; i++) {
    const bw = sw * (0.024 + random() * 0.055),
      x = (i * sw) / 24,
      bh = h * (0.12 + random() * 0.31),
      y = h * 0.65 - bh;
    c.fillStyle = ["#132833", "#142c38", "#18343e"][i % 3];
    c.fillRect(x, y, bw, bh);
    for (let wy = y + 10; wy < h * 0.63; wy += 12)
      for (let wx = x + 5; wx < x + bw - 4; wx += 10)
        if (random() > 0.56) {
          c.fillStyle = random() > 0.75 ? "#baa47755" : "#73a6a24a";
          c.fillRect(wx, wy, 3, 4);
        }
  }
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) {
      const step = i / 5,
        bw = sw * (0.13 - step * 0.012),
        x =
          side < 0
            ? sw * (step * 0.38) - bw * 0.2
            : sw * (1 - step * 0.38) - bw * 0.8;
      const top = h * (0.01 + step * 0.42),
        bottom = h * (0.89 - step * 0.31);
      c.fillStyle = i % 2 ? "#10242e" : "#0b1c27";
      c.fillRect(x, top, bw, bottom - top);
      c.fillStyle = "#5c737514";
      c.fillRect(x + bw - 4, top, 3, bottom - top);
      const spacing = 16 + (1 - step) * 12;
      for (let yy = top + 20; yy < bottom - 15; yy += spacing)
        for (let xx = x + 12; xx < x + bw - 10; xx += spacing * 0.74) {
          const light = random();
          c.fillStyle =
            light > 0.8 ? "#d7b27890" : light > 0.58 ? "#58888866" : "#17343d";
          c.fillRect(xx, yy, spacing * 0.3, spacing * 0.45);
          if (light > 0.94)
            glow(xx + 3, yy + 4, spacing * 1.5, "231,171,85", 0.14);
        }
      const shopY = bottom - h * 0.075;
      c.fillStyle = i % 2 ? "#9a784653" : "#497a7455";
      c.fillRect(x + 7, shopY, bw - 14, h * 0.055);
      for (let xx = x + 12; xx < x + bw; xx += bw / 4) {
        c.fillStyle = "#0c1b23";
        c.fillRect(xx, shopY, 4, h * 0.06);
      }
      if (i === 1 || i === 3) {
        c.fillStyle = side < 0 ? "#d9ac69" : "#69b1b0";
        c.fillRect(x + bw * 0.1, shopY - 7, bw * 0.62, 3);
        glow(
          x + bw * 0.4,
          shopY,
          sw * 0.07,
          side < 0 ? "222,159,75" : "70,166,171",
          0.24,
        );
      }
    }
  c.filter = "none";
  const road = c.createLinearGradient(0, h * 0.57, 0, h);
  road.addColorStop(0, "#284349");
  road.addColorStop(1, "#0b1b25");
  c.fillStyle = road;
  c.beginPath();
  c.moveTo(sw * 0.49, h * 0.57);
  c.lineTo(sw * 0.56, h * 0.57);
  c.lineTo(sw * 0.93, h);
  c.lineTo(sw * 0.07, h);
  c.closePath();
  c.fill();
  c.filter = "none";
  c.save();
  c.beginPath();
  c.moveTo(sw * 0.49, h * 0.57);
  c.lineTo(sw * 0.56, h * 0.57);
  c.lineTo(sw * 0.93, h);
  c.lineTo(sw * 0.07, h);
  c.closePath();
  c.clip();
  for (let i = 0; i < 2500; i++) {
    const depth = random(),
      y = h * (0.58 + depth * 0.42),
      band = random() > 0.45,
      center = sw * (band ? 0.38 : 0.67),
      x = center + (random() - 0.5) * sw * (0.03 + depth * 0.27);
    c.fillStyle = band
      ? `rgba(210,162,90,${random() * 0.075})`
      : `rgba(78,149,152,${random() * 0.09})`;
    c.fillRect(x, y, 2 + random() * depth * sw * 0.04, 0.5 + random() * 1.8);
  }
  c.restore();
  for (const [x, y, s] of [
    [0.27, 0.42, 1],
    [0.38, 0.51, 0.65],
    [0.46, 0.55, 0.35],
    [0.7, 0.38, 1.15],
    [0.61, 0.5, 0.55],
  ]) {
    c.strokeStyle = "#112029";
    c.lineWidth = 3 * s;
    c.beginPath();
    c.moveTo(sw * x, h * y);
    c.lineTo(sw * x, h * (y + 0.26 * s));
    c.stroke();
    glow(sw * x, h * y, h * 0.105 * s, "242,179,85", 0.37);
    glow(sw * x, h * y, h * 0.033 * s, "254,209,134", 0.6);
    c.fillStyle = "#f0d4a1";
    c.beginPath();
    c.ellipse(sw * x, h * y, 5 * s, 3 * s, 0, 0, Math.PI * 2);
    c.fill();
  }
  for (let i = 0; i < 50; i++) {
    const x = sw * (0.18 + random() * 0.66),
      y = h * (0.53 + random() * 0.16),
      r = 2 + random() * 5;
    glow(x, y, r * 5, i % 3 ? "241,170,92" : "93,188,190", 0.15);
    c.fillStyle = i % 3 ? "#d3a56788" : "#71b3b288";
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
  c.filter = "none";
  const veil = c.createLinearGradient(0, 0, 0, h);
  veil.addColorStop(0, "#0c1c2930");
  veil.addColorStop(0.52, "#40737b15");
  veil.addColorStop(1, "#06111b30");
  c.fillStyle = veil;
  c.fillRect(-offset, 0, w, h);
  const sharp = document.createElement("canvas");
  sharp.width = canvas.width;
  sharp.height = canvas.height;
  const sharpContext = sharp.getContext("2d");
  if (!sharpContext) throw new Error("Canvas unavailable");
  sharpContext.drawImage(canvas, 0, 0);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.filter = `blur(${3 * scale}px)`;
  c.drawImage(sharp, 0, 0);
  c.filter = "none";
}
