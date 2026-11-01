import { describe, expect, it } from 'vitest'
import { TARGET_PEAK, encodeWav, fade, mixDown, normalize, peak, processRecording, resample, trimSilence } from '../src/lib/audio'

const RATE = 16000
/** 前后各 0.5 秒静音（带一点底噪），中间 0.4 秒 440Hz 的声音 */
function padded(amp = 0.3): Float32Array {
  const x = new Float32Array(RATE * 1.4)
  for (let i = 0; i < x.length; i++) x[i] = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.002
  for (let i = RATE * 0.5; i < RATE * 0.9; i++) x[i] = amp * Math.sin((2 * Math.PI * 440 * i) / RATE)
  return x
}

describe('音频处理', () => {
  it('去首尾静音后变短，留下有声音的那段和前后余量', () => {
    const x = padded()
    const y = trimSilence(x, RATE)
    expect(y.length).toBeLessThan(x.length)
    expect(y.length).toBeGreaterThanOrEqual(RATE * 0.4)
    expect(y.length).toBeLessThanOrEqual(RATE * (0.4 + 0.2))
    expect(trimSilence(new Float32Array(RATE), RATE).length).toBe(0)
  })

  it('统一音量后峰值是 0.9；几乎没声音的不放大', () => {
    expect(peak(normalize(padded(0.1)))).toBeCloseTo(TARGET_PEAK, 5)
    expect(peak(normalize(padded(0.95)))).toBeCloseTo(TARGET_PEAK, 5)
    const quiet = new Float32Array(100).fill(0.001)
    expect(peak(normalize(quiet))).toBeCloseTo(0.001, 6)
  })

  it('WAV 头：RIFF、16kHz、单声道、16 位，数据长度对得上', () => {
    const x = new Float32Array(1234).fill(0.5)
    const buf = encodeWav(x, RATE)
    const v = new DataView(buf)
    const s = (o: number) => String.fromCharCode(...new Uint8Array(buf, o, 4))
    expect([s(0), s(8), s(12), s(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data'])
    expect(v.getUint32(4, true)).toBe(36 + 1234 * 2)
    expect(v.getUint16(22, true)).toBe(1)
    expect(v.getUint32(24, true)).toBe(RATE)
    expect(v.getUint16(34, true)).toBe(16)
    expect(v.getUint32(40, true)).toBe(1234 * 2)
    expect(buf.byteLength).toBe(44 + 1234 * 2)
    expect(v.getInt16(44, true)).toBe(Math.round(0.5 * 0x7fff - 0.5))
  })

  it('重采样后长度按比例变化', () => {
    expect(resample(new Float32Array(48000), 48000, 16000).length).toBe(16000)
    expect(resample(new Float32Array(44100), 44100, 16000).length).toBe(16000)
    expect(resample(new Float32Array(8000), 8000, 16000).length).toBe(16000)
    const same = new Float32Array(10)
    expect(resample(same, 16000, 16000)).toBe(same)
  })

  it('混成单声道取平均；淡入淡出后头尾为 0', () => {
    const m = mixDown([new Float32Array([1, 1, 1]), new Float32Array([0, 0.5, 1])])
    expect([...m]).toEqual([0.5, 0.75, 1])
    const f = fade(new Float32Array(1000).fill(1), RATE)
    expect(f[0]).toBe(0)
    expect(f[999]).toBe(0)
    expect(f[500]).toBe(1)
  })

  it('整条流水线：48kHz 双声道 → 16kHz WAV；全是静音返回 null', () => {
    const tone = resample(padded(), RATE, 48000)
    const wav = processRecording([tone, tone], 48000)!
    expect(new DataView(wav).getUint32(24, true)).toBe(RATE)
    const samples = (wav.byteLength - 44) / 2
    expect(samples).toBeLessThan(RATE * 1.4)
    expect(samples).toBeGreaterThan(RATE * 0.35)
    expect(processRecording([new Float32Array(48000)], 48000)).toBeNull()
  })
})
