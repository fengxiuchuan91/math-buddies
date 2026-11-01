<script setup lang="ts">
// 家长录音页：按清单一条条录，题目就用家长的声音读给孩子听。
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NAME_ID, buildVocab, type VocabEntry, type VocabGroup } from '../lib/speech'
import { processRecording } from '../lib/audio'
import { deleteClip, listClips, putClip } from '../store'
import { decodeAudio, playClip, refreshClips, speak, stopSpeaking, unlockAudio, canUseRecording } from '../voice'

const props = defineProps<{ childName: string }>()
const emit = defineEmits<{ close: [] }>()

const GROUPS: VocabGroup[] = ['必需', '讲解', '鼓励', '名字']
const SAMPLES = ['8加5等于几？', '原来有3个，又来了2个，一共有几个？', '我们一起看看。8还差2个，把5分成2和3']
const MAX_MS = 10_000

const vocab = computed(() => buildVocab(props.childName))
const done = ref(new Set<string>())
const group = ref<VocabGroup>('必需')
const cur = ref<VocabEntry | null>(null)
const recording = ref(false)
const busy = ref(false)
const error = ref('')
const saved = ref('')
const sample = ref(0)
const isWechat = /MicroMessenger/i.test(navigator.userAgent)

/** 没有称呼时，称呼那一条先跳过 */
const usable = (e: VocabEntry) => !!e.text
const list = computed(() => vocab.value.filter((e) => e.group === group.value))
const total = computed(() => vocab.value.filter(usable).length)
const doneCount = computed(() => vocab.value.filter((e) => usable(e) && done.value.has(e.id)).length)
const groupCount = (g: VocabGroup) => {
  const xs = vocab.value.filter((e) => e.group === g && usable(e))
  return `${xs.filter((e) => done.value.has(e.id)).length}/${xs.length}`
}
const label = (e: VocabEntry) => (e.id === NAME_ID && !e.text ? '孩子的称呼（先在家长区设置）' : e.text)

function nextTodo(after?: VocabEntry): VocabEntry | null {
  const all = vocab.value.filter(usable)
  const start = after ? all.findIndex((e) => e.id === after.id) + 1 : 0
  return [...all.slice(start), ...all.slice(0, start)].find((e) => !done.value.has(e.id)) ?? null
}

function select(e: VocabEntry) {
  if (recording.value || busy.value || !usable(e)) return
  cur.value = e
  group.value = e.group
  saved.value = ''
}

async function loadDone() {
  try { done.value = new Set((await listClips()).map((c) => c.id)) } catch { done.value = new Set() }
}

onMounted(async () => {
  await loadDone()
  const first = nextTodo() ?? vocab.value.find(usable) ?? null
  if (first) select(first)
})

// —— 录音 ——
let stream: MediaStream | null = null
let rec: MediaRecorder | null = null
let chunks: Blob[] = []
let timer = 0

function micError(e: unknown): string {
  const name = (e as { name?: string })?.name ?? ''
  const tail = '建议用手机自带的 Safari 或 Chrome 打开这个页面再录，不要在微信里录。'
  if (name === 'NotAllowedError' || name === 'SecurityError') return `没有拿到麦克风权限。请在弹窗里点“允许”，或到手机设置里打开麦克风权限。${tail}`
  if (name === 'NotFoundError') return `没找到麦克风。${tail}`
  return `录音没能开始。${tail}`
}

/** 同一页里只要一次麦克风权限，离开时再关掉 */
async function getStream(): Promise<MediaStream> {
  if (stream && stream.getTracks().some((t) => t.readyState === 'live')) return stream
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  return stream
}

function pickMime(): string | undefined {
  for (const m of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m
  }
  return undefined
}

async function toggle() {
  unlockAudio()
  if (recording.value) { rec?.stop(); return }
  if (!cur.value || busy.value) return
  error.value = ''
  saved.value = ''
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    error.value = micError({ name: 'Unsupported' })
    return
  }
  try {
    const s = await getStream()
    const mime = pickMime()
    rec = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s)
  } catch (e) {
    error.value = micError(e)
    return
  }
  const entry = cur.value
  chunks = []
  rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data) }
  rec.onstop = () => { clearTimeout(timer); recording.value = false; void save(entry, new Blob(chunks, { type: rec?.mimeType || 'audio/webm' })) }
  stopSpeaking()
  rec.start()
  recording.value = true
  // 忘了点停止也不会一直录下去
  timer = window.setTimeout(() => rec?.state === 'recording' && rec.stop(), MAX_MS)
}

async function save(entry: VocabEntry, raw: Blob) {
  busy.value = true
  try {
    const decoded = await decodeAudio(await new Response(raw).arrayBuffer())
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i))
    const wav = processRecording(channels, decoded.sampleRate)
    if (!wav) { error.value = '没听到声音，靠近一点再录一次。'; return }
    await putClip({ id: entry.id, blob: new Blob([wav], { type: 'audio/wav' }), updated: Date.now() })
    await refreshClips()
    await loadDone()
    saved.value = entry.text
    // 录完先放一遍给家长听，再跳到下一条没录的
    playClip(entry.id, () => { if (cur.value?.id === entry.id) { const n = nextTodo(entry); if (n) select(n) } })
  } catch {
    error.value = '这条没存上，再录一次试试。'
  } finally {
    busy.value = false
  }
}

function listen() {
  unlockAudio()
  if (cur.value && done.value.has(cur.value.id)) playClip(cur.value.id)
}

async function redo() {
  if (!cur.value) return
  await deleteClip(cur.value.id)
  await refreshClips()
  await loadDone()
  void toggle()
}

