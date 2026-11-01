import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'

// 本机已有的 Chromium；没有就用系统装的 Chrome。也可以用 PW_CHROMIUM 指定
const cached = `${homedir()}/Library/Caches/ms-playwright/chromium-1237/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
const executablePath = process.env.PW_CHROMIUM || (existsSync(cached) ? cached : undefined)
const PORT = 4319

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'tmp-screenshots/e2e-results',
  timeout: 120_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    viewport: { width: 375, height: 812 },
    baseURL: `http://localhost:${PORT}`,
    launchOptions: {
      executablePath,
      channel: executablePath ? undefined : 'chrome',
      // 录音用假麦克风，自动允许权限
      args: ['--mute-audio', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    },
    permissions: ['microphone'],
    screenshot: 'only-on-failure',
  },
  // 用和线上 Caddy 一样的响应头（含 CSP）提供构建产物
  webServer: {
    command: `npm run build && node scripts/serve-dist.mjs ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
