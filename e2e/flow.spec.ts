import { expect, test } from './fixtures'
import { dismissTips, watchErrors } from './helpers'
import { backHome, play } from './play'

test('第一次用：热身、摸底、今日练习（含答错讲解）、完成页，刷新后进度还在', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await dismissTips(page)
  await page.reload()

  await expect(page.locator('.stars')).toHaveText('⭐ 0')
  await page.getByRole('button', { name: '先玩一玩，看看你会哪些' }).click()
  const placement = await play(page, 'placement')
  expect(placement.asked).toBeGreaterThanOrEqual(10)
  await expect(page.locator('.done h1')).toHaveText('看完啦，小伙伴们出来了！')
  await backHome(page)

  // 摸底答对的小伙伴已经孵出来
  await expect(page.locator('.card .badge', { hasText: '长大' }).first()).toBeVisible()
  await page.screenshot({ path: 'tmp-screenshots/e2e-flow-home-after-placement.png' })

  await page.getByRole('button', { name: '开始今天的练习' }).click()
  const daily = await play(page, 'daily', { wrongOnce: true })
  expect(daily.teach).toBeGreaterThan(0)
  expect(daily.explain).toBeGreaterThan(0)
  await expect(page.locator('.done h1')).toHaveText('今天的练习做完了！')
  await expect(page.locator('.done .stars')).toHaveText('⭐ +10')
  await expect(page.locator('.done .parent')).toContainText('做了')
  await backHome(page)

  await expect(page.locator('.stars')).toHaveText('⭐ 10')
  await expect(page.getByText('今天的练习做完了，小伙伴们去睡觉啦')).toBeVisible()

  // 数据存在 IndexedDB，刷新后还在
  await page.reload()
  await expect(page.locator('.stars')).toHaveText('⭐ 10')
  await expect(page.getByRole('button', { name: '开始今天的练习' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('点小伙伴读名字；三个世界都能切换，生成的画已用上', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await dismissTips(page)
  await page.reload()
  await expect(page.locator('.card img').first()).toBeVisible()
  for (const tab of ['动物乐园', '工地', '恐龙岛']) {
    await page.locator('.tabs button', { hasText: tab }).click()
    await expect(page.locator('.card')).not.toHaveCount(0)
  }
  await page.locator('.tabs button', { hasText: '工地' }).click()
  await expect(page.getByText('「凑十龙」和「小松鼠」长大后开放')).toBeVisible()
  await page.locator('.card').first().click()
  expect(errors).toEqual([])
})