function skip() {
  if (!cur.value) return
  const n = nextTodo(cur.value) ?? vocab.value.filter(usable).find((e) => e.id !== cur.value!.id)
  if (n) select(n)
}

function trySample() {
  unlockAudio()
  speak(SAMPLES[sample.value % SAMPLES.length])
  sample.value++
}
const nextSample = computed(() => SAMPLES[sample.value % SAMPLES.length])
const sampleRecorded = computed(() => canUseRecording(nextSample.value))

function close() {
  if (recording.value) rec?.stop()
  emit('close')
}

onUnmounted(() => {
  clearTimeout(timer)
  try { if (rec?.state === 'recording') rec.stop() } catch { /* 已经停了 */ }
  stream?.getTracks().forEach((t) => t.stop())
  stopSpeaking()
})
</script>

<!-- 模板 -->
<template>
  <div class="recorder">
    <header class="top">
      <button class="back" @click="close">← 返回</button>
      <h1>录音</h1>
      <span class="count">{{ doneCount }} / {{ total }}</span>
    </header>

    <p v-if="isWechat" class="warn">微信里录音常常拿不到麦克风。建议点右上角「…」选「在浏览器打开」再录。</p>

    <nav class="tabs">
      <button v-for="g in GROUPS" :key="g" :class="{ on: group === g }" @click="group = g">
        {{ g }}<small>{{ groupCount(g) }}</small>
      </button>
    </nav>

    <section v-if="cur" class="now">
      <p class="hint">请清楚地读出：</p>
      <div class="text">{{ label(cur) }}</div>
      <button class="rec" :class="{ on: recording }" :disabled="busy" @click="toggle">
        {{ recording ? '■ 停止' : busy ? '处理中…' : done.has(cur.id) ? '● 再录一遍' : '● 开始录' }}
      </button>
      <div class="row">
        <button :disabled="!done.has(cur.id) || recording" @click="listen">▶ 试听</button>
        <button :disabled="!done.has(cur.id) || recording || busy" @click="redo">↺ 重录</button>
        <button :disabled="recording || busy" @click="skip">下一条 →</button>
      </div>
      <p v-if="saved" class="ok">已存好：{{ saved }}</p>
      <p v-if="error" class="err">{{ error }}</p>
    </section>

    <ul class="list">
      <li v-for="e in list" :key="e.id">
        <button :class="{ on: cur?.id === e.id, done: done.has(e.id), off: !usable(e) }" @click="select(e)">
          <span class="mark">{{ done.has(e.id) ? '✓' : '○' }}</span>{{ label(e) }}
        </button>
      </li>
    </ul>

    <section class="sample">
      <button @click="trySample">🔊 试听整句</button>
      <span>{{ nextSample }}（{{ sampleRecorded ? '用你的录音' : '还缺几条，先用机器朗读' }}）</span>
    </section>
  </div>
</template>

<style scoped>
.recorder { max-width: 720px; margin: 0 auto; padding: 12px 16px calc(24px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 12px; }
.top { display: flex; align-items: center; gap: 12px; }
h1 { margin: 0; font-size: 22px; flex: 1; }
.count { font-weight: 700; color: #6c7a89; }
.back { min-height: 44px; padding: 0 16px; border: none; border-radius: 14px; background: #fff; font-size: 16px; box-shadow: 0 3px 0 #c9d6e3; }
.warn { margin: 0; padding: 10px 12px; border-radius: 14px; background: #fff3c4; font-size: 14px; line-height: 1.5; }
.tabs { display: flex; gap: 6px; }
.tabs button { flex: 1; min-height: 48px; border: none; border-radius: 14px; background: #ffffffaa; font-size: 15px; font-weight: 700; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.tabs button small { font-size: 11px; font-weight: 400; color: #6c7a89; }
.tabs button.on { background: #fff; box-shadow: 0 3px 0 #c9d6e3; }
.now { background: #fff; border-radius: 22px; padding: 16px; box-shadow: 0 4px 0 #c9d6e3; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
.hint { margin: 0; color: #6c7a89; }
.text { font-size: 26px; font-weight: 800; line-height: 1.4; }
.rec { min-height: 64px; min-width: 200px; border: none; border-radius: 32px; background: #ff6b6b; color: #fff; font-size: 22px; font-weight: 800; box-shadow: 0 5px 0 #d14b4b; }
.rec.on { background: #2b3a4a; box-shadow: 0 5px 0 #111; animation: pulse 1s infinite; }
.rec:disabled { opacity: 0.6; }
@keyframes pulse { 50% { transform: scale(1.04); } }
.row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.row button { min-height: 44px; padding: 0 14px; border: none; border-radius: 14px; background: #eef4fa; font-size: 15px; }
.row button:disabled { opacity: 0.4; }
.ok { margin: 0; color: #3e9a4b; }
.err { margin: 0; color: #c0392b; line-height: 1.5; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.list button { width: 100%; min-height: 44px; padding: 8px 12px; border: none; border-radius: 12px; background: #fff; text-align: left; font-size: 16px; display: flex; gap: 8px; align-items: center; }
.list button.on { outline: 3px solid #4aa3ff; }
.list button.done .mark { color: #3e9a4b; }
.list button.off { color: #aab4bf; }
.mark { width: 18px; font-weight: 800; color: #c9d6e3; }
.sample { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; font-size: 14px; color: #6c7a89; }
.sample button { min-height: 44px; padding: 0 16px; border: none; border-radius: 14px; background: #4aa3ff; color: #fff; font-weight: 700; font-size: 16px; }
</style>
