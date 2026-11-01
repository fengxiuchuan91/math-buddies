// 读题。家长录音到位前先用浏览器朗读；安卓微信里可能没声音，题面文字照常显示。

let ctx: AudioContext | null = null

/** 微信禁止自动播放：第一次点按时解锁声音 */
export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!ctx && AC) ctx = new AC()
    void ctx?.resume()
  } catch { /* 没有 Web Audio 也能玩 */ }
  try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance('')) } catch { /* 同上 */ }
}

let token = 0

export function speak(text: string, onEnd?: () => void) {
  const s = window.speechSynthesis
  const my = ++token
  let done = false
  const fin = () => {
    if (done) return
    done = true
    if (my === token) onEnd?.()
  }
  if (!s || !text) { setTimeout(fin, 0); return }
  s.cancel()
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

export function stopSpeaking() {
  token++
  try { window.speechSynthesis?.cancel() } catch { /* 忽略 */ }
}
