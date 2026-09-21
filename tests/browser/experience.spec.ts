import { test, expect } from "@playwright/test";

test("기본 무음, 세기·음량·반복 재생·정지·전체 화면", async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    Object.assign(window, {
      audioContexts: [] as AudioContext[],
      sourceCount: 0,
    });
    window.AudioContext = class extends Original {
      constructor() {
        super();
        (
          window as unknown as { audioContexts: AudioContext[] }
        ).audioContexts.push(this);
      }
      createBufferSource() {
        (window as unknown as { sourceCount: number }).sourceCount++;
        return super.createBufferSource();
      }
    };
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "빗소리 켜기" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { audioContexts: unknown[] }).audioContexts
          .length,
    ),
  ).toBe(0);
  for (const value of ["0", "50", "100"]) {
    await page
      .getByRole("slider", { name: "비의 세기", exact: true })
      .fill(value);
    await expect(page.locator("#intensity-value")).toHaveText(value + "%");
  }
  await page.getByRole("slider", { name: "빗소리 음량" }).fill("70");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { audioContexts: unknown[] }).audioContexts
          .length,
    ),
  ).toBe(0);
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "빗소리 켜기" }).click();
    await page.getByRole("button", { name: "빗소리 끄기" }).click();
  }
  await page.getByRole("button", { name: "빗소리 켜기" }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { sourceCount: number }).sourceCount,
    ),
  ).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { audioContexts: AudioContext[] })
            .audioContexts[0].state,
      ),
    )
    .toBe("running");
  await page.getByRole("slider", { name: "빗소리 음량" }).fill("0");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { audioContexts: AudioContext[] })
            .audioContexts[0].state,
      ),
    )
    .toBe("suspended");
  await page.getByRole("slider", { name: "빗소리 음량" }).fill("70");
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { audioContexts: AudioContext[] })
            .audioContexts[0].state,
      ),
    )
    .toBe("suspended");
  const stopped = await page
    .locator("#rain")
    .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(200);
  expect(
    await page
      .locator("#rain")
      .evaluate((c) => (c as HTMLCanvasElement).toDataURL()),
  ).toBe(stopped);
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { audioContexts: AudioContext[] })
            .audioContexts[0].state,
      ),
    )
    .toBe("running");
  await page.getByRole("button", { name: "전체 화면", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "전체 화면 종료" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "전체 화면 종료" }).click();
  await expect(
    page.getByRole("button", { name: "전체 화면", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "빗소리 끄기" }).click();
  expect(errors).toEqual([]);
});

test("모바일·회전·좁은 화면에서 컨트롤과 렌더 예산", async ({ page }) => {
  for (const [width, height] of [
    [390, 844],
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "일시정지" })).toBeVisible();
    const bounds = await page.locator(".controls").boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const size = await page.locator("#rain").evaluate((c) => ({
      w: (c as HTMLCanvasElement).width,
      h: (c as HTMLCanvasElement).height,
    }));
    expect(size.w * size.h).toBeLessThanOrEqual(
      width <= 640 ? 1_000_000 : 2_100_000,
    );
    await page
      .getByRole("slider", { name: "비의 세기", exact: true })
      .fill("100");
    await page.getByRole("button", { name: "일시정지" }).click();
    await expect(
      page.getByRole("button", { name: "재생", exact: true }),
    ).toBeVisible();
  }
});

test("reduced-motion은 정지로 시작하고 명시적으로 재생", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "재생", exact: true }),
  ).toBeVisible();
  const before = await page
    .locator("#rain")
    .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(200);
  expect(
    await page
      .locator("#rain")
      .evaluate((c) => (c as HTMLCanvasElement).toDataURL()),
  ).toBe(before);
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await expect(page.getByRole("button", { name: "일시정지" })).toBeVisible();
});

test("탭 비활성 이벤트에서 렌더 중단, 복귀와 사용자 정지 구분", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("html")).toHaveAttribute("data-playback", "paused");
  const stopped = await page
    .locator("#rain")
    .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(150);
  expect(
    await page
      .locator("#rain")
      .evaluate((c) => (c as HTMLCanvasElement).toDataURL()),
  ).toBe(stopped);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("html")).toHaveAttribute(
    "data-playback",
    "playing",
  );
  await page.getByRole("button", { name: "일시정지" }).click();
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("html")).toHaveAttribute("data-playback", "paused");
});

test("오디오 거부에도 그래픽 유지, 재시도 가능", async ({ page }) => {
  await page.addInitScript(() => {
    AudioContext.prototype.resume = () =>
      Promise.reject(new Error("test denial"));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "빗소리 켜기" }).click();
  await expect(page.locator(".status")).toContainText("재생하지 못했습니다");
  await expect(page.getByRole("button", { name: "빗소리 켜기" })).toBeVisible();
  await expect(page.locator("#rain")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-playback",
    "playing",
  );
});

test("Canvas 실패 시 정적 야경과 안내", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto("/");
  await expect(page.locator(".status")).toContainText("정적인 야경");
  await expect(page.locator(".fallback")).toBeVisible();
  await expect(page.locator("#rain")).toBeHidden();
});

test("지원하지 않는 전체 화면 숨김", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "fullscreenEnabled", { value: false });
  });
  await page.goto("/");
  await expect(page.locator("#fullscreen")).toBeHidden();
});

test("전체 화면 거부와 렌더 context 상실 처리", async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new Error("test denial"));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "전체 화면", exact: true }).click();
  await expect(page.locator(".status")).toContainText(
    "전체 화면으로 전환할 수 없습니다",
  );
  await expect(page.locator("#rain")).toBeVisible();
  await page
    .locator("#rain")
    .evaluate((c) => c.dispatchEvent(new Event("contextlost")));
  await expect(page.locator(".status")).toContainText("정적인 야경");
  await expect(page.locator("#rain")).toBeHidden();
});

test("실제 화면 캡처", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(3500);
  await page.screenshot({ path: "docs/screenshots/desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "docs/screenshots/mobile.png" });
});
