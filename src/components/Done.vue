<script setup lang="ts">
import { computed } from 'vue'
import { COMPANION_BY_ID } from '../lib/facts'
import { STAGE_NAMES, stage, type Stage, type WorldState } from '../lib/world'
import type { RunResult } from '../run'
import Buddy from './Buddy.vue'

const props = defineProps<{ r: RunResult; before: Map<string, Stage>; starsBefore: number; w: WorldState }>()
const emit = defineEmits<{ home: [] }>()

const cared = computed(() => props.r.companions.map((id) => COMPANION_BY_ID.get(id)!).filter(Boolean))
const changed = computed(() =>
  [...COMPANION_BY_ID.values()].filter((c) => stage(props.w, c.id) > (props.before.get(c.id) ?? 0)),
)
// 蛋变小时候叫“孵出来”，再往上才叫“长大”
const news = computed(() => [
  { title: '孵出来了', list: changed.value.filter((c) => !(props.before.get(c.id) ?? 0)) },
  { title: '长大了', list: changed.value.filter((c) => (props.before.get(c.id) ?? 0) > 0) },
].filter((x) => x.list.length))
const stars = computed(() => props.w.stars - props.starsBefore)
const minutes = computed(() => Math.max(1, Math.round(props.r.ms / 60000)))
const title = computed(() => {
  if (props.r.mode === 'placement') return '看完啦，小伙伴们出来了！'
  if (props.r.mode === 'free') return '玩得真开心'
  return props.r.completed ? '今天的练习做完了！' : '下次接着玩'
})
</script>

<template>
  <div class="done">
    <h1>{{ title }}</h1>
    <div v-if="stars > 0" class="stars">⭐ +{{ stars }}</div>

    <section v-for="x in news" :key="x.title" class="block">
      <h2>{{ x.title }}</h2>
      <div class="row">
        <div v-for="c in x.list" :key="c.id" class="mini">
          <Buddy :id="c.id" :world="c.world" :stage="stage(w, c.id)" happy />
          <span>{{ c.name }} · {{ STAGE_NAMES[stage(w, c.id)] }}</span>
        </div>
      </div>
    </section>

    <section v-if="cared.length && r.mode !== 'placement'" class="block">
      <h2>今天照顾了</h2>
      <div class="row">
        <div v-for="c in cared" :key="c.id" class="mini">
          <Buddy :id="c.id" :world="c.world" :stage="stage(w, c.id) || 1" />
          <span>{{ c.name }}</span>
        </div>
      </div>
    </section>

    <button class="big" @click="emit('home')">回到岛上</button>
    <p class="parent">给家长：{{ minutes }} 分钟，做了 {{ r.answered }} 题，对了 {{ r.correct }} 题</p>
  </div>
</template>

<style scoped>
.done { max-width: 720px; margin: 0 auto; padding: 24px 16px calc(24px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 16px; align-items: stretch; text-align: center; }
h1 { margin: 0; font-size: 28px; }
h2 { margin: 0 0 8px; font-size: 18px; color: #6c7a89; }
.stars { font-size: 36px; font-weight: 800; }
.block { background: #fff; border-radius: 22px; padding: 14px; box-shadow: 0 4px 0 #c9d6e3; }
.row { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.mini { width: 96px; font-size: 13px; }
.big { min-height: 64px; border: none; border-radius: 22px; background: #ff9f43; color: #fff; font-size: 24px; font-weight: 800; box-shadow: 0 5px 0 #d97f26; }
.parent { margin: 0; font-size: 14px; color: #6c7a89; }
</style>
