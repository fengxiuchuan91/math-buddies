<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Settings } from '../../settings'

const props = defineProps<{ settings: Settings }>()
const emit = defineEmits<{ settings: [s: Settings]; record: [] }>()

// 称呼用本地副本，失焦或回车才提交：边打字边提交会打断中文输入法
const name = ref(props.settings.childName)
watch(() => props.settings.childName, (v) => { name.value = v })

const set = (p: Partial<Settings>) => emit('settings', { ...props.settings, ...p })
const commitName = () => set({ childName: name.value.trim().slice(0, 12) })
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
</script>

<template>
  <section class="block">
    <h2>设置</h2>
    <label class="row">
      <span>孩子的称呼</span>
      <input v-model="name" maxlength="12" placeholder="例如：小宝" @change="commitName" @keyup.enter="($event.target as HTMLInputElement).blur()" />
    </label>
    <div class="row">
      <span>每天题数</span>
      <div class="step">
        <button aria-label="少 5 题" @click="set({ dailySize: clamp(settings.dailySize - 5, 5, 40) })">−</button>
        <b>{{ settings.dailySize }}</b>
        <button aria-label="多 5 题" @click="set({ dailySize: clamp(settings.dailySize + 5, 5, 40) })">+</button>
      </div>
    </div>
    <div class="row">
      <span>自由玩最多（分钟）</span>
      <div class="step">
        <button aria-label="少 5 分钟" @click="set({ freeMinutes: clamp(settings.freeMinutes - 5, 0, 30) })">−</button>
        <b>{{ settings.freeMinutes || '不开放' }}</b>
        <button aria-label="多 5 分钟" @click="set({ freeMinutes: clamp(settings.freeMinutes + 5, 0, 30) })">+</button>
      </div>
    </div>
    <div class="row">
      <span>暂停出新题<small>只复习学过的</small></span>
      <button class="toggle" :class="{ on: settings.pauseNew }" role="switch" :aria-checked="settings.pauseNew" @click="set({ pauseNew: !settings.pauseNew })">
        {{ settings.pauseNew ? '已暂停' : '正常出' }}
      </button>
    </div>
    <button class="wide" @click="emit('record')">🎙 录音：用你的声音读题</button>
  </section>
</template>

<style scoped>
.block { background: #fff; border-radius: 18px; padding: 12px 14px; box-shadow: 0 3px 0 #c9d6e3; display: flex; flex-direction: column; gap: 4px; }
h2 { margin: 0 0 4px; font-size: 17px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 52px; border-bottom: 1px solid #eef4fa; font-size: 16px; }
.row small { display: block; font-size: 12px; color: #8a97a5; }
input { width: 140px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border: 2px solid #c9d6e3; border-radius: 12px; font-size: 16px; font-family: inherit; -webkit-user-select: text; user-select: text; }
.step { display: flex; align-items: center; gap: 8px; }
.step b { min-width: 52px; text-align: center; font-size: 17px; }
.step button { width: 44px; height: 44px; border: none; border-radius: 12px; background: #eef4fa; font-size: 22px; font-weight: 800; color: #2b3a4a; }
.toggle { min-width: 88px; min-height: 44px; border: none; border-radius: 22px; background: #eef4fa; font-size: 15px; font-weight: 700; color: #6c7a89; }
.toggle.on { background: #ff9f43; color: #fff; }
.wide { margin-top: 10px; min-height: 52px; border: none; border-radius: 16px; background: #4aa3ff; color: #fff; font-size: 17px; font-weight: 700; box-shadow: 0 4px 0 #2f7fd1; }
</style>
