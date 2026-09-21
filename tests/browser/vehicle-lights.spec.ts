import { expect, test } from "@playwright/test";

test("실제 Canvas 광원 픽셀: 강우별 선명도 감소와 백색·적색 구분", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const modulePath = "/src/vehicle-lights.ts";
    const { drawVehicleLights } = (await import(
      /* @vite-ignore */ modulePath
    )) as typeof import("../../src/vehicle-lights");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 160;
    const c = canvas.getContext("2d")!;
    return [0, 0.5, 1].map((rain) =>
      [false, true].map((away) => {
        c.clearRect(0, 0, 160, 160);
        drawVehicleLights(c, 80, 60, 0, rain, 4, away, 1, 0);
        const d = c.getImageData(0, 0, 160, 160).data;
        let peak = 0,
          mass = 0,
          spread = 0,
          red = 0,
          blue = 0;
        for (let i = 0; i < d.length; i += 4) {
          const alpha = d[i + 3] / 255,
            x = (i / 4) % 160;
          peak = Math.max(peak, alpha);
          mass += alpha;
          spread += alpha * (x - 80) ** 2;
          red += d[i] * alpha;
          blue += d[i + 2] * alpha;
        }
        return { peak, mass, spread: spread / mass, red, blue };
      }),
    );
  });
  for (const side of [0, 1]) {
    for (let i = 1; i < 3; i++) {
      expect(result[i][side].peak).toBeLessThan(result[i - 1][side].peak);
      expect(result[i][side].mass).toBeLessThan(result[i - 1][side].mass);
      expect(result[i][side].spread).toBeGreaterThan(
        result[i - 1][side].spread,
      );
    }
  }
  expect(result[0][0].blue).toBeGreaterThan(result[0][0].red);
  expect(result[0][1].red).toBeGreaterThan(result[0][1].blue * 3);
});

test("정지 중 비 0·50·100 즉시 반영과 데스크톱·모바일 실화면", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-09-21T12:00:00+09:00"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-background",
    "photo",
  );
  await page.screenshot({ path: "docs/screenshots/traffic-after.png" });
  const frames = [];
  for (const value of ["0", "50", "100"]) {
    await page.getByRole("slider", { name: "비의 세기" }).fill(value);
    await page.getByRole("slider", { name: "비의 세기" }).blur();
    frames.push(
      await page
        .locator("#city")
        .evaluate((c) => (c as HTMLCanvasElement).toDataURL()),
    );
    await page.screenshot({
      path: `docs/screenshots/traffic-rain-${value}.png`,
    });
    await expect(page.locator("html")).toHaveAttribute(
      "data-playback",
      "paused",
    );
  }
  expect(new Set(frames).size).toBe(3);
  await page.getByRole("slider", { name: "비의 세기" }).fill("50");
  await page.getByRole("slider", { name: "비의 세기" }).blur();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "docs/screenshots/traffic-mobile-after.png" });
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-playback",
    "playing",
  );
});
