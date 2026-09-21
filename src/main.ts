import "./style.css";
import { CityLife } from "./city-life";
import { Rain } from "./rain";
import { RainAudio } from "./audio";
import { MusicAudio } from "./music";
import { active, type ExperienceState } from "./state";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="window" aria-label="비 오는 밤의 도시를 바라보는 창가">
    <div class="fallback" aria-hidden="true"><i></i><i></i><i></i></div>
    <canvas id="city" aria-hidden="true"></canvas><canvas id="rain" aria-hidden="true"></canvas>
    <div class="glass" aria-hidden="true"></div><div class="frame" aria-hidden="true"></div>
    <header><span class="brand-mark" aria-hidden="true">◒</span><h1>Rain Window</h1><span class="edition">A MOMENT OF STILLNESS</span></header>
    <div class="scene-label" title="기기 현지 시간 기준 · 22시부터 소등, 01–05시 사무실 소등, 05–08시 점등"><span class="live-dot" aria-hidden="true"></span><span class="scene-caption">현지 시간과 함께 흐르는 밤</span><time id="clock" aria-label="기기 현지 시각"></time></div>
    <section class="controls" aria-label="감상 설정">
      <div class="weather-controls"><div class="rain-control"><label for="intensity">비의 세기 <output id="intensity-value">50%</output></label><div class="slider-row"><span aria-hidden="true">☂</span><input id="intensity" type="range" min="0" max="100" value="50" aria-label="비의 세기"></div></div>
      <div class="wind-control"><label for="wind">바람 <output id="wind-value">오른쪽 20%</output></label><div class="slider-row"><span aria-hidden="true">↔</span><input id="wind" type="range" min="-100" max="100" value="20" aria-label="바람 방향과 세기" aria-valuetext="오른쪽 20%"></div></div></div>
      <span class="divider" aria-hidden="true"></span>
      <button id="pause" class="icon-button" aria-label="일시정지" title="일시정지"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg></button>
      <div class="audio-controls"><button id="sound" class="icon-button" aria-label="빗소리 켜기" aria-pressed="false" title="빗소리 켜기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6M21 9l-5 6"/></svg></button><input id="volume" type="range" min="0" max="100" value="35" aria-label="빗소리 음량"></div>
      <span class="divider fullscreen-divider" aria-hidden="true"></span>
      <button id="fullscreen" class="icon-button" aria-label="전체 화면" title="전체 화면"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg></button>
    </section>
    <p class="status" role="status" aria-live="polite"></p>
    <section class="music-controls" aria-label="배경음악">
      <button id="music" class="icon-button" aria-label="배경음악 켜기" aria-pressed="false" title="배경음악 켜기">♫</button>
      <span class="music-title">Rain <span>· oh</span></span>
      <input id="music-volume" type="range" min="0" max="100" value="40" aria-label="배경음악 음량">
    </section>
  </main>`;

const city = document.querySelector<HTMLCanvasElement>("#city")!;
const lensScene = document.createElement("canvas");
const rainCanvas = document.querySelector<HTMLCanvasElement>("#rain")!;
const pause = document.querySelector<HTMLButtonElement>("#pause")!;
const sound = document.querySelector<HTMLButtonElement>("#sound")!;
const fullscreen = document.querySelector<HTMLButtonElement>("#fullscreen")!;
const intensity = document.querySelector<HTMLInputElement>("#intensity")!;
const windControl = document.querySelector<HTMLInputElement>("#wind")!;
const volume = document.querySelector<HTMLInputElement>("#volume")!;
const musicButton = document.querySelector<HTMLButtonElement>("#music")!;
const musicVolume = document.querySelector<HTMLInputElement>("#music-volume")!;
let musicEnabled = false;
const status = document.querySelector<HTMLParagraphElement>(".status")!;
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const clock = document.querySelector<HTMLTimeElement>("#clock")!;
let clockTimer: ReturnType<typeof setInterval> | undefined;
function syncClock() {
  clearInterval(clockTimer);
  const update = () => {
    const now = new Date();
    clock.textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    clock.dateTime = now.toISOString();
    clock.title = `기기 현지 시각 · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  };
  update();
  if (!document.hidden) clockTimer = setInterval(update, 1000);
}
syncClock();
const state: ExperienceState = {
  paused: motion.matches,
  hidden: document.hidden,
  sound: false,
  volume: 0.35,
  intensity: 0.5,
};
let rain: Rain | null = null;
let cityLife: CityLife | null = null;
let wind = 0.2;
let graphicsFailed = false;
let photo: HTMLImageElement | undefined;
let resizeFrame = 0;
const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
function graphicsFailure() {
  graphicsFailed = true;
  rain?.destroy();
  rain = null;
  city.hidden = true;
  rainCanvas.hidden = true;
  intensity.disabled = true;
  windControl.disabled = true;
  cityLife = null;
  status.textContent = "그래픽을 표시할 수 없어 정적인 야경으로 전환했습니다.";
}
const audio = new RainAudio(() => {
  state.sound = false;
  audio.sync(state);
  updateUI();
  status.textContent =
    "빗소리를 재생하지 못했습니다. 소리 버튼을 눌러 다시 시도해 주세요.";
});
const music = new MusicAudio(
  () => {
    musicEnabled = false;
    syncMusic();
    status.textContent =
      "음악을 재생하지 못했습니다. 음악 버튼을 눌러 다시 시도해 주세요.";
  },
  (loading) => {
    musicButton.setAttribute("aria-busy", String(loading));
    if (loading) status.textContent = "Rain · oh를 준비하고 있어요.";
    else if (status.textContent === "Rain · oh를 준비하고 있어요.")
      status.textContent = "";
  },
);
function syncMusic() {
  musicButton.setAttribute("aria-pressed", String(musicEnabled));
  const label = musicEnabled ? "배경음악 끄기" : "배경음악 켜기";
  musicButton.setAttribute("aria-label", label);
  musicButton.title = label;
  music.sync({
    enabled: musicEnabled,
    active: active(state),
    volume: Number(musicVolume.value) / 100,
  });
}
musicButton.addEventListener("click", () => {
  musicEnabled = !musicEnabled;
  status.textContent = "";
  syncMusic();
});
musicVolume.addEventListener("input", syncMusic);
city.addEventListener("contextlost", graphicsFailure);
rainCanvas.addEventListener("contextlost", graphicsFailure);
rainCanvas.addEventListener("webglcontextlost", graphicsFailure);
function updateUI() {
  pause.setAttribute("aria-label", state.paused ? "재생" : "일시정지");
  pause.title = state.paused ? "재생" : "일시정지";
  pause.innerHTML = icon(state.paused ? "M8 5l11 7-11 7z" : "M9 6v12M15 6v12");
  sound.setAttribute("aria-label", state.sound ? "빗소리 끄기" : "빗소리 켜기");
  sound.title = state.sound ? "빗소리 끄기" : "빗소리 켜기";
  sound.setAttribute("aria-pressed", String(state.sound));
  sound.innerHTML = icon(
    state.sound
      ? "M11 5 6 9H3v6h3l5 4zM16 8c3 2 3 6 0 8M19 5c5 4 5 10 0 14"
      : "M11 5 6 9H3v6h3l5 4zM16 9l5 6M21 9l-5 6",
  );
  document.querySelector("#intensity-value")!.textContent =
    `${Math.round(state.intensity * 100)}%`;
  document.documentElement.dataset.playback = active(state)
    ? "playing"
    : "paused";
}
function sync() {
  if (active(state) && cityLife) {
    try {
      cityLife.refreshTime();
      rain?.refreshScene();
    } catch {
      graphicsFailure();
    }
  }
  rain?.setRunning(active(state));
  audio.sync(state);
  syncMusic();
  updateUI();
}
function resize() {
  if (graphicsFailed) return;
  try {
    cityLife ??= new CityLife(city, lensScene);
    cityLife.resize(window.innerWidth, window.innerHeight, photo);
    cityLife.setWind(wind);
    cityLife.setIntensity(state.intensity);
    rain ??= new Rain(
      rainCanvas,
      lensScene,
      graphicsFailure,
      (dt) => cityLife?.step(dt) ?? false,
    );
    rain.resize(window.innerWidth, window.innerHeight);
    rain.setIntensity(state.intensity);
    rain.setWind(wind);
    rain.setRunning(active(state));
  } catch {
    graphicsFailure();
  }
}
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(resize);
});
pause.addEventListener("click", () => {
  state.paused = !state.paused;
  status.textContent = "";
  sync();
});
sound.addEventListener("click", () => {
  state.sound = !state.sound;
  status.textContent = "";
  sync();
});
intensity.addEventListener("input", () => {
  state.intensity = Number(intensity.value) / 100;
  try {
    cityLife?.setIntensity(state.intensity);
    rain?.refreshScene();
    rain?.setIntensity(state.intensity);
  } catch {
    graphicsFailure();
  }
  audio.sync(state);
  updateUI();
});
volume.addEventListener("input", () => {
  state.volume = Number(volume.value) / 100;
  audio.sync(state);
});
windControl.addEventListener("input", () => {
  wind = Number(windControl.value) / 100;
  cityLife?.setWind(wind);
  rain?.setWind(wind);
  const label =
    wind === 0
      ? "무풍"
      : `${wind < 0 ? "왼쪽" : "오른쪽"} ${Math.round(Math.abs(wind) * 100)}%`;
  document.querySelector("#wind-value")!.textContent = label;
  windControl.setAttribute("aria-valuetext", label);
});
document.addEventListener("visibilitychange", () => {
  syncClock();
  state.hidden = document.hidden;
  sync();
});
motion.addEventListener("change", () => {
  if (motion.matches) {
    state.paused = true;
    sync();
  }
});
fullscreen.hidden = !document.fullscreenEnabled;
document.querySelector<HTMLElement>(".fullscreen-divider")!.hidden =
  !document.fullscreenEnabled;
