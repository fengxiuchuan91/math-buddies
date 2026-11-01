<script setup lang="ts">
import { computed, ref } from 'vue'
import { COMPANIONS, type World } from '../lib/facts'
import { STAGE_NAMES, dailyDone, openWorlds, sleepy, stage, type WorldState } from '../lib/world'
import Buddy from './Buddy.vue'

const props = defineProps<{ w: WorldState; day: number }>()
const emit = defineEmits<{ placement: []; daily: []; free: [] }>()

const WORLDS: { id: World; name: string; locked: string }[] = [
  { id: 'dino', name: '恐龙岛', locked: '' },
  { id: 'park', name: '动物乐园', locked: '' },
  { id: 'site', name: '工地', locked: '「凑十龙」和「小松鼠」长大后开放' },
]
const tab = ref<World>('dino')
const open = computed(() => openWorlds(props.w))
const list = computed(() => COMPANIONS.filter((c) => c.world === tab.value))
const done = computed(() => dailyDone(props.w, props.day))
const canFree = computed(() => [...props.w.facts.values()].some((s) => s.box >= 3))
const tired = computed(() => COMPANIONS.filter((c) => sleepy(props.w, c, props.day)).length)
</script>

<template>
  <div class="home">
    <header class="top">
      <h1>数学小伙伴</h1>
      <div class="stars">⭐ {{ w.stars }}</div>
    </header>

    <nav class="tabs">
      <button v-for="x in WORLDS" :key="x.id" :class="{ on: tab === x.id, locked: !open.includes(x.id) }" @click="tab = x.id">
        {{ open.includes(x.id) ? '' : '🔒' }}{{ x.name }}
      </button>
    </nav>

    <p v-if="!open.includes(tab)" class="locked">{{ WORLDS.find((x) => x.id === tab)!.locked }}</p>

    <section class="grid" :class="tab">
      <div v-for="c in list" :key="c.id" class="card">
        <Buddy :id="c.id" :world="c.world" :stage="stage(w, c.id)" :sleepy="sleepy(w, c, day)" />
        <div class="name">{{ stage(w, c.id) ? c.name : '还是一颗蛋' }}</div>
        <div class="sub">{{ c.skill }}</div>
        <div class="badge" :class="'s' + stage(w, c.id)">{{ STAGE_NAMES[stage(w, c.id)] }}</div>
      </div>
    </section>

    <footer class="go">
      <p v-if="w.placed && !done && tired" class="note">今天有 {{ tired }} 个小伙伴等你照顾</p>
      <button v-if="!w.placed" class="big" @click="emit('placement')">先玩一玩，看看你会哪些</button>
      <button v-else-if="!done" class="big" @click="emit('daily')">开始今天的练习</button>
      <template v-else>
        <p class="note">今天的练习做完了，小伙伴们去睡觉啦</p>
        <button v-if="canFree" class="big ghost" @click="emit('free')">再玩一会儿</button>
      </template>
    </footer>
  </div>
</template>

<style scoped>
.home { max-width: 960px; margin: 0 auto; padding: 12px 16px calc(16px + env(safe-area-inset-bottom)); min-height: 100vh; min-height: 100dvh; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; }
.top { display: flex; align-items: center; justify-content: space-between; }
h1 { margin: 0; font-size: 24px; }
.stars { background: #fff; border-radius: 16px; padding: 6px 14px; font-size: 20px; font-weight: 800; box-shadow: 0 3px 0 #c9d6e3; }
.tabs { display: flex; gap: 8px; }
.tabs button { flex: 1; min-height: 48px; border: none; border-radius: 16px; background: #ffffffaa; font-size: 17px; font-weight: 700; color: #2b3a4a; }
.tabs button.on { background: #fff; box-shadow: 0 3px 0 #c9d6e3; }
.tabs button.locked { color: #8a97a5; }
.locked { margin: 0; text-align: center; color: #6c7a89; }
.grid { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; align-content: start; }
@media (min-width: 700px) { .grid { grid-template-columns: repeat(5, 1fr); } }
.card { background: #fff; border-radius: 18px; padding: 8px 6px 10px; text-align: center; box-shadow: 0 3px 0 #c9d6e3; }
.name { font-size: 15px; font-weight: 700; margin-top: 2px; }
.sub { font-size: 12px; color: #6c7a89; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge { display: inline-block; margin-top: 4px; padding: 1px 10px; border-radius: 10px; font-size: 12px; background: #eef4fa; color: #6c7a89; }
.badge.s1 { background: #e3f2ff; color: #2f7fd1; }
.badge.s2 { background: #e5f6e7; color: #3e9a4b; }
.badge.s3 { background: #fff3c4; color: #b07d00; }
.go { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
.note { margin: 0; text-align: center; color: #2b3a4a; }
.big { min-height: 64px; border: none; border-radius: 22px; background: #ff9f43; color: #fff; font-size: 24px; font-weight: 800; box-shadow: 0 5px 0 #d97f26; }
.big.ghost { background: #4aa3ff; box-shadow: 0 5px 0 #2f7fd1; }
</style>
