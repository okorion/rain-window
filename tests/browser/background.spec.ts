import { test, expect } from "@playwright/test";

test("실제 도시 사진과 기본 물방울의 가시 면적", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-background",
    "photo",
  );
  await expect(page.locator("#rain")).toHaveAttribute("data-renderer", "webgl");
  const coverage = await page.locator("#rain").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const ctx = copy.getContext("2d")!;
    ctx.drawImage(canvas, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let visible = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 100) visible++;
    return visible / (canvas.width * canvas.height);
  });
  // Prevent the original near-invisible glass from returning, independent of photo colors.
  expect(coverage).toBeGreaterThan(0.015);
  await expect(
    page.getByRole("button", { name: "재생", exact: true }),
  ).toBeVisible();
});

test("사진 로딩 실패에도 기본 야경과 비 조작 유지", async ({ page }) => {
  await page.route("**/images/city-highrise.jpg", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-background",
    "fallback",
  );
  await expect(page.locator(".status")).toContainText(
    "도시 사진을 불러오지 못해",
  );
  await expect(page.locator("#city")).toBeVisible();
  await expect(page.locator("#rain")).toBeVisible();
  await page
    .getByRole("slider", { name: "비의 세기", exact: true })
    .fill("100");
  await expect(page.locator("#intensity-value")).toHaveText("100%");
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "재생", exact: true }),
  ).toBeVisible();
});
