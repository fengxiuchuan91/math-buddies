<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { usePractice } from '../usePractice'
import type { Run, RunResult } from '../run'
import type { MbEvent } from '../lib/events'
import type { Baseline } from '../lib/fluency'
import type { Stage } from '../lib/world'
import { COMPANION_BY_ID, fact } from '../lib/facts'
import Keypad from './Keypad.vue'
import VisualView from './VisualView.vue'
import Buddy from './Buddy.vue'
import { speak } from '../voice'

const props = defineProps<{ run: Run; baseline: Baseline; stageOf: (id: string) => Stage }>()
const emit = defineEmits<{ record: [e: MbEvent]; done: [r: RunResult] }>()
const p = usePractice(props.run, () => props.baseline, (e) => emit('record', e), (r) => emit('done', r))
const { phase, q, steps, step, praise } = p

const input = ref('')
const op = ref<'' | '+' | '-'>('')
const shaking = ref(false)
const reset = () => { input.value = ''; op.value = '' }
watch([p.pos, p.wpos], reset)
watch(phase, (ph) => { if (ph === 'ask' || ph === 'fix' || ph === 'teach') reset() })
watch(p.shake, () => { input.value = ''; shaking.value = true; setTimeout(() => (shaking.value = false), 400) })
onMounted(p.start)

const companion = computed(() => (p.item.value ? COMPANION_BY_ID.get(fact(p.item.value.fact).companion) : undefined))
const answering = computed(() => phase.value === 'ask' || phase.value === 'fix')
const lesson = computed(() => phase.value === 'teach' || phase.value === 'explain')
const pct = computed(() => (phase.value === 'warmup' ? 0 : Math.min(100, (p.pos.value / Math.max(1, p.total.value)) * 100)))
const hidden = computed(() => phase.value === 'ask' && !!q.value?.flashMs && !p.flashOn.value)
const keypadOn = computed(() => phase.value === 'warmup' || (answering.value && q.value?.input !== 'compare'))

const display = computed(() => {
  const cur = q.value
  if (!cur) return ''
  const sym = op.value === '-' ? '−' : op.value
  if (cur.input === 'picture') return cur.text.replace('○', sym || '○').replace('□', input.value || '□')
  if (cur.input === 'compare') return cur.text.replace('○', input.value || '○')
  return cur.text.replace('□', input.value || '□')
})

/** 讲解时把整道题连答案写出来 */
const factLine = computed(() => {
  const it = p.item.value
  if (!it) return ''
  const f = fact(it.fact)
  if (f.kind === 'add') return `${f.a} + ${f.b} = ${f.answer}`
  if (f.kind === 'sub') return `${f.a} − ${f.b} = ${f.answer}`
  if (f.kind === 'teen') return `${f.a} = 10 + ${f.a - 10}`
  return String(f.answer)
})

function digit(d: string) {
  if (input.value.length >= 2) return
  input.value = input.value === '0' ? d : input.value + d
}
function back() { input.value = input.value.slice(0, -1) }
function ok() {
  if (!input.value) return
  if (phase.value === 'warmup') { p.warmSubmit(input.value); input.value = ''; return }
  if (q.value?.input === 'picture') {
    if (op.value) { p.submit(op.value + input.value); return }
    // 还没选加减：提醒一下，不清空已输入的数
    speak('先选加号还是减号')
    shaking.value = true
    setTimeout(() => (shaking.value = false), 400)
    return
  }
  p.submit(input.value)
}
function compare(sym: string) { input.value = sym; p.submit(sym) }
function lessonNext() { if (phase.value === 'teach') p.teachNext(); else p.explainNext() }
</script>

