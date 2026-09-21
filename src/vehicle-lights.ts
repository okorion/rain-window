import { clamp } from "./state";

/** Calibrated scene approximation, not a measured rainfall/visibility conversion. */
export function vehicleOptics(
  meters: number,
  intensity: number,
  imageScale = 1,
) {
  const rain = clamp(intensity);
  const distance = 450 + clamp(meters, 0, 1200);
  const projection = 450 / distance;
  // Beer–Lambert attenuation through rain/mist. Unresolved lamps also lose
  // received flux with distance squared; do not brighten the enlarged halo.
  const transmission = Math.exp(-(0.00012 + 0.00095 * rain ** 1.35) * distance);
  const sigma = (0.65 + rain * (0.55 + distance * 0.0003)) * imageScale;
  const flux = projection ** 2 * transmission;
  const peak = 0.72 * flux * ((0.65 * imageScale) / sigma) ** 2;
  return {
    transmission,
    sigma,
    peak,
    separation: 3.4 * projection * imageScale,
    reflectionLength: (3 + 9 * projection) * imageScale,
    reflectionPeak: peak * (0.1 + rain * 0.06),
  };
}

// Smooth point-spread footprint. Unlike solid rectangles, subpixel lamps merge
// into a soft distant pair. The 3-sigma boundary is effectively transparent.
function spot(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  sx: number,
  sy: number,
  color: string,
  peak: number,
) {
  c.save();
  c.translate(x, y);
  c.scale(sx, sy);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 3);
  for (const radius of [0, 0.5, 1, 1.5, 2, 2.5, 3])
    g.addColorStop(
      radius / 3,
      `rgba(${color},${radius === 3 ? 0 : peak * Math.exp(-(radius ** 2) / 2)})`,
    );
  c.fillStyle = g;
  c.fillRect(-3, -3, 6, 6);
  c.restore();
}

export function drawVehicleLights(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  meters: number,
  intensity: number,
  imageScale: number,
  away: boolean,
  opacity: number,
  transverseAngle: number,
) {
  const o = vehicleOptics(meters, intensity, imageScale);
  // Neutral white headlamps, red running lamps (not amber street lamps).
  const color = away ? "225,63,48" : "220,231,237";
  const power = opacity * (away ? 0.7 : 1);
  const dx = (Math.cos(transverseAngle) * o.separation) / 2;
  const dy = (Math.sin(transverseAngle) * o.separation) / 2;
  for (const side of [-1, 1]) {
    const lx = x + side * dx,
      ly = y + side * dy;
    spot(c, lx, ly, o.sigma, o.sigma * 0.8, color, o.peak * power);
    // Discontinuous wet-asphalt glints toward the observer. No long-exposure
    // speed trails; the reflection moves with the car and shares attenuation.
    for (let j = 0; j < 3; j++)
      spot(
        c,
        lx,
        ly + (0.3 + j * 0.28) * o.reflectionLength,
        o.sigma * (0.65 + j * 0.15),
        o.reflectionLength * 0.1,
        color,
        o.reflectionPeak * power * (1 - j * 0.28),
      );
  }
  return o;
}
