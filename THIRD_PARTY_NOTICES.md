# 개발 도구와 라이선스

웹사이트 런타임은 브라우저 기본 API와 프로젝트 코드로 구성됩니다. 외부 이미지·음원은 사용하지 않습니다. 정확한 설치 버전과 전이 의존성은 `package-lock.json`, 각 라이선스 원문은 설치 패키지의 LICENSE 파일을 기준으로 합니다.

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
