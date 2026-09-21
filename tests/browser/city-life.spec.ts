import { expect, test } from "@playwright/test";
test.use({ timezoneId: "Asia/Seoul" });

test("바람 양방향·무풍, 도시 움직임과 전체 정지", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-21T12:00:00+09:00"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-background",
    "photo",
  );
  const wind = page.getByRole("slider", { name: "바람 방향과 세기" });
  for (const [value, text] of [
    ["-100", "왼쪽 100%"],
    ["0", "무풍"],
    ["100", "오른쪽 100%"],
  ]) {
    await wind.fill(value);
    await expect(wind).toHaveAttribute("aria-valuetext", text);
  }
  const frame = () =>
    page.locator("#city").evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  const before = await frame();
  await page.waitForTimeout(500);
  expect(await frame()).not.toBe(before);
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  const stopped = await frame();
  await page.waitForTimeout(500);
  expect(await frame()).toBe(stopped);
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await page.waitForTimeout(500);
  expect(await frame()).not.toBe(stopped);
  await page.setViewportSize({ width: 320, height: 568 });
  const bounds = await wind.boundingBox();
  expect(bounds!.x).toBeGreaterThan(0);
  expect(bounds!.x + bounds!.width).toBeLessThan(320);
});

test("현지 시간에 따른 사무실 소등·재점등과 실화면", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-21T12:00:00+09:00"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-background",
    "photo",
  );
  await expect(page.locator("#city")).toHaveAttribute("data-lights", "1.000");
  const brightness = () =>
    page.locator("#city").evaluate((c) => {
      const canvas = c as HTMLCanvasElement;
      const d = canvas
        .getContext("2d")!
        .getImageData(
          0,
          Math.floor(canvas.height / 2),
          canvas.width,
          Math.floor(canvas.height / 2),
        ).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      return sum / d.length;
    });
  const day = await brightness();
  await page.screenshot({ path: "docs/screenshots/city-daytime.png" });
  await page.clock.setFixedTime(new Date("2026-09-22T03:00:00+09:00"));
  await expect(page.locator("#city")).toHaveAttribute("data-lights", "0.000");
  expect(await brightness()).toBeLessThan(day * 0.75);
  await page.screenshot({ path: "docs/screenshots/city-late-night.png" });
  await page.clock.setFixedTime(new Date("2026-09-22T06:30:00+09:00"));
  await expect(page.locator("#city")).toHaveAttribute("data-lights", "0.500");
  await page.clock.setFixedTime(new Date("2026-09-22T12:00:00+09:00"));
  await expect(page.locator("#city")).toHaveAttribute("data-lights", "1.000");
});
