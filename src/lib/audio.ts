// 录音处理的纯函数：混成单声道 → 重采样到 16kHz → 去首尾静音 → 统一音量 → WAV。
// 不碰浏览器 API，方便测试。

export const TARGET_RATE = 16000
export const TARGET_PEAK = 0.9

export function mixDown(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0]
  const n = Math.min(...channels.map((c) => c.length))
  const out = new Float32Array(n)
  for (const c of channels) for (let i = 0; i < n; i++) out[i] += c[i] / channels.length
  return out
}

/** 降采样时取窗口平均，少一点混叠；升采样时线性插值 */
export function resample(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x
  const ratio = from / to
  const n = Math.max(0, Math.round(x.length / ratio))
  const out = new Float32Array(n)
  if (ratio > 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * ratio)
      const b = Math.min(x.length, Math.max(a + 1, Math.floor((i + 1) * ratio)))
      let s = 0
      for (let k = a; k < b; k++) s += x[k]
      out[i] = s / (b - a)
    }
  } else {
    for (let i = 0; i < n; i++) {
      const p = i * ratio
      const a = Math.floor(p)
      const b = Math.min(x.length - 1, a + 1)
      out[i] = x[a] + (x[b] - x[a]) * (p - a)
    }
  }
  return out
}

export function peak(x: Float32Array): number {
  let p = 0
  for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]))
  return p
}

/**
 * 去掉首尾静音，前后各留一点余量，免得把第一个字的辅音切掉。
 * 门限跟着这条录音的最大音量走：手机离嘴远近不同，固定门限不好用。
 */
export function trimSilence(x: Float32Array, rate: number, padMs = 80): Float32Array {
  const win = Math.max(1, Math.round(rate * 0.02))
  const nw = Math.ceil(x.length / win)
  const rms = new Float32Array(nw)
  let top = 0
  for (let w = 0; w < nw; w++) {
    let s = 0
    const a = w * win, b = Math.min(x.length, a + win)
    for (let i = a; i < b; i++) s += x[i] * x[i]
    rms[w] = Math.sqrt(s / (b - a))
    top = Math.max(top, rms[w])
  }
  const th = Math.max(0.01, top * 0.12)
  let first = -1, last = -1
  for (let w = 0; w < nw; w++) if (rms[w] >= th) { if (first < 0) first = w; last = w }
  if (first < 0) return new Float32Array(0)
  const pad = Math.round((rate * padMs) / 1000)
  const a = Math.max(0, first * win - pad)
  const b = Math.min(x.length, (last + 1) * win + pad)
  return x.slice(a, b)
}

/** 峰值拉到 TARGET_PEAK；几乎没声音的不放大，免得只放大了底噪 */
export function normalize(x: Float32Array, target = TARGET_PEAK): Float32Array {
  const p = peak(x)
  if (p < 0.005) return x.slice()
  const g = target / p
  return x.map((v) => v * g)
}

/** 头尾 8ms 淡入淡出，拼着放时不会“咔”一声 */
export function fade(x: Float32Array, rate: number, ms = 8): Float32Array {
  const out = x.slice()
  const n = Math.min(Math.round((rate * ms) / 1000), Math.floor(out.length / 2))
  for (let i = 0; i < n; i++) {
    const g = i / n
    out[i] *= g
    out[out.length - 1 - i] *= g
  }
  return out
}

/** 16 位 PCM 单声道 WAV。iOS、安卓 WebView 都能解 */
export function encodeWav(x: Float32Array, rate = TARGET_RATE): ArrayBuffer {
  const buf = new ArrayBuffer(44 + x.length * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + x.length * 2, true); str(8, 'WAVE')
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, x.length * 2, true)
  for (let i = 0; i < x.length; i++) {
    const s = Math.max(-1, Math.min(1, x[i]))
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buf
}

/** 整条流水线。返回 null 表示这条录音里没听到声音 */
export function processRecording(channels: Float32Array[], rate: number): ArrayBuffer | null {
  const mono = resample(mixDown(channels), rate, TARGET_RATE)
  const trimmed = trimSilence(mono, TARGET_RATE)
  if (trimmed.length < TARGET_RATE * 0.1) return null
  return encodeWav(fade(normalize(trimmed), TARGET_RATE), TARGET_RATE)
}
