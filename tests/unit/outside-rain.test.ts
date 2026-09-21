import { describe, expect, it } from "vitest";
import { OutsideRain } from "../../src/outside-rain";

describe("창밖의 비", () => {
  it("강도 0은 비를 없애고 모바일·대형 화면에도 상한을 유지한다", () => {
    const rain = new OutsideRain();
    for (const [w, h, cap] of [
      [390, 844, 420],
      [640, 4000, 420],
      [7680, 4320, 900],
    ]) {
      rain.resize(w, h);
      rain.setIntensity(1);
      const full = rain.streaks().length;
      expect(full).toBeLessThanOrEqual(cap);
      rain.setIntensity(0.5);
      expect(rain.streaks().length).toBe(Math.round(full / 2));
      rain.setIntensity(0);
      expect(rain.streaks()).toEqual([]);
    }
  });
  it("바람은 양방향 기울기와 이동에 반영되며 무풍에도 비가 내린다", () => {
    const frames = [-1, 0, 1].map((wind) => {
      const rain = new OutsideRain();
      rain.resize(1440, 900);
      rain.setWind(wind);
      rain.step(0.05);
      return rain.streaks()[0];
    });
    expect(frames[0].dx).toBeLessThan(0);
    expect(frames[1].dx).toBe(0);
    expect(frames[2].dx).toBeGreaterThan(0);
    expect(frames[0].x).toBeLessThan(frames[1].x);
    expect(frames[2].x).toBeGreaterThan(frames[1].x);
    expect(frames[1].dy).toBeGreaterThan(0);
  });
  it("정지 시간과 비 0은 누적하지 않고 긴 프레임을 제한한다", () => {
    const a = new OutsideRain(),
      b = new OutsideRain();
    a.resize(1440, 900);
    b.resize(1440, 900);
    const before = a.streaks();
    a.step(0);
    a.setIntensity(0);
    a.step(120);
    a.setIntensity(0.5);
    expect(a.streaks()).toEqual(before);
    a.step(120);
    b.step(0.05);
    expect(a.streaks()).toEqual(b.streaks());
  });
  it("세 깊이의 길이·속도 차이를 유지하며 장시간 화면 밖으로 유실되지 않는다", () => {
    const rain = new OutsideRain();
    rain.resize(390, 844);
    rain.setWind(-1);
    rain.setIntensity(1);
    for (let i = 0; i < 2400; i++) rain.step(0.05);
    const drops = rain.streaks();
    expect(new Set(drops.map((p) => p.depth)).size).toBe(3);
    for (const p of drops) {
      expect(p.x).toBeGreaterThanOrEqual(-80);
      expect(p.x).toBeLessThan(470);
      expect(p.y).toBeGreaterThanOrEqual(-50);
      expect(p.y).toBeLessThan(894);
    }
  });
});
