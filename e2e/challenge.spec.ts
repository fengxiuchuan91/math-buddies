import { expect, test } from './fixtures'
import { dismissTips, knownWorld, seed, solve, watchErrors } from './helpers'

test('口算挑战：熟题够 20 道时出现，答一页、批改、加 5 颗星，本周不再出现', async ({ page }) => {
  const errors = watchErrors(page)
  await seed(page, knownWorld())
  await dismissTips(page)
  await page.reload()
  await expect(page.locator('.stars')).toHaveText('⭐ 0')
  await page.getByRole('button', { name: '⚡ 本周口算挑战' }).click()

  const cells = page.locator('.sheet .cell')
  await expect(cells).toHaveCount(20)
  await page.screenshot({ path: 'tmp-screenshots/e2e-challenge-sheet.png' })
  for (let i = 0; i < 20; i++) {
    const q = (await cells.nth(i).getAttribute('data-q'))!
    const ans = solve(q)
    expect(ans, q).not.toBeNull()
    // 第 1 道故意答错
    const given = i === 0 ? Number(ans) + 1 : ans
    await cells.nth(i).click()
    for (const d of String(given)) await page.locator('.keypad .key').filter({ hasText: new RegExp(`^${d}$`) }).click()
    // 做题时屏幕上不显示计时
    if (i === 10) await expect(page.locator('.challenge')).not.toContainText('秒')
    await page.locator('.key-ok').click()
  }
  // 最后一格按确定就直接交卷

  await expect(page.locator('.result .score')).toHaveText('对了 19 道，共 20 道')
  await expect(page.locator('.result .time')).toContainText('用了')
  await expect(page.locator('.sheet .cell.wrong')).toHaveCount(1)
  await page.screenshot({ path: 'tmp-screenshots/e2e-challenge-result.png' })

  await page.getByRole('button', { name: '回到岛上' }).click()
  await expect(page.locator('.stars')).toHaveText('⭐ 5')
  await expect(page.getByRole('button', { name: '⚡ 本周口算挑战' })).toHaveCount(0)
  expect(errors).toEqual([])
})
