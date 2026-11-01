import { expect, type Page } from '@playwright/test'

/** 记下页面报错和控制台错误，测试结束时断言为空 */
export function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  return errors
}

/** 从题面算出答案；算不出（一眼看出、看图列式）返回 null */
export function solve(text: string): number | string | null {
  const t = text.replace(/−/g, '-').replace(/\s+/g, ' ').trim()
  const v = (a: string, op: string, b: string) => (op === '+' ? +a + +b : +a - +b)
  const cmp = (x: number, y: number) => (x > y ? '>' : x < y ? '<' : '=')
  let m: RegExpMatchArray | null
  if ((m = t.match(/^(\d+) ([+-]) (\d+) = □$/))) return v(m[1], m[2], m[3])
  if ((m = t.match(/^□ ([+-]) (\d+) = (\d+)$/))) return m[1] === '+' ? +m[3] - +m[2] : +m[3] + +m[2]
  if ((m = t.match(/^(\d+) ([+-]) □ = (\d+)$/))) return m[2] === '+' ? +m[3] - +m[1] : +m[1] - +m[3]
  if ((m = t.match(/^(\d+) ([+-]) (\d+) ○ (\d+)$/))) return cmp(v(m[1], m[2], m[3]), +m[4])
  if ((m = t.match(/^(\d+) ○ (\d+)$/))) return cmp(+m[1], +m[2])
  if ((m = t.match(/^(\d+) 后面是 □$/))) return +m[1] + 1
  if ((m = t.match(/^(\d+) 前面是 □$/))) return +m[1] - 1
  if ((m = t.match(/^(\d+) 个十和 (\d+) 个一是 □$/))) return +m[1] * 10 + +m[2]
  if ((m = t.match(/^(\d+) 个十是 □$/))) return +m[1] * 10
  if ((m = t.match(/^(\d+) 里有 1 个十和 □ 个一$/))) return +m[1] - 10
  if (/^20 里有 □ 个十$/.test(t)) return 2
  if ((m = t.match(/^(\d+) 分成 (\d+) 和 □$/))) return +m[1] - +m[2]
  if ((m = t.match(/^(\d+) 和 (\d+) 合成 □$/))) return +m[1] + +m[2]
  return null
}

/** 在练习页输入答案：比大小点按钮，看图列式先点加减，其余按数字键 */
export async function type(page: Page, ans: number | string) {
  let s = String(ans)
  if (/^[<>=]$/.test(s)) { await page.locator('.ops button', { hasText: s }).click(); return }
  if (/^[+-]\d+$/.test(s)) { await page.locator('.ops button').nth(s[0] === '+' ? 0 : 1).click(); s = s.slice(1) }
  for (const d of s) await page.locator('.keypad .key').filter({ hasText: new RegExp(`^${d}$`) }).click()
  await page.locator('.key-ok').click()
}

/** 直接往 IndexedDB 写事件，然后刷新页面，用来准备“已经练了一阵子”的状态 */
export async function seed(page: Page, events: object[]) {
  await page.goto('/')
  await page.evaluate(async (es) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('math-buddies', 2)
      req.onupgradeneeded = () => {
        for (const s of ['events', 'clips']) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: 'id' })
      }
      req.onsuccess = () => {
        const tx = req.result.transaction('events', 'readwrite')
        for (const e of es) tx.objectStore('events').put(e)
        tx.oncomplete = () => { req.result.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  }, events)
  await page.reload()
  await expect(page.locator('.home')).toBeVisible()
}

/** 30 个 10 以内的加减事实 */
export const KNOWN_FACTS = [
  ...[1, 2, 3, 4, 5].flatMap((a) => [1, 2, 3, 4, 5].map((b) => `${a}+${b}`)),
  '5-1', '6-2', '7-3', '8-4', '9-5',
]

/** 摸底做完、这些事实已在格子 4，热身也做过 */
export function knownWorld(t = Date.now() - 86_400_000) {
  return [
    { kind: 'baseline', id: 'seed-b1', t, digits: 1, ms: 900 },
    { kind: 'baseline', id: 'seed-b2', t, digits: 2, ms: 1500 },
    { kind: 'placement', id: 'seed-p', t: t + 1, boxes: Object.fromEntries(KNOWN_FACTS.map((f) => [f, 4])) },
  ]
}

/** 跳过首页的录音、浏览器提示 */
export async function dismissTips(page: Page) {
  await page.evaluate(() => localStorage.setItem('mb-settings', JSON.stringify({ recordTipDismissed: true, browserTipDismissed: true })))
}
