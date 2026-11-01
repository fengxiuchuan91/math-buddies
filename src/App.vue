<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { dayOf, mergeEvents, newId, type MbEvent, type Mode } from './lib/events'
import { replay, stage, type Stage } from './lib/world'
import { buildDaily, buildFree, warmups } from './lib/session'
import { placementItems } from './lib/placement'
import { loadEvents, saveEvent } from './store'
import { unlockAudio } from './voice'
import type { Run, RunResult } from './run'
import Home from './components/Home.vue'
import Practice from './components/Practice.vue'
import Done from './components/Done.vue'

const events = shallowRef<MbEvent[]>([])
const w = computed(() => replay(events.value))
const today = ref(dayOf(Date.now()))
const screen = ref<'loading' | 'home' | 'run' | 'done'>('loading')
const run = shallowRef<Run | null>(null)
const result = shallowRef<RunResult | null>(null)
let before = new Map<string, Stage>()
let starsBefore = 0

onMounted(async () => {
  events.value = mergeEvents(await loadEvents())
  screen.value = 'home'
})

function record(e: MbEvent) {
  events.value = [...events.value, e]
  void saveEvent(e)
}

const stageOf = (id: string) => stage(w.value, id)

function begin(mode: Mode) {
  unlockAudio()
  today.value = dayOf(Date.now())
  before = new Map(w.value.stages)
  starsBefore = w.value.stars
  const session = newId()
  if (mode === 'placement') {
    run.value = { mode, session, warmups: warmups(w.value, Math.random), items: [], placement: placementItems(Math.random) }
  } else if (mode === 'free') {
    run.value = { mode, session, ...buildFree(w.value, Math.random) }
  } else {
    run.value = { mode, session, ...buildDaily(w.value, { day: today.value, rng: Math.random }) }
  }
  screen.value = 'run'
}

function onDone(r: RunResult) {
  result.value = r
  today.value = dayOf(Date.now())
  screen.value = r.completed || r.answered ? 'done' : 'home'
}
</script>

<template>
  <Home v-if="screen === 'home'" :w="w" :day="today" @placement="begin('placement')" @daily="begin('daily')" @free="begin('free')" />
  <Practice
    v-else-if="screen === 'run' && run"
    :key="run.session"
    :run="run"
    :baseline="w.baseline"
    :stage-of="stageOf"
    @record="record"
    @done="onDone"
  />
  <Done v-else-if="screen === 'done' && result" :r="result" :before="before" :stars-before="starsBefore" :w="w" @home="screen = 'home'" />
</template>
