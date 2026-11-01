// 读题：优先拼家长的录音来放；一句里有一条没录，就整句交给浏览器朗读，不在一句里混两种声音。
// 安卓微信里浏览器朗读可能没声音，题面文字照常显示。

import { buildVocab, tokenize, type Segment, type VocabEntry } from './lib/speech'
import { listClips } from './store'

let ctx: AudioContext | null = null

/** 录音页解码录音也用同一个 AudioContext */
export function audioContext(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!ctx && AC) ctx = new AC()
  } catch { /* 没有 Web Audio 也能玩 */ }
  return ctx
}

/** 微信禁止自动播放：第一次点按时解锁声音 */
export function unlockAudio() {
  const c = audioContext()
  try {
    void c?.resume()
    // 老版 iOS 要在点按里真放一下才算解锁
    if (c) {
      const src = c.createBufferSource()
      src.buffer = c.createBuffer(1, 1, 22050)
      src.connect(c.destination)
      src.start(0)
    }
  } catch { /* 同上 */ }
  try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance('')) } catch { /* 同上 */ }
}

/** iOS 14 的 decodeAudioData 只认回调写法，两种都接上 */
export function decodeAudio(data: ArrayBuffer): Promise<AudioBuffer> {
  const c = audioContext()
  if (!c) return Promise.reject(new Error('no audio context'))
  return new Promise((resolve, reject) => {
    const p = c.decodeAudioData(data, resolve, reject) as unknown as Promise<AudioBuffer> | undefined
    p?.then?.(resolve, reject)
  })
}

const blobToArrayBuffer = (b: Blob): Promise<ArrayBuffer> =>
  typeof b.arrayBuffer === 'function' ? b.arrayBuffer() : new Response(b).arrayBuffer()

let vocab: VocabEntry[] = buildVocab()
/** 编号 → 解码好的录音 */
const buffers = new Map<string, AudioBuffer>()
/** 编号 → 录音的更新时间，没变就不重新解码 */
const versions = new Map<string, number>()

/** 启动时载入家长录音 */
export async function initVoice(): Promise<void> {
  await refreshClips()
}

/** 录完、删掉一条后调用 */
export async function refreshClips(): Promise<void> {
  let clips
  try { clips = await listClips() } catch { return }
  const ids = new Set(clips.map((c) => c.id))
  for (const id of [...buffers.keys()]) if (!ids.has(id)) { buffers.delete(id); versions.delete(id) }
  await Promise.all(clips.map(async (c) => {
    if (versions.get(c.id) === c.updated && buffers.has(c.id)) return
    try {
      buffers.set(c.id, await decodeAudio(await blobToArrayBuffer(c.blob)))
      versions.set(c.id, c.updated)
    } catch { /* 解不了的录音当没录 */ }
  }))
}

/** 孩子的称呼也是一条录音，读到称呼时用它 */
export function setVoiceName(name: string): void {
  vocab = buildVocab(name.trim())
}

/** 只用已经录好的条目来拼 */
function recordedPlan(text: string): Segment[] | null {
  if (!buffers.size) return null
  const segs = tokenize(text, vocab.filter((e) => buffers.has(e.id)))
  return segs && segs.some((s) => s.kind === 'clip') ? segs : null
}

/** 这句能不能全用录音读出来（录音页显示用） */
export const canUseRecording = (text: string) => recordedPlan(text) !== null

let token = 0
let playing: AudioBufferSourceNode[] = []
const GAP_S = 0.06

function stopPlaying() {
  for (const s of playing) { try { s.onended = null; s.stop() } catch { /* 已经停了 */ } }
  playing = []
}

export function speak(text: string, onEnd?: () => void) {
  const my = ++token
  let done = false
  const fin = () => {
    if (done) return
    done = true
    if (my === token) onEnd?.()
  }
  stopPlaying()
  try { window.speechSynthesis?.cancel() } catch { /* 忽略 */ }

  const plan = recordedPlan(text)
  const c = audioContext()
  if (plan && c) {
    void c.resume?.()
    let t = c.currentTime + 0.05
    let last: AudioBufferSourceNode | null = null
    for (const seg of plan) {
      if (seg.kind === 'pause') { t += seg.ms / 1000; continue }
      const buf = buffers.get(seg.id)!
      const src = c.createBufferSource()
      src.buffer = buf
      src.connect(c.destination)
      src.start(t)
      playing.push(src)
      t += buf.duration + GAP_S
      last = src
    }
    if (last) last.onended = fin
    // 声音没解锁时 onended 不会来，按总时长兜底
    setTimeout(fin, (t - c.currentTime) * 1000 + 400)
    return
  }

  const s = window.speechSynthesis
  if (!s || !text) { setTimeout(fin, 0); return }
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'zh-CN'
  u.rate = 0.9
  const zh = s.getVoices().find((v) => v.lang.toLowerCase().startsWith('zh'))
  if (zh) u.voice = zh
  u.onend = fin
  u.onerror = fin
  s.speak(u)
  // 有的 WebView 不触发 onend，按字数估一个兜底时间
  setTimeout(fin, 800 + text.length * 320)
}

/** 录音页试听单条 */
export function playClip(id: string, onEnd?: () => void): boolean {
  const buf = buffers.get(id)
  const c = audioContext()
  if (!buf || !c) return false
  const my = ++token
  stopPlaying()
  try { window.speechSynthesis?.cancel() } catch { /* 忽略 */ }
  void c.resume?.()
  const src = c.createBufferSource()
  src.buffer = buf
  src.connect(c.destination)
  src.onended = () => { if (my === token) onEnd?.() }
  src.start()
  playing.push(src)
  return true
}

export function stopSpeaking() {
  token++
  stopPlaying()
  try { window.speechSynthesis?.cancel() } catch { /* 忽略 */ }
}
