import { expect, test } from "@playwright/test";
import { rename } from "node:fs/promises";

test("도로 픽셀에서 새벽 차량 이동이 식별되며 시간대별 밀도 변화", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: "Asia/Seoul",
    recordVideo: {
      dir: "test-results/traffic-video",
      size: { width: 1440, height: 900 },
    },
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-09-22T12:00:00+09:00"));
  await page.goto(baseURL!);
  await expect(page.locator("html")).toHaveAttribute(
    "data-background",
    "photo",
  );
  await page.screenshot({ path: "docs/screenshots/traffic-density-after.png" });
  await page.getByRole("button", { name: "재생", exact: true }).click();
  for (const [hour, count] of [
    [3, 8],
    [8, 40],
    [12, 26],
    [18, 40],
    [22, 20],
  ]) {
    await page.clock.setFixedTime(
      new Date(`2026-09-22T${String(hour).padStart(2, "0")}:00:00+09:00`),
    );
    await expect(page.locator("#city")).toHaveAttribute(
      "data-traffic",
      count.toFixed(2),
    );
  }
  await page.clock.setFixedTime(new Date("2026-09-22T18:00:00+09:00"));
  await expect(page.locator("#city")).toHaveAttribute("data-traffic", "40.00");
  await page.waitForTimeout(3500);
  await page.screenshot({ path: "docs/screenshots/traffic-rush-hour.png" });
  await page.clock.setFixedTime(new Date("2026-09-22T03:00:00+09:00"));
  await expect(page.locator("#city")).toHaveAttribute("data-traffic", "8.00");
  await page.getByRole("slider", { name: "비의 세기" }).fill("0");
  // Rain is off, office windows are off; this road crop excludes moving clouds.
  const pixels = () =>
    page.locator("#city").evaluate((c) => {
      const canvas = c as HTMLCanvasElement,
        s = canvas.width / innerWidth;
      return Array.from(
        canvas
          .getContext("2d")!
          .getImageData(
            Math.round(735 * s),
            Math.round(500 * s),
            Math.round(180 * s),
            Math.round(235 * s),
          ).data,
      );
    });
  const before = await pixels();
  await page.waitForTimeout(3000);
  const after = await pixels();
  let visibleChanges = 0;
  for (let i = 0; i < before.length; i += 4)
    if (
      Math.max(
        ...[0, 1, 2].map((ch) => Math.abs(before[i + ch] - after[i + ch])),
      ) > 12
    )
      visibleChanges++;
  expect(visibleChanges).toBeGreaterThan(40);
  await page.getByRole("slider", { name: "비의 세기" }).fill("50");
  await page.getByRole("slider", { name: "비의 세기" }).blur();
  await page.screenshot({ path: "docs/screenshots/traffic-overnight.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "docs/screenshots/traffic-density-mobile.png",
  });
  const video = page.video()!;
  await context.close();
  await rename(
    await video.path(),
    "docs/screenshots/traffic-density-motion.webm",
  );
});
