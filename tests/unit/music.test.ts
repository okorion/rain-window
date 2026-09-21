import { expect, it, vi } from "vitest";
import { MusicAudio } from "../../src/music";
const on = { enabled: true, active: true, volume: 0.4 };
function setup() {
  const source = {
    start: vi.fn(),
    stop: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    buffer: null,
    loop: false,
  };
  const context = {
    state: "running",
    currentTime: 0,
    destination: {},
    createGain: () => ({
      gain: {
        value: 0,
        cancelScheduledValues: vi.fn(),
        setTargetAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }),
    createBufferSource: vi.fn(() => source),
    decodeAudioData: vi.fn(async () => ({ duration: 104 })),
    resume: vi.fn(async () => {}),
    suspend: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2])));
  const failure = vi.fn();
  const audio = new MusicAudio(failure, vi.fn(), factory, fetcher);
  return { audio, source, context, factory, fetcher, failure };
}
it("기본 무음·음량만 변경 시 요청 없음, 반복 켜기·음소거·정지는 소스 하나", async () => {
  const s = setup();
  s.audio.sync({ ...on, enabled: false, volume: 0.7 });
  expect(s.factory).not.toHaveBeenCalled();
  expect(s.fetcher).not.toHaveBeenCalled();
  s.audio.sync(on);
  await vi.waitFor(() => expect(s.source.start).toHaveBeenCalledTimes(1));
  for (let i = 0; i < 10; i++) {
    s.audio.sync({ ...on, active: false });
    s.audio.sync({ ...on, volume: 0 });
    s.audio.sync(on);
  }
  await Promise.resolve();
  expect(s.fetcher).toHaveBeenCalledTimes(1);
  expect(s.context.createBufferSource).toHaveBeenCalledTimes(1);
  expect(s.source.loop).toBe(true);
});
it("로딩 도중 끄면 늦은 완료가 재생하지 않고 다음 클릭에서 재사용", async () => {
  const s = setup();
  let resolve!: (response: Response) => void;
  s.fetcher.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  s.audio.sync(on);
  s.audio.sync({ ...on, enabled: false });
  resolve(new Response(new Uint8Array([1])));
  await vi.waitFor(() =>
    expect(s.context.decodeAudioData).toHaveBeenCalledTimes(1),
  );
  expect(s.source.start).not.toHaveBeenCalled();
  s.audio.sync(on);
  await vi.waitFor(() => expect(s.source.start).toHaveBeenCalledTimes(1));
  expect(s.fetcher).toHaveBeenCalledTimes(1);
});
it("음악 요청 실패 후 재시도, destroy 후 다시 재생하지 않음", async () => {
  const s = setup();
  s.fetcher.mockRejectedValueOnce(new Error("offline"));
  s.audio.sync(on);
  await vi.waitFor(() => expect(s.failure).toHaveBeenCalledTimes(1));
  s.audio.sync(on);
  await vi.waitFor(() => expect(s.source.start).toHaveBeenCalledTimes(1));
  s.audio.destroy();
  s.audio.sync(on);
  expect(s.context.close).toHaveBeenCalledTimes(1);
  expect(s.source.start).toHaveBeenCalledTimes(1);
});
