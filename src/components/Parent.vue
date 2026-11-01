<script setup lang="ts">
// 家长区：先过乘法门槛，再看报表、掌握图、设置与备份。
import { ref } from 'vue'
import type { MbEvent } from '../lib/events'
import type { WorldState } from '../lib/world'
import type { Settings } from '../settings'
import Gate from './parent/Gate.vue'
import Report from './parent/Report.vue'
import MasteryGrid from './parent/MasteryGrid.vue'
import SettingsPanel from './parent/SettingsPanel.vue'
import BackupPanel from './parent/BackupPanel.vue'

defineProps<{ w: WorldState; events: MbEvent[]; settings: Settings; day: number }>()
const emit = defineEmits<{ close: []; record: []; settings: [s: Settings]; restored: [] }>()

const passed = ref(false)
const TABS = [
  { id: 'report', name: '报表' },
  { id: 'grid', name: '掌握图' },
  { id: 'settings', name: '设置' },
] as const
const tab = ref<(typeof TABS)[number]['id']>('report')
</script>

<template>
  <Gate v-if="!passed" @pass="passed = true" @close="emit('close')" />
  <div v-else class="parent">
    <header class="top">
      <button class="back" @click="emit('close')">← 返回</button>
      <h1>家长区</h1>
    </header>
    <nav class="tabs">
      <button v-for="t in TABS" :key="t.id" :class="{ on: tab === t.id }" @click="tab = t.id">{{ t.name }}</button>
    </nav>
    <Report v-if="tab === 'report'" :w="w" :events="events" :day="day" />
    <MasteryGrid v-else-if="tab === 'grid'" :w="w" />
    <template v-else>
      <SettingsPanel :settings="settings" @settings="(s) => emit('settings', s)" @record="emit('record')" />
      <BackupPanel :events="events" :settings="settings" @settings="(s) => emit('settings', s)" @restored="emit('restored')" />
    </template>
  </div>
</template>

<style scoped>
.parent { max-width: 720px; margin: 0 auto; padding: 12px 16px calc(24px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 12px; -webkit-user-select: text; user-select: text; }
.top { display: flex; align-items: center; gap: 12px; }
h1 { margin: 0; font-size: 22px; }
.back { min-height: 44px; padding: 0 16px; border: none; border-radius: 14px; background: #fff; font-size: 16px; box-shadow: 0 3px 0 #c9d6e3; }
.tabs { display: flex; gap: 8px; }
.tabs button { flex: 1; min-height: 48px; border: none; border-radius: 16px; background: #ffffffaa; font-size: 17px; font-weight: 700; color: #2b3a4a; }
.tabs button.on { background: #fff; box-shadow: 0 3px 0 #c9d6e3; }
</style>
