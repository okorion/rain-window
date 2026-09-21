# 개발 도구와 라이선스

웹사이트 런타임은 브라우저 기본 API와 프로젝트 코드로 구성됩니다. 현재 도시 배경 사진은 Unsplash License, 이전 비교 캡처 속 거리 사진은 Pexels License를 따르며 [사진 출처와 이용 조건](public/images/ATTRIBUTION.md)에 별도로 기록했습니다. 외부 음원은 사용하지 않습니다. 정확한 설치 버전과 전이 의존성은 `package-lock.json`, 각 라이선스 원문은 설치 패키지의 LICENSE 파일을 기준으로 합니다.

| 직접 개발 의존성   | 라이선스   | 원본                                                   |
| ------------------ | ---------- | ------------------------------------------------------ |
| Vite               | MIT        | https://github.com/vitejs/vite                         |
| TypeScript         | Apache-2.0 | https://github.com/microsoft/TypeScript                |
| ESLint, @eslint/js | MIT        | https://github.com/eslint/eslint                       |
| typescript-eslint  | MIT        | https://github.com/typescript-eslint/typescript-eslint |
| Vitest             | MIT        | https://github.com/vitest-dev/vitest                   |
| @playwright/test   | Apache-2.0 | https://github.com/microsoft/playwright                |
| Prettier           | MIT        | https://github.com/prettier/prettier                   |

Vite 빌드 과정에서 포함되는 modulepreload 헬퍼는 Vite의 MIT 라이선스 적용 대상입니다. 해당 저작권 및 라이선스 전문은 배포 파일 `third-party-licenses.txt`에 함께 보존합니다.

음악 제작 전용 도구(웹 런타임·배포물에는 미포함): NumPy·SciPy(BSD-3-Clause), imageio-ffmpeg(BSD-2-Clause), FFmpeg/libmp3lame. 도구 실행 파일은 배포하지 않으며 배포 음원에는 외부 샘플을 사용하지 않습니다. 재생성 환경은 생성 스크립트 설명을 참고하세요.
