import { expect, it } from "vitest";
import { vehicleOptics } from "../../src/vehicle-lights";

it("비가 강할수록 광원은 넓어지고 최대 밝기와 적분 광량은 감소", () => {
  for (const meters of [0, 600, 1200]) {
    let previous = vehicleOptics(meters, 0);
    for (const rain of [0.25, 0.5, 0.75, 1]) {
      const current = vehicleOptics(meters, rain);
      expect(current.sigma).toBeGreaterThan(previous.sigma);
      expect(current.peak).toBeLessThan(previous.peak);
      expect(current.peak * current.sigma ** 2).toBeLessThan(
        previous.peak * previous.sigma ** 2,
      );
      previous = current;
    }
  }
});

it("원거리 차량의 등 간격·광량 감소, 강우 감쇠는 더 큼", () => {
  const near = vehicleOptics(0, 1),
    far = vehicleOptics(1200, 1);
  expect(far.separation).toBeLessThan(near.separation);
  expect(far.peak).toBeLessThan(near.peak);
  expect(far.transmission / vehicleOptics(1200, 0).transmission).toBeLessThan(
    near.transmission / vehicleOptics(0, 0).transmission,
  );
});

it("사진 확대는 크기만 바꾸고 강우 입력은 범위 제한", () => {
  const a = vehicleOptics(600, 0.5),
    b = vehicleOptics(600, 0.5, 2);
  expect(b.peak).toBe(a.peak);
  expect(b.sigma).toBe(a.sigma * 2);
  expect(b.separation).toBe(a.separation * 2);
  expect(vehicleOptics(600, -1)).toEqual(vehicleOptics(600, 0));
  expect(vehicleOptics(600, 2)).toEqual(vehicleOptics(600, 1));
});
