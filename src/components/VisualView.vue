<script setup lang="ts">
// 十格图、点子卡、分合图、数轴、小棒、看图列式的图。
import { computed } from 'vue'
import type { Visual } from '../lib/questions'

const props = defineProps<{ v: Visual }>()

const COLOR = { a: '#ff9f43', b: '#4aa3ff', x: '#ff9f43', '': 'none' } as const
const R = 15, G = 40

// 每个十格图 2 行 5 列；两个十格图左右并排
const frames = computed(() => {
  if (props.v.kind !== 'frames') return null
  return props.v.cells.map((c, i) => {
    const f = Math.floor(i / 10), k = i % 10
    return { c, x: 28 + f * 220 + (k % 5) * G, y: 24 + Math.floor(k / 5) * G, i }
  })
})
const frameCount = computed(() => (props.v.kind === 'frames' ? props.v.cells.length / 10 : 1))

const DICE: Record<number, [number, number][]> = {
  1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
}
const dice = computed(() => (props.v.kind === 'dice' ? DICE[props.v.n] ?? [] : []))
const bond = computed(() =>
  props.v.kind === 'bond'
    ? [{ x: 110, y: 38, n: props.v.whole }, { x: 55, y: 112, n: props.v.left }, { x: 165, y: 112, n: props.v.right }]
    : null,
)
const line = computed(() => (props.v.kind === 'line' ? props.v.nums : []))
const sticks = computed(() => (props.v.kind === 'sticks' ? props.v : null))
const pic = computed(() => (props.v.kind === 'picture' ? props.v : null))
const show = (x: number | null) => (x === null ? '?' : String(x))
</script>

<template>
  <svg v-if="frames" :viewBox="`0 0 ${frameCount * 220} 90`" class="vis">
    <g v-for="f in frameCount" :key="f">
      <rect :x="8 + (f - 1) * 220" y="4" width="200" height="80" rx="8" fill="#fff" stroke="#9fb3c8" stroke-width="2" />
      <line :x1="8 + (f - 1) * 220" y1="44" :x2="208 + (f - 1) * 220" y2="44" stroke="#9fb3c8" stroke-width="2" />
      <line v-for="k in 4" :key="k" :x1="8 + (f - 1) * 220 + k * G" y1="4" :x2="8 + (f - 1) * 220 + k * G" y2="84" stroke="#9fb3c8" stroke-width="2" />
    </g>
    <g v-for="d in frames" :key="d.i">
      <circle v-if="d.c" :cx="d.x" :cy="d.y" :r="R" :fill="COLOR[d.c]" :opacity="d.c === 'x' ? 0.35 : 1" />
      <path v-if="d.c === 'x'" :d="`M${d.x - 11} ${d.y - 11} L${d.x + 11} ${d.y + 11} M${d.x + 11} ${d.y - 11} L${d.x - 11} ${d.y + 11}`" stroke="#e74c3c" stroke-width="4" stroke-linecap="round" />
    </g>
  </svg>

  <svg v-else-if="v.kind === 'dice'" viewBox="0 0 130 130" class="vis vis-dice">
    <rect x="5" y="5" width="120" height="120" rx="20" fill="#fff" stroke="#9fb3c8" stroke-width="3" />
    <circle v-for="([cx, cy], i) in dice" :key="i" :cx="30 + cx * 35" :cy="30 + cy * 35" r="13" fill="#ff9f43" />
  </svg>

  <svg v-else-if="bond" viewBox="0 0 220 150" class="vis vis-bond">
    <line x1="110" y1="45" x2="55" y2="110" stroke="#9fb3c8" stroke-width="4" />
    <line x1="110" y1="45" x2="165" y2="110" stroke="#9fb3c8" stroke-width="4" />
    <g v-for="(c, i) in bond" :key="i">
      <circle :cx="c.x" :cy="c.y" r="30" :fill="c.n === null ? '#fff6d6' : '#fff'" :stroke="c.n === null ? '#f5b700' : '#9fb3c8'" stroke-width="4" />
      <text :x="c.x" :y="c.y + 12" text-anchor="middle" font-size="34" font-weight="700" :fill="c.n === null ? '#f5b700' : '#2b3a4a'">{{ show(c.n) }}</text>
    </g>
  </svg>

  <svg v-else-if="v.kind === 'line'" viewBox="0 0 320 90" class="vis">
    <line x1="10" y1="30" x2="310" y2="30" stroke="#2b3a4a" stroke-width="3" />
    <path d="M300 22 L312 30 L300 38" fill="none" stroke="#2b3a4a" stroke-width="3" />
    <g v-for="(x, i) in line" :key="i">
      <line :x1="40 + i * 60" y1="20" :x2="40 + i * 60" y2="40" stroke="#2b3a4a" stroke-width="3" />
      <rect v-if="x === null" :x="18 + i * 60" y="48" width="44" height="38" rx="8" fill="#fff6d6" stroke="#f5b700" stroke-width="3" />
      <text :x="40 + i * 60" y="78" text-anchor="middle" font-size="26" font-weight="700" :fill="x === null ? '#f5b700' : '#2b3a4a'">{{ show(x) }}</text>
    </g>
  </svg>

  <svg v-else-if="sticks" viewBox="0 0 280 120" class="vis">
    <g v-for="t in sticks.tens" :key="'t' + t" :transform="`translate(${10 + (t - 1) * 70} 10)`">
      <rect v-for="k in 10" :key="k" :x="(k - 1) * 5" y="0" width="4" height="100" rx="2" fill="#e0a458" />
      <rect x="-3" y="44" width="56" height="12" rx="4" fill="#c0392b" />
    </g>
    <rect v-for="k in sticks.ones" :key="'o' + k" :x="10 + sticks.tens * 70 + (k - 1) * 14" y="10" width="6" height="100" rx="3" fill="#e0a458" />
  </svg>

  <svg v-else-if="pic" viewBox="0 0 320 130" class="vis">
    <g v-for="k in pic.a" :key="'a' + k" :transform="`translate(${20 + ((k - 1) % 5) * 30} ${20 + Math.floor((k - 1) / 5) * 34})`">
      <circle r="12" fill="#ff6b6b" :opacity="pic.op === '-' && k > pic.a - pic.b ? 0.3 : 1" />
      <path d="M0 -12 q4 -8 9 -6" stroke="#3e9a4b" stroke-width="3" fill="none" />
      <path v-if="pic.op === '-' && k > pic.a - pic.b" d="M-10 -10 L10 10 M10 -10 L-10 10" stroke="#2b3a4a" stroke-width="3" />
    </g>
    <template v-if="pic.op === '+'">
      <text x="186" y="60" font-size="30" fill="#8a97a5">→</text>
      <g v-for="k in pic.b" :key="'b' + k" :transform="`translate(${236 + ((k - 1) % 3) * 30} ${20 + Math.floor((k - 1) / 3) * 34})`">
        <circle r="12" fill="#ff6b6b" />
        <path d="M0 -12 q4 -8 9 -6" stroke="#3e9a4b" stroke-width="3" fill="none" />
      </g>
    </template>
  </svg>
</template>

<style scoped>
.vis { width: 100%; max-width: 440px; height: auto; display: block; margin: 0 auto; }
.vis-dice, .vis-bond { max-width: 220px; }
</style>
