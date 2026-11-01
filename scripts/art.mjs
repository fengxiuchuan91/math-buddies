// 生图脚本。接口是 OpenAI 兼容的 /images/generations 和 /images/edits。
// 配置在 .env.local：IMAGE_API_BASE、IMAGE_API_KEY、IMAGE_MODEL（留空用 gpt-image-2）。换模型只改 IMAGE_MODEL。
//
//   node scripts/art.mjs models          列出可用模型
//   node scripts/art.mjs styles          用「8 号霸王龙」出几种画风 × 三个阶段，拼成一张对比图
//   node scripts/art.mjs use <画风>      把选中画风的三张图放进游戏（src/assets/buddies/dino-8-*.webp）

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const root = new URL('..', import.meta.url)
const fileEnv = {}
if (existsSync(new URL('.env.local', root))) {
  for (const line of readFileSync(new URL('.env.local', root), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m) fileEnv[m[1]] = m[2]
  }
}
const cfg = (k) => process.env[k] || fileEnv[k] || ''
const BASE = cfg('IMAGE_API_BASE').replace(/\/$/, '')
const KEY = cfg('IMAGE_API_KEY')
const MODEL = cfg('IMAGE_MODEL') || 'gpt-image-2'
if (!BASE || !KEY) { console.error('请在 .env.local 里填 IMAGE_API_BASE 和 IMAGE_API_KEY'); process.exit(1) }

const RAW = new URL('art-raw/styles/', root)
const ASSETS = new URL('src/assets/buddies/', root)

// key 只放在请求头里，报错只带接口返回的内容
async function call(path, init) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${KEY}`, ...(init.headers ?? {}) } })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

// 有的中转返回 b64，有的返回临时 URL，要马上下载
async function image(d) {
  const it = d.data?.[0] ?? {}
  if (it.b64_json) return Buffer.from(it.b64_json, 'base64')
  if (it.url) {
    const r = await fetch(it.url)
    if (!r.ok) throw new Error(`下载图片失败 ${r.status}`)
    return Buffer.from(await r.arrayBuffer())
  }
  throw new Error('返回里没有图片')
}

const opts = { size: '1024x1024', quality: 'medium', background: 'transparent' }

const generate = async (prompt) =>
  image(await call('/images/generations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, n: 1, ...opts }),
  }))

async function edit(prompt, ref) {
  const form = new FormData()
  form.append('model', MODEL)
  form.append('prompt', prompt)
  for (const [k, v] of Object.entries(opts)) form.append(k, v)
  form.append('image', new Blob([ref], { type: 'image/png' }), 'ref.png')
  return image(await call('/images/edits', { method: 'POST', body: form }))
}

const COMMON = "Original character for a children's math game for 6-year-olds. One character, full body, centered, facing the viewer, cute and friendly. No text except the number on its belly. Transparent background, no scenery."
const STYLES = {
  sticker: 'Flat vector sticker style, thick clean dark outline, bright soft colors, simple shapes.',
  book: "Soft children's picture-book illustration, colored pencil and watercolor texture, warm pastel colors.",
  clay: 'Cute 3D clay toy style, rounded forms, matte plasticine texture, soft studio light.',
}
const STAGES = {
  1: 'A baby tyrannosaurus dinosaur, small and chubby, big round eyes, a large number 8 on its cream belly.',
  2: 'The same tyrannosaurus as in the reference image, now grown up: taller and stronger, confident smile. Keep exactly the same colors, markings, face, art style and the number 8 on its belly.',
  3: 'The same tyrannosaurus as in the reference image, in its evolved hero form: a small golden star crown, a short red cape, a few sparkles around it. Keep the same colors, face, art style and the number 8 on its belly.',
}

async function styles() {
  mkdirSync(RAW, { recursive: true })
  console.log(`模型 ${MODEL}，画风 ${Object.keys(STYLES).join('、')}`)
  const notes = []
  await Promise.all(Object.entries(STYLES).map(async ([name, style]) => {
    const baby = await generate(`${style} ${COMMON} ${STAGES[1]}`)
    writeFileSync(new URL(`${name}-1.png`, RAW), baby)
    console.log(`  ${name} 小时候 ✓`)
    await Promise.all([2, 3].map(async (n) => {
      let buf
      try {
        buf = await edit(`${style} ${COMMON} ${STAGES[n]}`, baby)
      } catch (e) {
        // 接口不支持参考图时退回纯文字生成，前后阶段可能不像同一只
        notes.push(`${name}-${n}: 参考图失败，改用纯文字生成（${e.message.slice(0, 80)}）`)
        buf = await generate(`${style} ${COMMON} ${STAGES[1].replace('A baby', 'A')} ${STAGES[n].split(':')[1]}`)
      }
      writeFileSync(new URL(`${name}-${n}.png`, RAW), buf)
      console.log(`  ${name} 阶段 ${n} ✓`)
    }))
  }))
  await sheet()
  for (const n of notes) console.log(n)
}

/** 每行一种画风，每列一个阶段 */
async function sheet() {
  const names = Object.keys(STYLES)
  const S = 360, PAD = 40
  const tiles = []
  for (const [r, name] of names.entries()) {
    for (const n of [1, 2, 3]) {
      const f = new URL(`${name}-${n}.png`, RAW)
      if (!existsSync(f)) continue
      tiles.push({ input: await sharp(readFileSync(f)).resize(S, S, { fit: 'contain', background: '#0000' }).toBuffer(), left: PAD + (n - 1) * S, top: PAD + r * (S + PAD) })
    }
    const label = `<svg width="${PAD + 3 * S}" height="${PAD}"><text x="${PAD}" y="28" font-size="26" font-family="Helvetica" fill="#333">${name}: baby / grown / evolved</text></svg>`
    tiles.push({ input: Buffer.from(label), left: 0, top: r * (S + PAD) })
  }
  await sharp({ create: { width: PAD * 2 + 3 * S, height: names.length * (S + PAD) + PAD, channels: 4, background: '#f4f8fb' } })
    .composite(tiles).png().toFile(new URL('sheet.png', RAW).pathname)
  console.log(`对比图：art-raw/styles/sheet.png`)
}

async function use(name) {
  if (!STYLES[name]) { console.error(`没有这种画风：${name}`); process.exit(1) }
  mkdirSync(ASSETS, { recursive: true })
  for (const n of [1, 2, 3]) {
    await sharp(readFileSync(new URL(`${name}-${n}.png`, RAW)))
      .trim().resize(512, 512, { fit: 'contain', background: '#0000' }).webp({ quality: 85 })
      .toFile(new URL(`dino-8-${n}.webp`, ASSETS).pathname)
  }
  console.log(`已放入 src/assets/buddies/dino-8-1~3.webp`)
}

async function models() {
  const d = await call('/models', { method: 'GET' })
  for (const m of d.data ?? []) console.log(m.id)
}

const [cmd, arg] = process.argv.slice(2)
const run = { models, styles, use: () => use(arg), sheet }[cmd]
if (!run) { console.log('用法：node scripts/art.mjs models | styles | use <画风>'); process.exit(1) }
run().catch((e) => { console.error(e.message); process.exit(1) })
