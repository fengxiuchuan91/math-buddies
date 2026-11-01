import { expect, test } from './fixtures'
import { watchErrors } from './helpers'

test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.50' })

test('微信里打开：提示用自带浏览器，关掉后不再出现；页面在 CSP 下没有报错', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  const tip = page.getByText('建议点右上角「…」选「在浏览器打开」')
  await expect(tip).toBeVisible()
  await page.screenshot({ path: 'tmp-screenshots/e2e-wechat-tip.png' })
  await page.locator('.tip button', { hasText: '知道了' }).click()
  await expect(tip).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.home')).toBeVisible()
  await expect(tip).toHaveCount(0)
  expect(errors).toEqual([])
})
