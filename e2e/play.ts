import { expect, type Page } from '@playwright/test'
import { solve, type } from './helpers'

export interface PlayLog {
  teach: number
  explain: number
  asked: number
  shots: string[]
}

/**
 * 一直答题直到出现完成页或回到首页。
 * 能从题面算出的答对；算不出的故意答错，讲解后按讲解里的算式改对。
 * wrongOnce：第一道能算出的题故意答错一次，用来走一遍讲解。
 */
export async function play(page: Page, tag: string, opts: { wrongOnce?: boolean } = {}): Promise<PlayLog> {
  const log: PlayLog = { teach: 0, explain: 0, asked: 0, shots: [] }
  const shot = async (name: string) => {
    if (log.shots.includes(name)) return
    log.shots.push(name)
    await page.screenshot({ path: `tmp-screenshots/e2e-${tag}-${name}.png` })
  }
  let factLine = ''
  let wronged = false
  for (let i = 0; i < 200; i++) {
    await page.waitForFunction(() =>
      document.querySelector('.done') || document.querySelector('.home') || document.querySelector('.lesson') ||
      document.querySelector('.target') || document.querySelector('.keypad') ||
      (document.querySelector('.ops button') && !document.querySelector('.praise')), null, { timeout: 20_000 })
    if (await page.locator('.done').count()) { await shot('done'); return log }
    if (await page.locator('.home').count()) return log
    if (await page.locator('.target').count()) {
      await shot('warmup')
      // 热身要等提示语读完才开始计时
      await page.waitForTimeout(i === 0 ? 5200 : 150)
      await type(page, (await page.locator('.target').textContent())!.trim())
      continue
    }
    if (await page.locator('.lesson').count()) {
      const tip = (await page.locator('.lesson .tip').textContent()) ?? ''
      factLine = (await page.locator('.lesson .eq').textContent())!.trim()
      if (tip.includes('新')) { log.teach++; await shot('teach') } else { log.explain++; await shot('explain') }
      await page.locator('.next').click()
      await page.waitForTimeout(120)
      continue
    }
    const fix = (await page.locator('.stage .tip', { hasText: '你来写出答案' }).count()) > 0
    const text = (await page.locator('.stage .eq').textContent())!.trim()
    let ans = solve(text)
    if (ans === null && /^\d+ ○ \d+ = □$/.test(text)) ans = fix ? null : '+0'
    if (fix && ans === null) {
      const m = factLine.replace(/−/g, '-').match(/^(\d+) ([+-]) (\d+) = (\d+)$/)
      ans = m ? `${m[2]}${m[4]}` : factLine
    }
    if (!fix) {
      log.asked++
      await shot('ask')
      if (ans === null || (opts.wrongOnce && !wronged && typeof ans === 'number')) { wronged = true; ans = ans === null ? 0 : ans + 1 }
    }
    await type(page, ans)
    await page.waitForTimeout(200)
  }
  throw new Error(`${tag}：200 步还没做完`)
}

export async function backHome(page: Page) {
  await page.getByRole('button', { name: '回到岛上' }).click()
  await expect(page.locator('.home')).toBeVisible()
}
