// Testes de ponta a ponta: o jogo publicado (/play/) e o site institucional, servidos como arquivos estáticos.
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: ".",
  timeout: 180_000,
  fullyParallel: true,
  workers: 3,
  reporter: [["list"]],
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "off",
  },
  webServer: {
    command: `python -m http.server ${PORT} --bind 127.0.0.1`,
    cwd: "../..",
    url: `http://127.0.0.1:${PORT}/play/`,
    reuseExistingServer: true,
    stdout: "ignore",
  },
  projects: [
    { name: "desktop-1366", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    { name: "desktop-1920", use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
    { name: "mobile-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
