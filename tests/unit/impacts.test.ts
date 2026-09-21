import { describe, expect, it } from "vitest";
import { Impacts, impactShape, IMPACT_LIMIT } from "../../src/impacts";
import { seeded } from "../../src/scene";

describe("유리 충격", () => {
  const simulate = (fps: number, width = 1440, height = 900) => {
    const impacts = new Impacts(seeded(10));
    let count = 0;
    for (let i = 0; i < fps * 10; i++)
      count += impacts.step(1 / fps, 0.5, width, height).length;
    return count;
  };
  it("프레임률이 달라도 같은 시간의 도착 수 유지", () => {
    expect(simulate(30)).toBe(simulate(60));
    expect(simulate(60)).toBe(simulate(120));
  });
  it("작은 화면은 충격 밀도를 제한", () => {
    expect(simulate(60, 390, 844)).toBeLessThan(simulate(60));
  });
  it("비 0과 시간 정지는 생성·진행 모두 중지", () => {
    const model = new Impacts(seeded(10));
    for (let i = 0; i < 30; i++) model.step(1 / 30, 1, 1440, 900);
    const before = JSON.stringify(model.items);
    expect(model.step(0.05, 0, 1440, 900)).toEqual([]);
    expect(model.step(0, 1, 1440, 900)).toEqual([]);
    expect(JSON.stringify(model.items)).toBe(before);
  });
  it("장시간 강한 비에서도 충격과 작은 튀김 수 제한", () => {
    const model = new Impacts(seeded(30));
    for (let i = 0; i < 3600; i++) {
      model.step(1 / 30, 1, 3840, 2160);
      expect(model.items.length).toBeLessThanOrEqual(IMPACT_LIMIT);
      expect(
        model.items.every(
          (hit) => hit.age < 0.48 && hit.satellites.length <= 4,
        ),
      ).toBe(true);
    }
    model.reset();
    expect(model.items).toEqual([]);
  });
  it("퍼진 방울이 짧게 수축해 정지 방울로 연속적으로 정착", () => {
    expect(impactShape(0.045).spread).toBeGreaterThan(1.4);
    expect(impactShape(0.48).spread).toBeCloseTo(1, 2);
    expect(impactShape(0.48).flatten).toBe(1);
    expect(impactShape(0.48).irregularity).toBe(0);
  });
});