fullscreen.addEventListener("click", () => {
  const request = document.fullscreenElement
    ? document.exitFullscreen()
    : document.documentElement.requestFullscreen();
  void request.catch(() => {
    status.textContent = "이 브라우저에서는 전체 화면으로 전환할 수 없습니다.";
  });
});
document.addEventListener("fullscreenchange", () => {
  const label = document.fullscreenElement ? "전체 화면 종료" : "전체 화면";
  fullscreen.setAttribute("aria-label", label);
  fullscreen.title = label;
});
window.addEventListener("pagehide", () => {
  clearInterval(clockTimer);
  state.hidden = true;
  sync();
  cancelAnimationFrame(resizeFrame);
});
window.addEventListener("pageshow", () => {
  syncClock();
  state.hidden = document.hidden;
  sync();
});
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    clearInterval(clockTimer);
    rain?.destroy();
    audio.destroy();
    music.destroy();
  });
resize();
sync();
const backgroundPhoto = new Image();
backgroundPhoto.src = "/images/city-highrise.jpg";
void backgroundPhoto
  .decode()
  .then(() => {
    photo = backgroundPhoto;
    document.documentElement.dataset.background = "photo";
    resize();
  })
  .catch(() => {
    document.documentElement.dataset.background = "fallback";
    if (!graphicsFailed)
      status.textContent =
        "도시 사진을 불러오지 못해 기본 야경으로 감상합니다.";
  });
