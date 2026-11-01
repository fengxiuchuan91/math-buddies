// 生图脚本。接口是 OpenAI 兼容的 /images/generations 和 /images/edits。
// 配置在 .env.local：IMAGE_API_BASE、IMAGE_API_KEY、IMAGE_MODEL（留空用 gpt-image-2）。换模型只改 IMAGE_MODEL。
//
//   node scripts/art.mjs models          列出可用模型
//   node scripts/art.mjs styles          用「8 号霸王龙」出几种画风 × 三个阶段，拼成一张对比图
//   node scripts/art.mjs batch           用贴纸画风画全部小伙伴、蛋、装饰、背景（可中断，再跑补齐）
//   node scripts/art.mjs finalize        把原图压成 WebP 放进 src/assets/art/

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

// —— 批量：全部小伙伴、蛋、装饰、背景 ——

const BATCH = new URL('art-raw/batch/', root)
const OUT = new URL('src/assets/art/', root)

const BABY = 'baby version: small and chubby, big round eyes, very cute'
const SUBJECTS = {
  'park-see': `an owl with huge round eyes holding a small card with five dots, ${BABY}`,
  'park-ord': `a rabbit hopping along a short number line, ${BABY}`,
  'park-teen': `a squirrel hugging a bundle of ten wooden sticks tied with a red string, ${BABY}`,
  'dino-2': `a blue ankylosaurus dinosaur with a number 2 on its cream belly, ${BABY}`,
  'dino-3': `an orange triceratops dinosaur with a number 3 on its cream belly, ${BABY}`,
  'dino-4': `a purple stegosaurus dinosaur with a number 4 on its cream belly, ${BABY}`,
  'dino-5': `a light green brachiosaurus dinosaur with a long neck and a number 5 on its cream belly, ${BABY}`,
  'dino-6': `a teal pterosaur with small wings and a number 6 on its cream belly, ${BABY}`,
  'dino-7': `a red velociraptor dinosaur with a number 7 on its cream belly, ${BABY}`,
  'dino-9': `a pink parasaurolophus dinosaur with a head crest and a number 9 on its cream belly, ${BABY}`,
  'dino-10': `a rainbow-colored dinosaur covered with exactly ten round colorful spots, a number 10 on its cream belly, ${BABY}`,
  'site-flat': 'a road roller vehicle with a cute face on the cab, big friendly eyes, chubby toy-like proportions',
  'site-add9': 'a yellow excavator with a cute face on the cab, big friendly eyes, chubby toy-like proportions, a big "9+" painted on its side',
  'site-add8': 'an orange crane truck with a cute face on the cab, big friendly eyes, chubby toy-like proportions, a big "8+" painted on its side',
  'site-add7': 'a green bulldozer with a cute face on the cab, big friendly eyes, chubby toy-like proportions, a big "7+" painted on its side',
  'site-add6': 'a blue cement mixer truck with a cute face on the cab, big friendly eyes, chubby toy-like proportions, a big "6+" painted on its side',
  'site-add5432': 'a purple dump truck with a cute face on the cab, big friendly eyes, chubby toy-like proportions, "2-5+" painted on its side',
  'site-sub9': 'a red fire truck with a cute face on the cab, big friendly eyes, chubby toy-like proportions, a big "-9" painted on its side',
  'site-sub8': 'a teal forklift with a cute face on the cab, big friendly eyes, chubby toy-like proportions, a big "-8" painted on its side',
  'site-sub76': 'a brown wheel loader with a cute face on the cab, big friendly eyes, chubby toy-like proportions, "-7 -6" painted on its side',
  'site-sub5432': 'a light blue tractor with a cute face on the cab, big friendly eyes, chubby toy-like proportions, "-2~5" painted on its side',
}
const GROW = 'The same character as in the reference image, now grown up: bigger, stronger and more confident. Keep exactly the same colors, markings, face, art style and any number or symbol on it.'
const EVOLVE = 'The same character as in the reference image, in its evolved hero form: a small golden star crown, a short red cape (for a vehicle: shiny gold trim and a star badge instead of a cape), a few sparkles around it. Keep the same colors, face, art style and any number or symbol on it.'
const EXTRAS = {
  'egg-park': 'a large egg with soft orange spots and a little paw print pattern, a tiny crack on top',
  'egg-dino': 'a large dinosaur egg with green spots, a tiny crack on top',
  'egg-site': 'a large egg painted with yellow and black construction stripes, a tiny crack on top',
  'decor-1': 'a small palm tree', 'decor-2': 'a tiny fairy-tale castle', 'decor-3': 'a small water fountain',
  'decor-4': 'a rainbow arch', 'decor-5': 'a bunch of colorful balloons', 'decor-6': 'a sunflower in a pot',
  'decor-7': 'a toy rocket', 'decor-8': 'a small carousel',
}
const BG = {
  'bg-park': 'a sunny meadow park with soft hills and a few trees at the edges',
  'bg-dino': 'a tropical island with ferns and small volcanoes far in the background',
  'bg-site': 'a friendly construction site with sand piles and traffic cones at the edges',
}
const BG_STYLE = "Very light, soft pastel children's book background, simple flat shapes, low contrast, the middle area calm and mostly empty, no characters, no text, no letters."

