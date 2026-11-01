<script setup lang="ts">
// 口算挑战：一页 20 道，像学校口算纸。屏幕上不计时，做完才告诉他用了多久、和上次比怎样。
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { newId, type AnswerEvent, type MbEvent } from '../lib/events'
import type { Baseline } from '../lib/fluency'
import type { WorldState } from '../lib/world'
import { buildChallenge, challengeHistory, CHALLENGE_SIZE } from '../lib/challenge'
import { PHRASES } from '../lib/phrases'
import { speak, stopSpeaking } from '../voice'
import Keypad from './Keypad.vue'

const props = defineProps<{ w: WorldState; events: MbEvent[]; baseline: Baseline }>()
const emit = defineEmits<{ record: [e: MbEvent]; done: [] }>()

// 进来时定下题目和“上一次”，之后作答写进事件也不变
const qs = buildChallenge(props.w, Math.random)
// iOS 14 没有 Array.prototype.at
const history = challengeHistory(props.events)
const prev = history.length ? history[history.length - 1] : null
const enough = qs.length === CHALLENGE_SIZE
const session = newId()

const cells = qs.map((q) => {
  const [before, after] = q.text.split('□')
  return { before, after }
})
const answers = ref<string[]>(qs.map(() => ''))
const active = ref(0)
const phase = ref<'sheet' | 'result' | 'end'>('sheet')
/** 点回一格时，第一下按键替换原答案，不接在后面 */
let fresh = true

// 每格累计停留的时间，记进 answer 事件；口算挑战不进格，这个只给家长区看快慢
const ms = qs.map(() => 0)
let since = 0
let startedAt = 0
let endedAt = 0

const allFilled = computed(() => answers.value.every((a) => a !== ''))
const ok = (i: number) => answers.value[i] === String(qs[i].answer)
const correct = computed(() => qs.filter((_, i) => ok(i)).length)
const seconds = computed(() => Math.round((endedAt - startedAt) / 1000))
const used = computed(() => {
  const m = Math.floor(seconds.value / 60), s = seconds.value % 60
  return m ? `用了 ${m} 分 ${s} 秒` : `用了 ${s} 秒`
})
const faster = computed(() => (prev ? Math.round(prev.ms / 1000) - seconds.value : 0))

onMounted(() => {
  if (!enough) return
  startedAt = Date.now()
  since = performance.now()
  emit('record', { kind: 'session_start', id: newId(), t: startedAt, session, mode: 'challenge' })
  speak(PHRASES.challengeStart)
})
onUnmounted(stopSpeaking)

function moveTo(i: number) {
  const now = performance.now()
  ms[active.value] += now - since
  since = now
  active.value = i
  fresh = true
}

function tap(i: number) {
  if (phase.value === 'sheet') moveTo(i)
}

function digit(d: string) {
  const cur = fresh ? '' : answers.value[active.value]
  fresh = false
  if (cur.length >= 2) return
  answers.value[active.value] = cur === '0' ? d : cur + d
}

function back() {
  fresh = false
  answers.value[active.value] = answers.value[active.value].slice(0, -1)
}

function confirm() {
  if (answers.value[active.value] === '') return
  // 跳到下一个空格；都填满了就交卷
  const n = qs.length
  for (let k = 1; k < n; k++) {
    const i = (active.value + k) % n
    if (answers.value[i] === '') { moveTo(i); return }
  }
  grade()
}

function grade() {
  if (phase.value !== 'sheet') return
  ms[active.value] += performance.now() - since
  endedAt = Date.now()
  // 时间严格递增，重新排序后作答仍在开始和结束之间
  qs.forEach((q, i) => {
    const e: AnswerEvent = {
      kind: 'answer', id: newId(), t: endedAt + i, session, fact: q.fact, qtype: q.qtype, mode: 'challenge',
      correct: ok(i), ms: Math.round(ms[i]), expected: q.answer, given: Number(answers.value[i]),
      listened: false, retry: false,
    }
    emit('record', e)
  })
  emit('record', { kind: 'session_end', id: newId(), t: endedAt + qs.length, session, mode: 'challenge', completed: true })
  phase.value = 'result'
  speak(PHRASES.challengeDone, () => {
    if (prev) speak(faster.value > 0 ? PHRASES.challengeFaster : PHRASES.challengeSlower)
  })
}

function quit() {
  if (phase.value === 'sheet' && enough) {
    emit('record', { kind: 'session_end', id: newId(), t: Date.now(), session, mode: 'challenge', completed: false })
  }
  phase.value = 'end'
  emit('done')
}
</script>

