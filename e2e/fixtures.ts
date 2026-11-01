import { test as base, expect } from '@playwright/test'

// 测试时不出声：浏览器朗读在 Mac 上走系统声音，--mute-audio 管不到，
// 这里把音量设成 0，朗读照常开始和结束，只是听不见
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const s = window.speechSynthesis
      if (!s) return
      const speak = s.speak.bind(s)
      s.speak = (u: SpeechSynthesisUtterance) => { u.volume = 0; speak(u) }
    })
    await use(page)
  },
})

export { expect }
