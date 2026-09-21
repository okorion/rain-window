import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.QA_BASE_URL || "http://127.0.0.1:5174",
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
  },
  reporter: "list",
});
