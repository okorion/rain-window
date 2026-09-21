import { test, expect } from "@playwright/test";

test("굴절 애니메이션, 무강수 정지와 재개 영상", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: "test-results/motion",
      size: { width: 1440, height: 900 },
    },
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await expect(page.locator("#rain")).toHaveAttribute(
      "data-renderer",
      "webgl",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-background",
      "photo",
    );
    const frame = () =>
      page
        .locator("#rain")
        .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    const first = await frame();
    await page.waitForTimeout(3000);
    expect(await frame()).not.toBe(first);
    await page.screenshot({ path: "test-results/motion-3s.png" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/motion-6s.png" });
    await page
      .getByRole("slider", { name: "비의 세기", exact: true })
      .fill("0");
    const dry = await frame();
    await page.waitForTimeout(600);
    expect(await frame()).toBe(dry);
    await page
      .getByRole("slider", { name: "비의 세기", exact: true })
      .fill("100");
    await page.waitForTimeout(3000);
    await page.getByRole("button", { name: "일시정지", exact: true }).click();
    const paused = await frame();
    await page.waitForTimeout(600);
    expect(await frame()).toBe(paused);
    await page.getByRole("button", { name: "재생", exact: true }).click();
    await page.waitForTimeout(1500);
    expect(await frame()).not.toBe(paused);
  } finally {
    await context.close();
  }
  await page.video()!.saveAs("docs/screenshots/rain-motion.webm");
});

test("WebGL 미지원 시 정적 대체 화면", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.locator(".status")).toContainText("정적인 야경");
  await expect(page.locator("#rain")).toBeHidden();
  await expect(page.locator("#intensity")).toBeDisabled();
});

test("실제 GPU context 상실에서 렌더 중단", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#rain")).toHaveAttribute("data-renderer", "webgl");
  await page.locator("#rain").evaluate((c) => {
    const gl = (c as HTMLCanvasElement).getContext("webgl")!;
    const extension = gl.getExtension("WEBGL_lose_context");
    if (!extension) throw new Error("Context loss test extension unavailable");
    extension.loseContext();
  });
  await expect(page.locator(".status")).toContainText("정적인 야경");
  await expect(page.locator("#rain")).toBeHidden();
});
