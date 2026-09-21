import { expect, test } from "@playwright/test";

test("실제 MP3 재생·독립 음량·반복 조작·정지와 탭 비활성", async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    Object.assign(window, { musicContexts: [], musicSources: [] });
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        (
          window as unknown as { musicContexts: AudioContext[] }
        ).musicContexts.push(this);
      }
      createBufferSource() {
        const source = super.createBufferSource();
        (
          window as unknown as { musicSources: AudioBufferSourceNode[] }
        ).musicSources.push(source);
        return source;
      }
    };
  });
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("oh-rain.mp3")) requests++;
  });
  await page.goto("/");
  await page.getByRole("slider", { name: "배경음악 음량" }).fill("65");
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "배경음악 켜기" }).click();
  await expect(page.locator("#music")).toHaveAttribute("aria-busy", "false");
  const audioState = () =>
    page.evaluate(() => {
      const w = window as unknown as {
        musicContexts: AudioContext[];
        musicSources: AudioBufferSourceNode[];
      };
      const buffer = w.musicSources[0]?.buffer;
      let energy = 0;
      if (buffer) {
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 32) energy += data[i] ** 2;
        energy = Math.sqrt(energy / (data.length / 32));
      }
      return {
        state: w.musicContexts[0]?.state,
        sources: w.musicSources.length,
        seconds: buffer?.duration ?? 0,
        rms: energy,
      };
    });
  await expect.poll(async () => (await audioState()).sources).toBe(1);
  const decoded = await audioState();
  expect(decoded.seconds).toBeGreaterThan(103);
  expect(decoded.seconds).toBeLessThan(105);
  expect(decoded.rms).toBeGreaterThan(0.07);
  expect(decoded.state).toBe("running");
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "배경음악 끄기" }).click();
    await page.getByRole("button", { name: "배경음악 켜기" }).click();
  }
  await page.getByRole("slider", { name: "배경음악 음량" }).fill("0");
  await expect.poll(async () => (await audioState()).state).toBe("suspended");
  await page.getByRole("slider", { name: "배경음악 음량" }).fill("40");
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await expect.poll(async () => (await audioState()).state).toBe("suspended");
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await expect.poll(async () => (await audioState()).state).toBe("running");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await audioState()).state).toBe("suspended");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await audioState()).state).toBe("running");
  expect((await audioState()).sources).toBe(1);
  expect(requests).toBe(1);
  await expect(
    page.getByRole("button", { name: "빗소리 켜기" }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("음원 요청 실패에도 야경 유지·재시도와 모바일 배치", async ({ page }) => {
  await page.route("**/audio/oh-rain.mp3", (route) => route.abort(), {
    times: 1,
  });
  await page.goto("/");
  await page.getByRole("button", { name: "배경음악 켜기" }).click();
  await expect(page.locator(".status")).toContainText(
    "음악을 재생하지 못했습니다",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-playback",
    "playing",
  );
  await page.getByRole("button", { name: "배경음악 켜기" }).click();
  await expect(page.locator("#music")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#music")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".status")).toBeEmpty();
  for (const [width, height] of [
    [390, 844],
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    const music = (await page.locator(".music-controls").boundingBox())!;
    const controls = (await page.locator(".controls").boundingBox())!;
    expect(music.x).toBeGreaterThanOrEqual(0);
    expect(music.x + music.width).toBeLessThanOrEqual(width);
    expect(music.y + music.height).toBeLessThan(height);
    expect(controls.y + controls.height).toBeLessThanOrEqual(music.y);
  }
});

test("음악 조작 실제 데스크톱·모바일 화면", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-09-21T12:00:00+09:00"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-background",
    "photo",
  );
  await page.screenshot({ path: "docs/screenshots/music-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "docs/screenshots/music-mobile.png" });
});

test("음악 재생 권한 거부를 안내하고 다음 클릭으로 복구", async ({ page }) => {
  await page.addInitScript(() => {
    const resume = AudioContext.prototype.resume;
    let blocked = true;
    AudioContext.prototype.resume = function () {
      if (blocked) {
        blocked = false;
        return Promise.reject(new DOMException("denied", "NotAllowedError"));
      }
      return resume.call(this);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "배경음악 켜기" }).click();
  await expect(page.locator(".status")).toContainText(
    "음악을 재생하지 못했습니다",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-playback",
    "playing",
  );
  await page.getByRole("button", { name: "배경음악 켜기" }).click();
  await expect(page.locator("#music")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#music")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".status")).toBeEmpty();
});