<template>
  <div class="practice" :class="{ shaking }">
    <header class="bar">
      <button class="icon" aria-label="回家" @click="p.finish(false)">🏠</button>
      <div class="progress"><div :style="{ width: pct + '%' }" /></div>
      <button class="icon" aria-label="读题" :disabled="!answering" @click="p.listen()">🔊</button>
    </header>

    <section v-if="phase === 'warmup'" class="stage">
      <p class="tip">看到几就按几</p>
      <div class="target">{{ p.warmTarget.value }}</div>
      <div class="eq">{{ input || '　' }}</div>
    </section>

    <section v-else-if="lesson && steps[step]" class="stage lesson">
      <p class="tip">{{ phase === 'teach' ? '学新的' : '我们一起看看' }}</p>
      <div class="eq small">{{ factLine }}</div>
      <VisualView :v="steps[step].visual" />
      <p class="say">{{ steps[step].text }}</p>
      <button class="next" @click="lessonNext">
        {{ step < steps.length - 1 ? '下一步' : phase === 'teach' ? '我会了' : '我来写' }}
      </button>
    </section>

    <section v-else-if="q" class="stage">
      <div class="who">
        <Buddy v-if="companion" :id="companion.id" :world="companion.world" :stage="stageOf(companion.id) || 1" :happy="phase === 'ok'" class="who-art" />
        <span v-if="companion">{{ companion.name }}</span>
      </div>
      <p v-if="phase === 'fix'" class="tip">你来写出答案</p>
      <div v-if="q.visual" class="vis-wrap">
        <div v-if="hidden" class="vis-hidden">?</div>
        <VisualView v-else :v="q.visual" />
      </div>
      <VisualView v-if="p.hint.value && phase === 'ask'" :v="p.hint.value.visual" class="hint" />
      <div class="eq">{{ display }}</div>
      <div v-if="phase === 'ok' || phase === 'oops'" class="praise" :class="phase">{{ praise }}</div>
      <div v-else-if="answering && q.input === 'picture'" class="ops">
        <button :class="{ on: op === '+' }" @click="op = '+'">+</button>
        <button :class="{ on: op === '-' }" @click="op = '-'">−</button>
      </div>
      <div v-else-if="answering && q.input === 'compare'" class="ops">
        <button v-for="s in ['>', '<', '=']" :key="s" @click="compare(s)">{{ s }}</button>
      </div>
    </section>

    <Keypad v-if="keypadOn" class="pad" @digit="digit" @back="back" @ok="ok" />
  </div>
</template>

<style scoped>
.practice {
  min-height: 100vh; min-height: 100dvh; box-sizing: border-box; max-width: 960px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 12px; padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
}
.bar { display: flex; align-items: center; gap: 12px; }
.icon { width: 48px; height: 48px; border: none; border-radius: 14px; background: #fff; font-size: 22px; box-shadow: 0 3px 0 #c9d6e3; }
.icon:disabled { opacity: 0.4; }
.progress { flex: 1; height: 14px; background: #fff; border-radius: 7px; overflow: hidden; }
.progress div { height: 100%; background: #5cc46a; transition: width 0.3s; }
.stage {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  background: #fff; border-radius: 24px; padding: 16px; box-shadow: 0 4px 0 #c9d6e3;
}
.tip { margin: 0; font-size: 18px; color: #6c7a89; }
.target { font-size: 96px; font-weight: 800; color: #ff9f43; line-height: 1; }
.eq { font-size: 44px; font-weight: 800; letter-spacing: 2px; min-height: 52px; color: #2b3a4a; }
.eq.small { font-size: 30px; }
.say { margin: 0; font-size: 20px; line-height: 1.5; text-align: center; }
.next { min-height: 56px; padding: 0 32px; border: none; border-radius: 18px; background: #4aa3ff; color: #fff; font-size: 22px; font-weight: 700; box-shadow: 0 4px 0 #2f7fd1; }
.who { display: flex; align-items: center; gap: 8px; align-self: flex-start; font-size: 14px; color: #6c7a89; }
.who-art { width: 44px; }
.vis-wrap { width: 100%; min-height: 90px; display: flex; align-items: center; justify-content: center; }
.vis-hidden { font-size: 64px; font-weight: 800; color: #c9d6e3; }
.hint { opacity: 0.8; max-width: 300px; }
.praise { font-size: 28px; font-weight: 800; }
.praise.ok { color: #3e9a4b; }
.praise.oops { color: #6c7a89; }
.ops { display: flex; gap: 14px; }
.ops button { width: 76px; height: 68px; border: none; border-radius: 18px; background: #eef4fa; font-size: 34px; font-weight: 800; color: #2b3a4a; box-shadow: 0 4px 0 #c9d6e3; }
.ops button.on { background: #ffd23f; }
.shaking .eq { animation: shake 0.4s; }
@keyframes shake { 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
/* 平板横屏：题目在左，键盘在右 */
@media (orientation: landscape) and (min-width: 800px) {
  .practice { display: grid; grid-template-columns: 1fr 380px; grid-template-rows: auto 1fr; }
  .bar { grid-column: 1 / -1; }
  .stage:last-child { grid-column: 1 / -1; }
  .pad { align-self: center; }
}
</style>
