import { expect, test } from './fixtures'
import { watchErrors } from './helpers'

test('录音页：从首页提示进入，用假麦克风录一条，进度加一，刷新后还在', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await page.getByRole('button', { name: '去录音' }).click()
  await expect(page.locator('.recorder')).toBeVisible()
  await expect(page.locator('.count')).toHaveText(/^0 \/ \d+$/)
  const total = Number((await page.locator('.count').textContent())!.split('/')[1])
  expect(total).toBeGreaterThan(60)
  expect(total).toBeLessThan(140)

  const first = (await page.locator('.now .text').textContent())!.trim()
  await page.locator('.rec').click()
  await expect(page.locator('.rec')).toHaveText('■ 停止')
  await page.waitForTimeout(1500)
  await page.locator('.rec').click()
  await expect(page.locator('.now .ok')).toHaveText(`已存好：${first}`, { timeout: 15_000 })
  await expect(page.locator('.count')).toHaveText(`1 / ${total}`)
  await page.screenshot({ path: 'tmp-screenshots/e2e-recorder.png' })

  // 存好后自动跳到下一条
  await expect(page.locator('.now .text')).not.toHaveText(first, { timeout: 10_000 })

  await page.getByRole('button', { name: '← 返回' }).click()
  await expect(page.locator('.home')).toBeVisible()
  await expect(page.getByRole('button', { name: '去录音' })).toHaveCount(0)

  await page.reload()
  await page.locator('.lock').click()
  await expect(page.locator('.gate')).toBeVisible()
  expect(errors).toEqual([])
})