<template>
  <div class="challenge">
    <header class="bar">
      <button class="icon" aria-label="回家" @click="quit">🏠</button>
      <h1>⚡ 口算挑战</h1>
      <span v-if="phase === 'sheet'" class="count">{{ answers.filter((a) => a).length }} / {{ qs.length }}</span>
    </header>

    <p v-if="!enough" class="empty">熟了的题还不够 20 道，先多做几天今日练习吧。</p>

    <template v-else>
      <section class="sheet" :class="{ graded: phase !== 'sheet' }">
        <button
          v-for="(c, i) in cells"
          :key="i"
          class="cell"
          :class="{ on: phase === 'sheet' && i === active, wrong: phase !== 'sheet' && !ok(i), right: phase !== 'sheet' && ok(i) }"
          :data-q="qs[i].text"
          @click="tap(i)"
        >
          <span class="no">{{ i + 1 }}</span>
          <span class="expr">
            {{ c.before }}<span class="blank">{{ answers[i] || '' }}</span>{{ c.after }}
          </span>
          <span v-if="phase !== 'sheet' && !ok(i)" class="fix">{{ qs[i].answer }}</span>
          <span v-else-if="phase !== 'sheet'" class="tick">✓</span>
        </button>
      </section>

      <section v-if="phase === 'sheet'" class="input">
        <button v-if="allFilled" class="submit" @click="grade">交卷</button>
        <Keypad class="pad" @digit="digit" @back="back" @ok="confirm" />
      </section>

      <section v-else class="result">
        <p class="score">对了 {{ correct }} 道，共 {{ qs.length }} 道</p>
        <p class="time">{{ used }}</p>
        <p v-if="prev && faster > 0" class="cmp up">比上次快了 {{ faster }} 秒！</p>
        <p v-else-if="prev" class="cmp">{{ PHRASES.challengeSlower }}</p>
        <p v-if="correct < qs.length" class="hint">红色的题，右边是正确答案</p>
        <button class="big" @click="quit">回到岛上</button>
      </section>
    </template>
  </div>
</template>

<style scoped>
.challenge {
  min-height: 100vh; min-height: 100dvh; box-sizing: border-box; max-width: 720px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 8px; padding: 10px 14px calc(12px + env(safe-area-inset-bottom));
}
.bar { display: flex; align-items: center; gap: 10px; }
.icon { width: 44px; height: 44px; border: none; border-radius: 14px; background: #fff; font-size: 20px; box-shadow: 0 3px 0 #c9d6e3; }
h1 { margin: 0; flex: 1; font-size: 20px; }
.count { font-size: 15px; color: #6c7a89; }
.empty { background: #fff; border-radius: 18px; padding: 20px; text-align: center; font-size: 18px; }
/* 像口算纸：先竖着写满左列，再写右列 */
.sheet {
  display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(10, auto); grid-auto-flow: column;
  gap: 4px 8px; background: #fffdf5; border-radius: 16px; padding: 8px;
  box-shadow: 0 3px 0 #e6dcc0; border: 1px solid #efe3c2;
}
.cell {
  min-height: 44px; display: flex; align-items: center; gap: 4px; padding: 0 6px;
  border: none; border-bottom: 1px dashed #e6dcc0; border-radius: 8px; background: transparent;
  font: inherit; color: #2b3a4a; text-align: left;
}
.cell.on { background: #fff3c4; box-shadow: inset 0 0 0 2px #f5b700; }
.cell.wrong { background: #ffe5e5; }
.no { width: 18px; font-size: 11px; color: #a0a9b3; }
.expr { flex: 1; font-size: 20px; font-weight: 700; white-space: nowrap; }
.blank {
  display: inline-block; min-width: 30px; margin: 0 2px; border-bottom: 2px solid #2b3a4a;
  text-align: center; color: #2f7fd1;
}
.wrong .blank { color: #e74c3c; text-decoration: line-through; border-color: #e74c3c; }
.fix { font-size: 18px; font-weight: 800; color: #3e9a4b; }
.tick { font-size: 18px; color: #3e9a4b; }
.input { display: flex; flex-direction: column; gap: 6px; }
.submit {
  min-height: 48px; border: none; border-radius: 16px; background: #ffd23f; color: #6b4a00;
  font-size: 20px; font-weight: 800; box-shadow: 0 4px 0 #e0a800;
}
/* 口算纸占了大半屏，键盘矮一点，一屏放得下 */
.pad :deep(.key) { min-height: 52px; font-size: 26px; }
.pad { gap: 8px; }
.result { display: flex; flex-direction: column; gap: 6px; align-items: stretch; text-align: center; }
.result p { margin: 0; }
.score { font-size: 24px; font-weight: 800; }
.time { font-size: 20px; }
.cmp { font-size: 18px; color: #6c7a89; }
.cmp.up { color: #3e9a4b; font-weight: 800; }
.hint { font-size: 14px; color: #6c7a89; }
.big {
  margin-top: 6px; min-height: 60px; border: none; border-radius: 22px; background: #ff9f43; color: #fff;
  font-size: 22px; font-weight: 800; box-shadow: 0 5px 0 #d97f26;
}
</style>
