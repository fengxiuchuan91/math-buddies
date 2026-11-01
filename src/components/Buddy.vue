<script setup lang="ts">
// 小伙伴。有画就用画，没有就用代码画的占位图。
import { computed } from 'vue'
import type { World } from '../lib/facts'
import type { Stage } from '../lib/world'
import { ART } from '../art'

const props = defineProps<{ id: string; world: World; stage: Stage; label?: string; sleepy?: boolean; happy?: boolean }>()

const art = computed(() => (props.stage === 0 ? ART[`egg-${props.world}`] : ART[`${props.id}-${props.stage}`]))

// 同一世界里每只换个颜色
const hue = computed(() => {
  let h = 0
  for (const ch of props.id) h = (h * 31 + ch.charCodeAt(0)) % 360
  return { park: 25, dino: 110, site: 45 }[props.world] + (h % 50) - 25
})
const body = computed(() => `hsl(${hue.value} 70% 62%)`)
const dark = computed(() => `hsl(${hue.value} 55% 38%)`)
const scale = computed(() => [1, 0.72, 0.88, 1][props.stage])
</script>

<template>
  <div class="buddy" :class="{ sleepy, happy }">
    <img v-if="art" :src="art" :alt="label" class="art" :style="{ transform: `scale(${scale})` }" />
    <svg v-else viewBox="0 0 120 120" class="art">
      <!-- 蛋 -->
      <g v-if="stage === 0">
        <ellipse cx="60" cy="66" rx="34" ry="44" :fill="{ park: '#ffe2c4', dino: '#dff5d0', site: '#fff1b8' }[world]" stroke="#b9a58a" stroke-width="3" />
        <circle cx="46" cy="52" r="7" :fill="dark" opacity="0.35" />
        <circle cx="72" cy="78" r="9" :fill="dark" opacity="0.35" />
        <circle cx="70" cy="44" r="4" :fill="dark" opacity="0.35" />
      </g>
      <g v-else :transform="`translate(60 64) scale(${scale}) translate(-60 -64)`">
        <!-- 工程车 -->
        <g v-if="world === 'site'">
          <rect x="14" y="44" width="70" height="40" rx="8" :fill="body" :stroke="dark" stroke-width="3" />
          <rect x="70" y="28" width="34" height="56" rx="8" :fill="body" :stroke="dark" stroke-width="3" />
          <rect x="78" y="36" width="18" height="16" rx="3" fill="#dff3ff" />
          <circle cx="34" cy="90" r="12" fill="#3a3a3a" /><circle cx="34" cy="90" r="5" fill="#bbb" />
          <circle cx="86" cy="90" r="12" fill="#3a3a3a" /><circle cx="86" cy="90" r="5" fill="#bbb" />
        </g>
        <!-- 恐龙 -->
        <g v-else-if="world === 'dino'">
          <path d="M26 86 Q8 70 22 58" :stroke="body" stroke-width="12" fill="none" stroke-linecap="round" />
          <path d="M44 20 l8 -10 l8 10 l8 -10 l8 10" :fill="dark" />
          <ellipse cx="60" cy="68" rx="34" ry="34" :fill="body" :stroke="dark" stroke-width="3" />
          <ellipse cx="60" cy="80" rx="20" ry="18" fill="#fff7dc" />
          <rect x="38" y="94" width="12" height="14" rx="5" :fill="body" /><rect x="70" y="94" width="12" height="14" rx="5" :fill="body" />
        </g>
        <!-- 小动物 -->
        <g v-else>
          <circle cx="36" cy="34" r="13" :fill="body" :stroke="dark" stroke-width="3" />
          <circle cx="84" cy="34" r="13" :fill="body" :stroke="dark" stroke-width="3" />
          <circle cx="60" cy="66" r="38" :fill="body" :stroke="dark" stroke-width="3" />
          <ellipse cx="60" cy="80" rx="18" ry="13" fill="#fff7dc" />
        </g>
        <!-- 脸 -->
        <g v-if="world !== 'site'">
          <template v-if="sleepy">
            <path d="M42 58 q6 4 12 0 M66 58 q6 4 12 0" stroke="#2b3a4a" stroke-width="3" fill="none" stroke-linecap="round" />
          </template>
          <template v-else>
            <circle cx="48" cy="56" r="6" fill="#2b3a4a" /><circle cx="72" cy="56" r="6" fill="#2b3a4a" />
            <circle cx="50" cy="54" r="2" fill="#fff" /><circle cx="74" cy="54" r="2" fill="#fff" />
          </template>
          <path d="M52 70 q8 7 16 0" stroke="#2b3a4a" stroke-width="3" fill="none" stroke-linecap="round" />
        </g>
        <!-- 进化：戴星星王冠 -->
        <path v-if="stage === 3" d="M40 22 l6 -14 l8 10 l6 -14 l6 14 l8 -10 l6 14 z" fill="#ffd23f" stroke="#e0a800" stroke-width="2" />
      </g>
      <text v-if="sleepy" x="96" y="26" font-size="16" font-weight="700" fill="#6c7a89">z z</text>
    </svg>
    <div v-if="label" class="label">{{ label }}</div>
  </div>
</template>

<style scoped>
.buddy { display: flex; flex-direction: column; align-items: center; }
.art { width: 100%; aspect-ratio: 1; object-fit: contain; }
.sleepy .art { filter: saturate(0.6); }
.happy .art { animation: hop 0.6s ease; }
@keyframes hop { 30% { transform: translateY(-14%); } 60% { transform: translateY(0); } 80% { transform: translateY(-4%); } }
.label { margin-top: 4px; font-size: 14px; color: #2b3a4a; text-align: center; line-height: 1.2; }
</style>
