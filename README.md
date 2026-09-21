# Rain Window

**늦은 밤, 비 오는 도시를 바라보는 작은 창가.**

고층 창가에서 내려다보는 실제 도쿄 야경과 따뜻한 불빛, 유리에 부딪혀 맺히고 흘러내리는 빗물을 감상하는 웹 프로젝트입니다. 접속하면 비가 움직이고, 원할 때 빗소리를 켤 수 있습니다. 기본은 무음입니다.

**[Rain Window 감상하기 →](https://rain-window.okorion.chatgpt.site)**

[![Rain Window 데스크톱 실제 화면 — 흐릿한 도시 야경과 유리 위 물방울](docs/screenshots/desktop.png)](https://rain-window.okorion.chatgpt.site)

## 감상과 조작

- **비의 세기** — 방울 수와 흐르는 속도, 빗소리의 질감·크기를 조절합니다. 0에서는 흐름이 멈추고 유리에 남은 방울은 유지됩니다.
- **일시정지·재생** — 움직임과 소리를 함께 멈추고, 이전 음향 설정으로 재개합니다.
- **빗소리·음량** — 소리는 직접 켜야 재생됩니다. 음량 조절만으로 소리가 켜지지 않습니다.
- **전체 화면** — 지원되는 브라우저에서 화면을 가득 채워 감상할 수 있습니다.

모바일에서도 같은 컨트롤을 사용할 수 있습니다.

<p align="center">
  <img src="docs/screenshots/mobile.png" width="280" alt="Rain Window 모바일 실제 화면 — 세로로 보이는 도시 야경과 하단 감상 컨트롤" />
</p>

위 이미지는 실제 실행 화면입니다. 데스크톱은 1440×900, 모바일은 390×844 브라우저 뷰포트에서 캡처했으며, 모바일 캡처는 실기기 촬영이 아닙니다.

## 로컬 실행

Node.js 22.12 이상과 npm이 필요합니다. 검증에 사용한 환경은 Node.js 25.9.0입니다.

```sh
git clone https://github.com/okorion/rain-window.git
cd rain-window
npm ci
npm run dev
```

터미널에 표시된 로컬 주소로 접속하세요.

```sh
# 정적 배포 파일 생성
npm run build

# 빌드 결과 미리보기
npm run preview
```

## 구현 방식

**Vite · TypeScript · WebGL · Canvas 2D · Web Audio API**

배경은 흐린 도시 사진으로, 물방울 안의 반사는 선명한 사진으로 각각 캐시합니다. WebGL 셰이더가 방울의 곡면을 계산해 주변 도시를 뒤집고 휘어 비추며, 빛과 색은 같은 도시 사진에서 가져옵니다. 방울마다 일정한 흰 테두리를 그리지 않습니다.

빗물은 불규칙한 간격으로 유리에 닿아 약 45ms 동안 퍼진 뒤, 약 0.48초 이내에 수축해 방울로 남습니다. 주변에는 작은 물방울 2~4개가 짧게 튀며, 수면처럼 큰 동심원은 만들지 않습니다. 충격 횟수는 비 강도와 화면 면적에 비례하며 비 0·일시정지·비활성 탭에서는 멈춥니다.

큰 방울은 유리에 잠시 붙어 있다가 가속하고, 속도에 따라 길어집니다. 지나간 자리는 짧게 남는 얇은 물막과 작은 방울로 표현하며, 경로의 작은 방울을 흡수하는 제한적인 근사 동작을 적용합니다. 새 충격은 기존 정지 방울 공간을 재사용해 전체 개수를 제한합니다. 모든 방울과 잔여 물막·충격은 한 번의 WebGL 배치로 그립니다.

[실제 실행 영상 — 기본 강도, 비 멈춤, 강한 비와 일시정지](docs/screenshots/rain-motion.webm)

빗소리는 스테레오 노이즈와 저역 필터로 합성합니다. AudioContext와 반복 소스를 재사용해 소리 켜기·끄기를 반복해도 중첩되지 않도록 관리합니다.

| 구성                       | 구현                         |
| -------------------------- | ---------------------------- |
| 도시 야경·반사·불빛        | [src/scene.ts](src/scene.ts) |
| 방울 움직임·잔여 물막 | [src/rain.ts](src/rain.ts) |
| 곡면 굴절·환경 반사 | [src/water-renderer.ts](src/water-renderer.ts) |
| 유리 충격·퍼짐·미세 튀김 | [src/impacts.ts](src/impacts.ts) |
| 합성 빗소리·재생 관리      | [src/audio.ts](src/audio.ts) |
| 감상 상태·프레임 시간      | [src/state.ts](src/state.ts) |
| 컨트롤·브라우저 이벤트     | [src/main.ts](src/main.ts)   |

### 성능과 접근성

- 비활성 탭에서는 렌더와 소리를 중단하고, 복귀할 때 지난 시간을 건너뛰어 계산합니다.
- `prefers-reduced-motion` 설정에서는 정지 화면으로 시작하며, 직접 재생할 수 있습니다.
- Canvas·WebGL 초기화 실패 또는 context 상실 시 정적인 CSS 야경으로 전환합니다. 소리 재생 실패는 시각 감상에 영향을 주지 않습니다.
- 컨트롤에 접근성 이름과 키보드 포커스 표시를 제공하며, 모바일 터치 영역을 확보합니다.

| 렌더 예산          | 가로 640px 이하 | 그 외 |
| ------------------ | --------------- | ----- |
| 최대 DPR           | 1.5             | 2     |
| Canvas당 최대 픽셀 | 100만           | 210만 |
| 최대 주 물방울     | 240개           | 560개 |
| 최대 잔여 물막 조각 | 2,200개         | 5,000개 |
| 프레임 상한        | 30fps           | 60fps |

모든 기기에서 상한 fps를 보장하지는 않습니다.

동시 충격은 최대 32개, 충격당 미세 튀김은 최대 4개입니다. 전체 GPU 배치는 최대 5,800개로 제한합니다.

## 검증

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

브라우저 테스트는 Playwright Chromium을 사용합니다. 아래 서버를 켜 둔 상태에서 별도 터미널로 테스트를 실행하세요.

```sh
# 최초 1회 브라우저 설치
npx playwright install chromium

# 터미널 1: 테스트 기본 주소에서 실행
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

```sh
# 터미널 2
npm run test:e2e
```

다른 서버를 검사하려면 `QA_BASE_URL` 환경 변수를 지정합니다. 현재 단위 테스트 17개와 브라우저 테스트 14개를 통과했습니다. 검사 범위와 실행 환경은 [검증 기록](docs/verification.md)에 정리했습니다.

## 자산과 알려진 한계

배경은 mos design이 촬영한 실제 도쿄 에비스의 고층 야경 사진이며 Unsplash License로 사용합니다. 사진은 프로젝트에 포함해 같은 출처에서 제공하며, 방문 시 외부 사진 서버에 요청하지 않습니다. [사진 원문](https://unsplash.com/photos/a-view-of-a-city-at-night-from-the-top-of-a-building-7d7FpQJEgIA) · [라이선스](https://unsplash.com/license) · [자산 상세와 이전 사진 출처](public/images/ATTRIBUTION.md). 물방울·대체 화면·SVG 아이콘은 코드로 생성하고 빗소리는 브라우저에서 합성합니다. 외부 음원·웹 폰트는 사용하지 않습니다. 글꼴은 기기에 설치된 Arial, Malgun Gothic, Georgia와 시스템 대체 글꼴을 사용합니다. 개발 도구와 배포 헬퍼의 라이선스는 [서드파티 고지](THIRD_PARTY_NOTICES.md)에 기록했습니다.

- 실제 빗물을 촬영한 영상이 아니라, 실제 도시 사진 위에 실시간으로 생성하는 효과입니다. 곡면 굴절·표면 부착·경로상의 작은 방울 흡수는 근사 표현이며 정확한 광학·충돌·유체 시뮬레이션은 아닙니다. 배경 사진 속 사람과 도시는 움직이지 않습니다.
- 배경은 약 20층 높이의 창가 분위기를 목표로 선택했으나 실제 촬영 층수는 출처에 없으며, 시각상 더 높게 보일 수 있습니다.
- 빗소리는 현장 녹음이 아닌 8초 합성 노이즈 루프입니다.
- 모바일은 뷰포트 에뮬레이션으로 검사했습니다. 실제 휴대전화·Safari·Firefox와 장시간 실기기 성능은 미검증입니다.
- 전체 화면과 소리 재생은 브라우저·운영체제 정책에 영향을 받습니다.
- 설정은 저장하지 않으며, 새로 접속하면 기본값으로 돌아옵니다.

## 배포와 저장소

현재 공개 사이트는 [Sites](https://rain-window.okorion.chatgpt.site)에 배포되어 있습니다. `npm run build`가 생성하는 `dist/`를 루트 경로로 서비스하는 정적 호스팅에도 배포할 수 있습니다. 별도 서버·로그인·DB·AI API·날씨 API·위치 권한은 사용하지 않습니다.

이 GitHub 저장소는 공개 소스 저장소입니다. Sites 배포용 저장소와는 **수동으로 동기화**하며, GitHub push가 자동 동기화나 사이트 재배포를 실행하지 않습니다. `.openai/hosting.json`은 현재 Sites 프로젝트에 연결된 설정이므로, 포크를 별도 Sites 프로젝트로 배포할 때는 자신의 프로젝트 설정을 사용하세요.

참고: [MDN WebGL 권장 사항](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) · [MDN Canvas 최적화](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) · [Web Audio 권장 사항](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
