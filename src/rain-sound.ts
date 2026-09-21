import { seeded } from "./scene";

/** Soft indoor rain bed plus irregular damped impacts, generated once per channel. */
export function fillRainChannel(
  data: Float32Array,
  sampleRate: number,
  seed: number,
) {
  const random = seeded(seed);
  const overlap = Math.min(
    Math.round(sampleRate * 0.12),
    Math.floor(data.length / 4),
  );
  const signal = new Float32Array(data.length + overlap);
  const seconds = data.length / sampleRate;
  let low = 0,
    body = 0,
    air = 0;
  const coefficient = (hz: number) =>
    1 - Math.exp((-2 * Math.PI * hz) / sampleRate);
  const a = coefficient(160),
    b = coefficient(850),
    d = coefficient(2200);
  for (let i = 0; i < signal.length; i++) {
    const noise = random() * 2 - 1,
      t = i / sampleRate;
    low += a * (noise - low);
    body += b * (noise - body);
    air += d * (body - air);
    const swell =
      0.84 + 0.1 * Math.sin(t * 0.51) + 0.06 * Math.sin(t * 1.19 + seed);
    signal[i] = (low * 0.42 + air * 0.65) * swell;
  }
  // Soft taps on glass and diffuse patter, with rounded attacks instead of clicks.
  for (let t = 0; t < seconds + 0.12;) {
    t += -Math.log(Math.max(0.00001, random())) / 38;
    const start = Math.floor(t * sampleRate),
      duration = 0.018 + random() ** 2 * 0.12;
    const size = Math.ceil(duration * sampleRate),
      amp = 0.035 + random() ** 3 * 0.23;
    const frequency = 430 + random() * 1150;
    let texture = 0;
    for (let j = 0; j < size && start + j < signal.length; j++) {
      const u = j / sampleRate;
      const envelope =
        (1 - Math.exp(-u / 0.0025)) * Math.exp((-u * 7) / duration);
      texture += b * (random() * 2 - 1 - texture);
      const tap = texture * 0.85 + Math.sin(2 * Math.PI * frequency * u) * 0.15;
      signal[start + j] += tap * envelope * amp;
    }
  }
  for (let i = 0; i < data.length; i++) {
    const t = i / Math.max(1, overlap);
    data[i] =
      i < overlap
        ? signal[data.length + i] * (1 - t) + signal[i] * t
        : signal[i];
  }
  let power = 0,
    mean = 0;
  for (const value of data) {
    power += value * value;
    mean += value;
  }
  mean /= data.length;
  const gain = Math.min(
    2,
    0.12 / Math.max(0.001, Math.sqrt(power / data.length)),
  );
  for (let i = 0; i < data.length; i++)
    data[i] = Math.max(-0.7, Math.min(0.7, (data[i] - mean) * gain));
}
