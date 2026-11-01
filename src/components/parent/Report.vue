<script setup lang="ts">
import { computed } from 'vue'
import type { MbEvent } from '../../lib/events'
import type { WorldState } from '../../lib/world'
import { ERROR_NAMES, type ErrorKind } from '../../lib/errors'
import { errorCounts, topFacts, weekStats } from '../../lib/report'

const props = defineProps<{ w: WorldState; events: MbEvent[]; day: number }>()

const week = computed(() => weekStats(props.events, props.w, props.day))
const slow = computed(() => topFacts(props.w, 'slow'))
const wrong = computed(() => topFacts(props.w, 'wrong'))
const errs = computed(() => {
  const c = errorCounts(props.events)
  const max = Math.max(1, ...Object.values(c))
  return (Object.keys(c) as ErrorKind[]).map((k) => ({ k, name: ERROR_NAMES[k], n: c[k], pct: (c[k] / max) * 100 }))
})
const accText = computed(() => (week.value.accuracy === null ? '—' : `${Math.round(week.value.accuracy * 100)}%`))
</script>

<template>
  <div class="report">
    <section class="block">
      <h2>最近 7 天</h2>
      <div class="cards">
        <div class="card"><b>{{ week.daysDone }}</b><span>天做完</span></div>
        <div class="card"><b>{{ week.minutes }}</b><span>分钟</span></div>
        <div class="card"><b>{{ week.questions }}</b><span>题</span></div>
        <div class="card"><b>{{ accText }}</b><span>首答正确率</span></div>
      </div>
    </section>

    <section class="block">
      <h2>对但慢最多的 10 道</h2>
      <p class="hint">慢说明他可能还在数手指</p>
      <ol v-if="slow.length" class="rank">
        <li v-for="x in slow" :key="x.fact"><span>{{ x.text }}</span><em>慢 {{ x.count }} 次</em></li>
      </ol>
      <p v-else class="empty">还没有</p>
    </section>

    <section class="block">
      <h2>错得最多的 10 道</h2>
      <ol v-if="wrong.length" class="rank">
        <li v-for="x in wrong" :key="x.fact"><span>{{ x.text }}</span><em>错 {{ x.count }} 次</em></li>
      </ol>
      <p v-else class="empty">还没有</p>
    </section>

    <section class="block">
      <h2>错法分布</h2>
      <p class="hint">只统计“算一算，等于几”这种题</p>
      <div v-for="e in errs" :key="e.k" class="bar">
        <span class="label">{{ e.name }}</span>
        <div class="track"><div :style="{ width: e.pct + '%' }" /></div>
        <span class="n">{{ e.n }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.report { display: flex; flex-direction: column; gap: 12px; }
.block { background: #fff; border-radius: 18px; padding: 12px 14px; box-shadow: 0 3px 0 #c9d6e3; }
h2 { margin: 0 0 8px; font-size: 17px; }
.hint { margin: -4px 0 8px; font-size: 13px; color: #6c7a89; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.card { background: #f4f8fb; border-radius: 12px; padding: 8px 4px; text-align: center; display: flex; flex-direction: column; }
.card b { font-size: 22px; }
.card span { font-size: 12px; color: #6c7a89; }
.rank { margin: 0; padding-left: 22px; }
.rank li { padding: 4px 0; font-size: 16px; }
.rank li span { display: inline-block; min-width: 80px; font-weight: 700; }
.rank em { font-style: normal; font-size: 13px; color: #6c7a89; }
.empty { margin: 0; color: #8a97a5; }
.bar { display: grid; grid-template-columns: 140px 1fr 28px; gap: 8px; align-items: center; padding: 3px 0; font-size: 13px; }
.track { height: 12px; background: #eef4fa; border-radius: 6px; overflow: hidden; }
.track div { height: 100%; background: #ff9f43; }
.n { text-align: right; font-weight: 700; }
</style>
