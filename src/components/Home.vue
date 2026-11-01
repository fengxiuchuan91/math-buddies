<script setup lang="ts">
import { computed, ref } from 'vue'
import { COMPANIONS, type Companion, type World } from '../lib/facts'
import { DECOR_COUNT, DECOR_EVERY, STAGE_NAMES, dailyDone, decorUnlocked, openWorlds, sleepy, stage, type WorldState } from '../lib/world'
import { PHRASES } from '../lib/phrases'
import type { Settings } from '../settings'
import { speak, unlockAudio } from '../voice'
import { ART } from '../art'
import Buddy from './Buddy.vue'

const props = defineProps<{ w: WorldState; day: number; settings: Settings; canChallenge: boolean; isWechat: boolean }>()
const emit = defineEmits<{
  placement: []; daily: []; free: []; challenge: []; parent: []; record: []; patch: [p: Partial<Settings>]
}>()

const WORLDS: { id: World; name: string; locked: string }[] = [
  { id: 'dino', name: '恐龙岛', locked: '' },
  { id: 'park', name: '动物乐园', locked: '' },
  { id: 'site', name: '工地', locked: '「凑十龙」和「小松鼠」长大后开放' },
]
const tab = ref<World>('dino')
const open = computed(() => openWorlds(props.w))
const list = computed(() => COMPANIONS.filter((c) => c.world === tab.value))
const done = computed(() => dailyDone(props.w, props.day))
const canFree = computed(() => props.settings.freeMinutes > 0 && [...props.w.facts.values()].some((s) => s.box >= 3))
const tired = computed(() => COMPANIONS.filter((c) => sleepy(props.w, c, props.day)).length)
const title = computed(() => (props.settings.childName ? `${props.settings.childName}的数学岛` : '数学小伙伴'))
const decor = computed(() => decorUnlocked(props.w))
const toNext = computed(() => (decor.value < DECOR_COUNT ? (decor.value + 1) * DECOR_EVERY - props.w.stars : 0))
const bg = computed(() => ART[`bg-${tab.value}`])

/** 孩子认字少：点一下小伙伴就读出它的名字 */
function tap(c: Companion) {
  unlockAudio()
  speak(stage(props.w, c.id) ? `${c.name}，${c.skill}` : PHRASES.egg)
}

function toRecord() {
  emit('patch', { recordTipDismissed: true })
  emit('record')
}
</script>

<template>
  <div class="home">
    <header class="top">
      <h1>{{ title }}</h1>
      <div class="stars">⭐ {{ w.stars }}</div>
      <button class="lock" aria-label="家长" @click="emit('parent')">🔒</button>
    </header>

    <div v-if="isWechat && !settings.browserTipDismissed" class="tip">
      进度和录音存在当前浏览器里。建议点右上角「…」选「在浏览器打开」，再加到主屏幕，以后都从那里打开。
      <button @click="emit('patch', { browserTipDismissed: true })">知道了</button>
    </div>
    <div v-else-if="!settings.recordTipDismissed" class="tip">
      家长先录几句话，题目就用你的声音读给孩子听。
      <button @click="toRecord">去录音</button>
      <button class="plain" @click="emit('patch', { recordTipDismissed: true })">以后再说</button>
    </div>

    <nav class="tabs">
      <button v-for="x in WORLDS" :key="x.id" :class="{ on: tab === x.id, locked: !open.includes(x.id) }" @click="tab = x.id">
        {{ open.includes(x.id) ? '' : '🔒' }}{{ x.name }}
      </button>
    </nav>

    <p v-if="!open.includes(tab)" class="locked">{{ WORLDS.find((x) => x.id === tab)!.locked }}</p>

    <section class="grid" :style="bg ? { backgroundImage: `url(${bg})` } : undefined">
      <button v-for="c in list" :key="c.id" class="card" @click="tap(c)">
        <Buddy :id="c.id" :world="c.world" :stage="stage(w, c.id)" :sleepy="sleepy(w, c, day)" />
        <div class="name">{{ stage(w, c.id) ? c.name : '还是一颗蛋' }}</div>
        <div class="sub">{{ c.skill }}</div>
        <div class="badge" :class="'s' + stage(w, c.id)">{{ STAGE_NAMES[stage(w, c.id)] }}</div>
      </button>
    </section>

    <section class="decor" aria-label="岛上的装饰">
      <div v-for="i in DECOR_COUNT" :key="i" class="slot" :class="{ got: i <= decor }">
        <img v-if="i <= decor && ART[`decor-${i}`]" :src="ART[`decor-${i}`]" alt="" />
        <span v-else-if="i <= decor">🎁</span>
      </div>
      <p v-if="toNext" class="decor-note">再攒 {{ toNext }} 颗星，岛上多一样东西</p>
    </section>

    <footer class="go">
      <p v-if="w.placed && !done && tired" class="note">今天有 {{ tired }} 个小伙伴等你照顾</p>
      <button v-if="!w.placed" class="big" @click="emit('placement')">先玩一玩，看看你会哪些</button>
      <button v-else-if="!done" class="big" @click="emit('daily')">开始今天的练习</button>
      <template v-else>
        <p class="note">今天的练习做完了，小伙伴们去睡觉啦</p>
        <button v-if="canFree" class="big ghost" @click="emit('free')">再玩一会儿</button>
      </template>
      <button v-if="canChallenge" class="big gold" @click="emit('challenge')">⚡ 本周口算挑战</button>
    </footer>
  </div>
