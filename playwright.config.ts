import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = Number(process.env.TF_E2E_PORT || 3187);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "e2e",
  timeout: 90000,
  ...(process.env.TF_E2E_RESULTS ? { outputDir: process.env.TF_E2E_RESULTS } : {}),
  workers: 1,
  use: { actionTimeout: 12000, ...devices["Pixel 7"], baseURL, trace: "retain-on-failure" },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    env: { TF_TEST_MODEL: "1", TF_DATABASE_PATH: join(mkdtempSync(join(tmpdir(), "tf-e2e-")), "app.sqlite") },
  },
});
