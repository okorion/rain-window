# 첫 공개 버전 검증 · 2026-09-21

- `npm run lint`, `npm run typecheck`, `npm test`(12개), `npm run build` 통과.
- 배포용 `dist`를 Vite preview로 서비스하여 Playwright Chromium 검사 9개 통과.
- 비 강도 0/50/100, 음량 0/70, 음소거, 반복 재생, 단일 AudioContext·소스 유지, 일시정지 후 Canvas 불변과 재개, 전체 화면 진입·종료 확인.
- 390×844, 320×568, 844×390 뷰포트와 렌더 픽셀 예산 확인. 실제 휴대전화 검증은 하지 않음.
- reduced-motion, visibilitychange 이벤트 주입, 오디오 재생 거부, Canvas 초기화 실패·context 상실, 전체 화면 미지원·거부 확인. visibilitychange는 자동화로 상태를 주입한 검사이며 실제 OS의 탭 전환과 구분함.
- `agent-browser`로 실제 페이지 로드·컨트롤 접근성 트리·일시정지→재생 전환을 별도 확인.
- 실제 실행 화면: `screenshots/desktop.png`(1440×900), `screenshots/mobile.png`(390×844). 생성 목업이 아님.

초기에는 개별 창문마다 적용한 Canvas blur로 데스크톱 headless 렌더가 30초 제한을 넘었습니다. 완성된 배경에 한 번만 적용하도록 수정한 뒤 전체 브라우저 검사가 약 11초에 통과했습니다. 테스트 선택자의 `status` 중복은 안내 영역으로 명확히 좁혀 해결했습니다.

단위 테스트는 프레임 시간 도약 방지, 방울 수·픽셀 예산 제한, 음향 상태 전환과 비동기 재생 완료 경쟁을 검사합니다. 실제 스피커 청취 품질, Safari·Firefox, 장시간 실기기 성능은 미검증입니다. 물방울은 근사 굴절이며 충돌·합쳐짐은 구현하지 않았습니다.
