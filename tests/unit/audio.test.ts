import { expect, it, vi } from "vitest";
import { RainAudio } from "../../src/audio";
import type { ExperienceState } from "../../src/state";
function mockAudio() {
  const source = {
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    buffer: null,
    loop: false,
  };
  const param = {
    value: 0,
    cancelScheduledValues: vi.fn(),
    setTargetAtTime: vi.fn(),
  };
  const context = {
    sampleRate: 100,
    currentTime: 0,
    state: "running",
    destination: {},
    createBuffer: () => ({ getChannelData: () => new Float32Array(800) }),
    createBufferSource: vi.fn(() => source),
    createBiquadFilter: () => ({
      frequency: param,
      connect: vi.fn(),
      type: "",
    }),
    createGain: () => ({ gain: param, connect: vi.fn() }),
    resume: vi.fn(async () => {}),
    suspend: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  return { context, source, param };
}
const on: ExperienceState = {
  paused: false,
  hidden: false,
  sound: true,
  volume: 0.4,
  intensity: 0.5,
};
it("반복 재생·중단·음량 변경 시 AudioContext와 소스를 재사용", () => {
  const { context, source } = mockAudio(),
    factory = vi.fn(() => context as unknown as AudioContext);
  const audio = new RainAudio(vi.fn(), factory);
  audio.sync({ ...on, sound: false });
  expect(factory).not.toHaveBeenCalled();
  for (let i = 0; i < 20; i++) {
    audio.sync(on);
    audio.sync({ ...on, paused: true });
  }
  audio.sync({ ...on, volume: 0.8 });
  expect(factory).toHaveBeenCalledTimes(1);
  expect(source.start).toHaveBeenCalledTimes(1);
  expect(context.createBufferSource).toHaveBeenCalledTimes(1);
});
it("재생 거부를 보고하고 재시도 시 소스를 추가하지 않음", async () => {
  const { context } = mockAudio();
  context.resume.mockRejectedValueOnce(new Error("blocked"));
  const failure = vi.fn();
  const audio = new RainAudio(
    failure,
    () => context as unknown as AudioContext,
  );
  audio.sync(on);
  await vi.waitFor(() => expect(failure).toHaveBeenCalledTimes(1));
  audio.sync(on);
  expect(context.createBufferSource).toHaveBeenCalledTimes(1);
});
it("늦게 완료된 resume이 음소거를 뒤집지 않음", async () => {
  const { context, param } = mockAudio();
  let resolve!: () => void;
  context.resume.mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  const audio = new RainAudio(
    vi.fn(),
    () => context as unknown as AudioContext,
  );
  audio.sync(on);
  audio.sync({ ...on, sound: false });
  resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(param.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.05);
  expect(context.suspend).toHaveBeenCalledTimes(2);
});
