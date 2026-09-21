import { expect, test } from "@playwright/test";

for (const fallback of [false, true]) {
  test(`창밖 비 강도·정지·재개 ${fallback ? "사진 실패" : "사진 배경"}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.setFixedTime(new Date(2026, 8, 22, 12));
    if (fallback)
      await page.route("**/images/city-highrise.jpg", (route) => route.abort());
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute(
      "data-background",
      fallback ? "fallback" : "photo",
    );
    const frame = () =>
      page
        .locator("#city")
        .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    const intensity = page.getByRole("slider", {
      name: "비의 세기",
      exact: true,
    });
    await intensity.fill("0");
    const dry = await frame();
    await intensity.fill("100");
    const wet = await frame();
    expect(wet).not.toBe(dry);
    await page.waitForTimeout(250);
    expect(await frame()).toBe(wet);
    await intensity.fill("0");
    expect(await frame()).toBe(dry);
    await intensity.fill("100");
    expect(await frame()).toBe(wet);
    await page.getByRole("button", { name: "재생", exact: true }).click();
    await page.waitForTimeout(500);
    expect(await frame()).not.toBe(wet);
    await page.getByRole("button", { name: "일시정지", exact: true }).click();
    const stopped = await frame();
    await page.waitForTimeout(250);
    expect(await frame()).toBe(stopped);
  });
}
