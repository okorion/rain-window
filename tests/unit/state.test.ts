import { describe, expect, it } from "vitest";
import {
  active,
  audible,
  dropLimit,
  FrameClock,
  type ExperienceState,
} from "../../src/state";
import { resolution } from "../../src/scene";
const state: ExperienceState = {
  paused: false,
  hidden: false,
  sound: false,
  volume: 0.35,
  intensity: 0.5,
};
describe("감상 상태와 성능 경계", () => {
  it("기본은 움직이지만 무음", () => {
    expect(active(state)).toBe(true);
    expect(audible(state)).toBe(false);
  });
  it.each([
    { paused: true },
    { hidden: true },
    { volume: 0 },
    { intensity: 0 },
  ])("정지·숨김·0 음량·0 강도에서 소리 없음: %j", (patch) => {
    expect(audible({ ...state, sound: true, ...patch })).toBe(false);
  });
  it("재개는 기존 음향 선택과 음량을 유지", () => {
    const chosen = { ...state, sound: true, volume: 0.7, paused: true };
    expect(audible(chosen)).toBe(false);
    expect(audible({ ...chosen, paused: false })).toBe(true);
  });
  it("물방울 밀도 상한", () => {
    expect(dropLimit(390, 1)).toBe(240);
    expect(dropLimit(1440, 1)).toBe(560);
    expect(dropLimit(1440, 2)).toBe(560);
    expect(dropLimit(1440, 0)).toBeGreaterThan(0);
  });
  it("고해상도에서 픽셀 예산 제한", () => {
    expect(390 * 844 * resolution(390, 844, 3) ** 2).toBeLessThanOrEqual(
      1_000_000,
    );
    expect(3840 * 2160 * resolution(3840, 2160, 3) ** 2).toBeLessThanOrEqual(
      2_100_001,
    );
  });
  it("프레임 제한과 정지 후 시간 도약 방지", () => {
    const clock = new FrameClock();
    expect(clock.tick(0, 30)).toBe(0);
    expect(clock.tick(10, 30)).toBe(null);
    expect(clock.tick(34, 30)).toBe(0.034);
    clock.reset();
    expect(clock.tick(100000, 30)).toBe(0);
    expect(clock.tick(200000, 30)).toBe(0.05);
  });
});
