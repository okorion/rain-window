import { expect, it } from "vitest";
import { fillRainChannel } from "../../src/rain-sound";

it("빗소리는 DC·클리핑 없이 고주파를 억제한 낮은 음압을 유지", () => {
  const data = new Float32Array(48000 * 3);
  fillRainChannel(data, 48000, 3127);
  let sum = 0,
    power = 0,
    difference = 0,
    peak = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    power += data[i] ** 2;
    peak = Math.max(peak, Math.abs(data[i]));
    if (i) difference += (data[i] - data[i - 1]) ** 2;
  }
  expect(Math.abs(sum / data.length)).toBeLessThan(0.0001);
  expect(Math.sqrt(power / data.length)).toBeLessThanOrEqual(0.121);
  expect(Math.sqrt(power / data.length)).toBeGreaterThan(0.08);
  expect(peak).toBeLessThan(0.7);
  // Adjacent-sample energy catches accidental raw white-noise mixing (ratio ~2).
  expect(difference / power).toBeLessThan(0.08);
  expect(Math.abs(data[0] - data.at(-1)!)).toBeLessThan(0.06);
});
it("좌우 채널에 서로 다른 빗방울 질감 유지", () => {
  const a = new Float32Array(24000),
    b = new Float32Array(24000);
  fillRainChannel(a, 24000, 3127);
  fillRainChannel(b, 24000, 4044);
  let cross = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    cross += a[i] * b[i];
    aa += a[i] ** 2;
    bb += b[i] ** 2;
  }
  expect(Math.abs(cross / Math.sqrt(aa * bb))).toBeLessThan(0.2);
});
