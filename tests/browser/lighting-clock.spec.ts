import { expect, test } from "@playwright/test";
test.use({ timezoneId: "Asia/Seoul" });

test("차량이 실제 도로에서 이동하고 정지·재개되며 새벽에도 조명 유지", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-22T03:00:00+09:00"));
  await page.addInitScript(() => {
    const frames: { x: number; y: number }[] = [];
    Object.assign(window, { trafficFrames: frames });
    const original = CanvasRenderingContext2D.prototype.fillRect;
    let calls = 0;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
      if (
        this.canvas.id === "city" &&
        this.fillStyle instanceof CanvasGradient &&
        x === -3 &&
        y === -3 &&
        w === 6 &&
        h === 6
      ) {
        // Two lamp footprints and six asphalt glints per car, 22 cars.
        if (calls++ % 176 === 0) {
          const transform = this.getTransform();
          frames.push({ x: transform.e, y: transform.f });
          if (frames.length > 100) frames.shift();
        }
      }
      return original.call(this, x, y, w, h);
    };
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-background",
    "photo",
  );
  await page.getByRole("slider", { name: "비의 세기", exact: true }).fill("0");
  await page.waitForTimeout(1500);
  const positions = await page.evaluate(
    () =>
      (window as unknown as { trafficFrames: { x: number; y: number }[] })
        .trafficFrames,
  );
  expect(positions.length).toBeGreaterThan(5);
  expect(
    Math.hypot(
      positions.at(-1)!.x - positions[0].x,
      positions.at(-1)!.y - positions[0].y,
    ),
  ).toBeGreaterThan(0.2);
  expect(
    Math.hypot(
      positions.at(-1)!.x - positions[0].x,
      positions.at(-1)!.y - positions[0].y,
    ),
  ).toBeLessThan(10);
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  const frame = () =>
    page.locator("#city").evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  const paused = await frame();
  await page.waitForTimeout(300);
  expect(await frame()).toBe(paused);
  await expect(page.locator("#city")).toHaveAttribute("data-lights", "0.000");
  await page.screenshot({ path: "docs/screenshots/streetlights-0300.png" });
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await page.waitForTimeout(300);
  expect(await frame()).not.toBe(paused);
});

test("현지 시계는 감상 정지 중에도 갱신되고 작은 화면에서 겹치지 않음", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-09-22T10:23:00+09:00"));
  await page.goto("/");
  await expect(page.locator("#clock")).toHaveText("10:23");
  await page.clock.setFixedTime(new Date("2026-09-22T10:24:00+09:00"));
  await expect(page.locator("#clock")).toHaveText("10:24");
  await expect(
    page.getByRole("button", { name: "재생", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 568 });
  const clock = await page.locator("#clock").boundingBox(),
    brand = await page.locator("h1").boundingBox();
  expect(clock!.x).toBeGreaterThan(brand!.x + brand!.width);
  expect(clock!.x + clock!.width).toBeLessThan(320);
});
