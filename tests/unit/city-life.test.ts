import { expect, it } from "vitest";
import { buildingLightLevel, roadPoint, windSpeed } from "../../src/city-life";

it.each([
  [0, 1 / 3],
  [1, 0],
  [3, 0],
  [5, 0],
  [6, 1 / 3],
  [8, 1],
  [12, 1],
  [22, 1],
  [23, 2 / 3],
])("현지 %i시 조명 비율", (hour, level) => {
  expect(buildingLightLevel(new Date(2026, 8, 21, hour, 0, 0))).toBeCloseTo(
    level,
  );
});
it("자정 양쪽 조명이 연속적으로 감소", () => {
  const before = buildingLightLevel(new Date(2026, 8, 21, 23, 59, 59));
  const after = buildingLightLevel(new Date(2026, 8, 22, 0, 0, 0));
  expect(Math.abs(before - after)).toBeLessThan(0.001);
});
it("바람 방향과 최대 횡속도", () => {
  expect(windSpeed(0)).toBe(0);
  expect(windSpeed(-1)).toBe(-34);
  expect(windSpeed(2)).toBe(34);
});
it("차량 경로는 구간 경계에서 이어지고 입력 범위 제한", () => {
  expect(roadPoint(-1)).toEqual(roadPoint(0));
  expect(roadPoint(2)).toEqual(roadPoint(1));
  const a = roadPoint(3 / 7 - 0.00001),
    b = roadPoint(3 / 7 + 0.00001);
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.0001);
});
