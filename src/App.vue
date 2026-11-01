<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { dayOf, mergeEvents, newId, type MbEvent, type Mode } from './lib/events'
import { replay, stage, type Stage } from './lib/world'
import { buildDaily, buildFree, warmups } from './lib/session'
import { placementItems } from './lib/placement'
import { challengeReady } from './lib/challenge'
import { loadEvents, requestPersist, saveEvent } from './store'
import { loadSettings, saveSettings, type Settings } from './settings'
import { initVoice, setVoiceName, unlockAudio } from './voice'
import type { Run, RunResult } from './run'
import Home from './components/Home.vue'
import Practice from './components/Practice.vue'
import Done from './components/Done.vue'
import Parent from './components/Parent.vue'
import Recorder from './components/Recorder.vue'
import Challenge from './components/Challenge.vue'

type Screen = 'loading' | 'home' | 'run' | 'done' | 'parent' | 'record' | 'challenge'

const events = shallowRef<MbEvent[]>([])
const w = computed(() => replay(events.value))
const today = ref(dayOf(Date.now()))
const screen = ref<Screen>('loading')
const settings = ref<Settings>(loadSettings())
const run = shallowRef<Run | null>(null)
const result = shallowRef<RunResult | null>(null)
/** 录音页从哪里进来，就回哪里 */
const recordFrom = ref<Screen>('home')
let before = new Map<string, Stage>()
let starsBefore = 0

const isWechat = /MicroMessenger/i.test(navigator.userAgent)
const canChallenge = computed(() => challengeReady(w.value, events.value, today.value))

async function reload() {
  events.value = mergeEvents(await loadEvents())
}

onMounted(async () => {
  setVoiceName(settings.value.childName)
  await Promise.all([reload(), initVoice(), requestPersist()])
  screen.value = 'home'
})

function record(e: MbEvent) {
  events.value = [...events.value, e]
  void saveEvent(e)
}

function updateSettings(s: Settings) {
  saveSettings(s)
  settings.value = loadSettings()
  setVoiceName(settings.value.childName)
}

const patchSettings = (p: Partial<Settings>) => updateSettings({ ...settings.value, ...p })
const stageOf = (id: string) => stage(w.value, id)

function go(s: Screen) {
  unlockAudio()
  today.value = dayOf(Date.now())
  if (s === 'record') recordFrom.value = screen.value === 'parent' ? 'parent' : 'home'
  screen.value = s
}

function begin(mode: Mode) {
  unlockAudio()
  today.value = dayOf(Date.now())
  before = new Map(w.value.stages)
  starsBefore = w.value.stars
  const session = newId()
  const s = settings.value
  if (mode === 'placement') {
    run.value = { mode, session, warmups: warmups(w.value, Math.random), items: [], placement: placementItems(Math.random) }
  } else if (mode === 'free') {
    run.value = { mode, session, ...buildFree(w.value, Math.random), freeLimitMs: s.freeMinutes * 60_000 }
  } else {
    run.value = { mode, session, ...buildDaily(w.value, { day: today.value, rng: Math.random, size: s.dailySize, pauseNew: s.pauseNew }) }
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
  <Home
    v-if="screen === 'home'"
    :w="w" :day="today" :settings="settings" :can-challenge="canChallenge" :is-wechat="isWechat"
    @placement="begin('placement')" @daily="begin('daily')" @free="begin('free')"
    @challenge="go('challenge')" @parent="go('parent')" @record="go('record')" @patch="patchSettings"
  />
  <Practice
    v-else-if="screen === 'run' && run"
    :key="run.session" :run="run" :baseline="w.baseline" :stage-of="stageOf"
    @record="record" @done="onDone"
  />
  <Done
    v-else-if="screen === 'done' && result"
    :r="result" :before="before" :stars-before="starsBefore" :w="w" :child-name="settings.childName" @home="go('home')"
  />
  <Parent
    v-else-if="screen === 'parent'"
    :w="w" :events="events" :settings="settings" :day="today"
    @close="go('home')" @record="go('record')" @settings="updateSettings" @restored="reload"
  />
  <Recorder v-else-if="screen === 'record'" :child-name="settings.childName" @close="screen = recordFrom" />
  <Challenge
    v-else-if="screen === 'challenge'"
    :w="w" :events="events" :baseline="w.baseline"
    @record="record" @done="go('home')"
  />
</template>