async function withRetry(label, fn) {
  for (let i = 1; ; i++) {
    try { return await fn() } catch (e) {
      if (i >= 3) throw new Error(`${label}: ${e.message}`)
      console.log(`  ${label} 第 ${i} 次失败，重试`)
    }
  }
}

async function batch() {
  mkdirSync(BATCH, { recursive: true })
  const style = STYLES.sticker
  const has = (k) => existsSync(new URL(`${k}.png`, BATCH))
  const save = (k, buf) => { writeFileSync(new URL(`${k}.png`, BATCH), buf); console.log(`  ✓ ${k}`) }
  // 8 号霸王龙沿用已挑好的样图
  for (const n of [1, 2, 3]) {
    const src = new URL(`sticker-${n}.png`, RAW)
    if (!has(`dino-8-${n}`) && existsSync(src)) writeFileSync(new URL(`dino-8-${n}.png`, BATCH), readFileSync(src))
  }
  const jobs = []
  for (const [id, subject] of Object.entries(SUBJECTS)) {
    if (has(`${id}-1`) && has(`${id}-2`) && has(`${id}-3`)) continue
    jobs.push(async () => {
      let baby
      if (has(`${id}-1`)) baby = readFileSync(new URL(`${id}-1.png`, BATCH))
      else save(`${id}-1`, (baby = await withRetry(`${id}-1`, () => generate(`${style} ${COMMON.replace(' except the number on its belly', ' except what is described')} ${subject}.`))))
      await Promise.all([[2, GROW], [3, EVOLVE]].map(async ([n, p]) => {
        if (has(`${id}-${n}`)) return
        save(`${id}-${n}`, await withRetry(`${id}-${n}`, () => edit(`${style} ${p}`, baby)))
      }))
    })
  }
  for (const [k, subject] of Object.entries(EXTRAS)) {
    if (!has(k)) jobs.push(async () => save(k, await withRetry(k, () => generate(`${style} A single cute ${subject} for a children's game, centered, no text, transparent background.`))))
  }
  for (const [k, subject] of Object.entries(BG)) {
    if (!has(k)) jobs.push(async () => save(k, await withRetry(k, () => call('/images/generations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt: `${BG_STYLE} ${subject}.`, n: 1, size: '1024x1536', quality: 'medium' }),
    }).then(image))))
  }
  console.log(`模型 ${MODEL}，共 ${jobs.length} 组任务，并发 6`)
  const errors = []
  let next = 0
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++]
      try { await job() } catch (e) { errors.push(e.message); console.log(`  ✗ ${e.message.slice(0, 160)}`) }
    }
  }))
  console.log(errors.length ? `完成，${errors.length} 组失败，再跑一次会补齐` : '全部完成')
}

/** art-raw/batch 里的原图 → src/assets/art 里的 WebP */
async function finalize() {
  mkdirSync(OUT, { recursive: true })
  const { readdirSync } = await import('node:fs')
  let n = 0
  for (const f of readdirSync(BATCH).filter((x) => x.endsWith('.png'))) {
    const k = f.replace(/\.png$/, '')
    const img = sharp(readFileSync(new URL(f, BATCH)))
    const out = new URL(`${k}.webp`, OUT).pathname
    if (k.startsWith('bg-')) await img.resize(750).webp({ quality: 72 }).toFile(out)
    else await img.trim().resize(512, 512, { fit: 'contain', background: '#0000' }).webp({ quality: 82 }).toFile(out)
    n++
  }
  console.log(`已写入 ${n} 张到 src/assets/art/`)
}

async function models() {
  const d = await call('/models', { method: 'GET' })
  for (const m of d.data ?? []) console.log(m.id)
}

const [cmd, arg] = process.argv.slice(2)
const run = { models, styles, sheet, batch, finalize }[cmd]
if (!run) { console.log('用法：node scripts/art.mjs models | styles | batch | finalize'); process.exit(1) }
run().catch((e) => { console.error(e.message); process.exit(1) })
