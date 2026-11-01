import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { dismissTips, knownWorld, seed, watchErrors } from './helpers'

async function passGate(page: Page) {
  await page.locator('.lock').click()
  const q = (await page.locator('.gate .q').textContent())!
  const [a, b] = q.match(/(\d+) × (\d+)/)!.slice(1).map(Number)
  // 先答错一次，确认会换题
  for (const d of String(a * b + 1)) await page.locator('.keypad .key').filter({ hasText: new RegExp(`^${d}$`) }).click()
  await page.locator('.key-ok').click()
  await expect(page.locator('.gate .wrong')).toBeVisible()
  const q2 = (await page.locator('.gate .q').textContent())!
  const [c, e] = q2.match(/(\d+) × (\d+)/)!.slice(1).map(Number)
  for (const d of String(c * e)) await page.locator('.keypad .key').filter({ hasText: new RegExp(`^${d}$`) }).click()
  await page.locator('.key-ok').click()
  await expect(page.locator('.parent')).toBeVisible()
}

test('家长区：乘法门槛、报表、掌握图、设置生效', async ({ page }) => {
  const errors = watchErrors(page)
  await seed(page, knownWorld())
  await dismissTips(page)
  await page.reload()
  await passGate(page)
  await expect(page.getByText('最近 7 天')).toBeVisible()
  await page.screenshot({ path: 'tmp-screenshots/e2e-parent-report.png' })

  await page.locator('.parent .tabs button', { hasText: '掌握图' }).click()
  await expect(page.locator('.grid .cell').first()).toBeVisible()
  await page.screenshot({ path: 'tmp-screenshots/e2e-parent-grid.png' })

  await page.locator('.parent .tabs button', { hasText: '设置' }).click()
  await page.getByPlaceholder('例如：小宝').fill('乐乐')
  await page.getByPlaceholder('例如：小宝').press('Enter')
  await page.getByRole('button', { name: '少 5 题' }).click()
  await page.screenshot({ path: 'tmp-screenshots/e2e-parent-settings.png' })
  await page.getByRole('button', { name: '← 返回' }).click()

  await expect(page.locator('.home h1')).toHaveText('乐乐的数学岛')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mb-settings')!))
  expect(saved).toMatchObject({ childName: '乐乐', dailySize: 15 })
  expect(errors).toEqual([])
})

test('家长区：导出备份，换一个浏览器恢复，星星和进度一样', async ({ page, browser }) => {
  const done = Date.now() - 3_600_000
  await seed(page, [
    ...knownWorld(),
    { kind: 'session_start', id: 'seed-s1', t: done, session: 's1', mode: 'daily' },
    { kind: 'session_end', id: 'seed-s2', t: done + 60_000, session: 's1', mode: 'daily', completed: true },
  ])
  await dismissTips(page)
  await page.reload()
  await expect(page.locator('.stars')).toHaveText('⭐ 10')
  await passGate(page)
  await page.locator('.parent .tabs button', { hasText: '设置' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '导出备份' }).click()])
  const file = await download.path()

  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
  const fresh = await ctx.newPage()
  const errors = watchErrors(fresh)
  await fresh.goto('/')
  await dismissTips(fresh)
  await fresh.reload()
  await expect(fresh.locator('.stars')).toHaveText('⭐ 0')
  await passGate(fresh)
  await fresh.locator('.parent .tabs button', { hasText: '设置' }).click()
  await fresh.locator('input[type=file]').setInputFiles(file!)
  await expect(fresh.locator('.msg')).toContainText('已恢复 5 条记录', { timeout: 10_000 })
  await fresh.screenshot({ path: 'tmp-screenshots/e2e-parent-restored.png' })
  await fresh.getByRole('button', { name: '← 返回' }).click()
  await expect(fresh.locator('.stars')).toHaveText('⭐ 10')
  expect(errors).toEqual([])
  await ctx.close()
})