</template>

<style scoped>
.home { max-width: 960px; margin: 0 auto; padding: 12px 16px calc(16px + env(safe-area-inset-bottom)); min-height: 100vh; min-height: 100dvh; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; }
.top { display: flex; align-items: center; gap: 10px; }
h1 { margin: 0; font-size: 24px; flex: 1; }
.stars { background: #fff; border-radius: 16px; padding: 6px 14px; font-size: 20px; font-weight: 800; box-shadow: 0 3px 0 #c9d6e3; }
.lock { width: 44px; height: 44px; border: none; border-radius: 14px; background: #ffffffaa; font-size: 18px; }
.tip { background: #fff8e1; border-radius: 16px; padding: 10px 12px; font-size: 14px; line-height: 1.5; }
.tip button { margin: 6px 8px 0 0; min-height: 36px; padding: 0 14px; border: none; border-radius: 12px; background: #ff9f43; color: #fff; font-weight: 700; }
.tip button.plain { background: #eef4fa; color: #6c7a89; }
.tabs { display: flex; gap: 8px; }
.tabs button { flex: 1; min-height: 48px; border: none; border-radius: 16px; background: #ffffffaa; font-size: 17px; font-weight: 700; color: #2b3a4a; }
.tabs button.on { background: #fff; box-shadow: 0 3px 0 #c9d6e3; }
.tabs button.locked { color: #8a97a5; }
.locked { margin: 0; text-align: center; color: #6c7a89; }
.grid { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; align-content: start; border-radius: 20px; background-size: cover; background-position: center; }
@media (min-width: 700px) { .grid { grid-template-columns: repeat(5, 1fr); } }
.card { border: none; font: inherit; color: inherit; background: #ffffffe6; border-radius: 18px; padding: 8px 6px 10px; text-align: center; box-shadow: 0 3px 0 #c9d6e3; }
.name { font-size: 15px; font-weight: 700; margin-top: 2px; }
.sub { font-size: 12px; color: #6c7a89; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge { display: inline-block; margin-top: 4px; padding: 1px 10px; border-radius: 10px; font-size: 12px; background: #eef4fa; color: #6c7a89; }
.badge.s1 { background: #e3f2ff; color: #2f7fd1; }
.badge.s2 { background: #e5f6e7; color: #3e9a4b; }
.badge.s3 { background: #fff3c4; color: #b07d00; }
.decor { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.slot { width: 36px; height: 36px; border-radius: 10px; background: #ffffff80; border: 2px dashed #c9d6e3; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.slot.got { background: #fff; border-style: solid; }
.slot img { width: 100%; height: 100%; object-fit: contain; }
.decor-note { width: 100%; margin: 0; text-align: center; font-size: 13px; color: #6c7a89; }
.go { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
.note { margin: 0; text-align: center; color: #2b3a4a; }
.big { min-height: 64px; border: none; border-radius: 22px; background: #ff9f43; color: #fff; font-size: 24px; font-weight: 800; box-shadow: 0 5px 0 #d97f26; }
.big.ghost { background: #4aa3ff; box-shadow: 0 5px 0 #2f7fd1; }
.big.gold { background: #ffd23f; color: #6b4a00; box-shadow: 0 5px 0 #e0a800; }
</style>
