<script setup lang="ts">
// 加减法表：每格一个事实，按格子上色。格子小，只显示颜色，点一下看算式。
import { computed, ref } from 'vue'
import type { WorldState } from '../../lib/world'
import { GRIDS, LEVELS, boxLevel, factText } from '../../lib/report'

const props = defineProps<{ w: WorldState }>()

const key = ref(GRIDS[0].key)
const grid = computed(() => GRIDS.find((g) => g.key === key.value)!)
const picked = ref<string | null>(null)
const color = (id: string) => LEVELS.find((l) => l.level === boxLevel(props.w, id))!.color

const detail = computed(() => {
  const id = picked.value
  if (!id) return '点一格看算式'
  const s = props.w.facts.get(id)
  if (!s?.introduced) return `${factText(id)}：还没教`
  return `${factText(id)}：格子 ${s.box}，答过 ${s.attempts} 次，错 ${s.wrong} 次，慢 ${s.slow} 次`
})

function pick(k: string) {
  key.value = k
  picked.value = null
}
</script>

<template>
  <section class="block">
    <nav class="sub">
      <button v-for="g in GRIDS" :key="g.key" :class="{ on: key === g.key }" @click="pick(g.key)">{{ g.title }}</button>
    </nav>
    <table class="grid">
      <thead>
        <tr>
          <th>{{ key === 'add' ? '+' : '−' }}</th>
          <th v-for="c in grid.cols" :key="c">{{ c }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in grid.rows" :key="r">
          <th>{{ r }}</th>
          <td v-for="(id, j) in grid.cells[i]" :key="j">
            <button
              v-if="id"
              class="cell"
              :class="{ on: picked === id }"
              :style="{ background: color(id) }"
              :aria-label="factText(id)"
              @click="picked = id"
            />
          </td>
        </tr>
      </tbody>
    </table>
    <p class="detail">{{ detail }}</p>
    <div class="legend">
      <span v-for="l in LEVELS" :key="l.level"><i :style="{ background: l.color }" />{{ l.name }}</span>
    </div>
  </section>
</template>

<style scoped>
.block { background: #fff; border-radius: 18px; padding: 12px 10px; box-shadow: 0 3px 0 #c9d6e3; }
.sub { display: flex; gap: 6px; margin-bottom: 10px; }
.sub button { flex: 1; min-height: 44px; border: none; border-radius: 12px; background: #eef4fa; font-size: 15px; font-weight: 700; color: #2b3a4a; }
.sub button.on { background: #4aa3ff; color: #fff; }
.grid { width: 100%; border-collapse: separate; border-spacing: 2px; table-layout: fixed; }
th { font-size: 11px; color: #6c7a89; font-weight: 700; padding: 0; height: 18px; }
td { padding: 0; }
.cell { display: block; width: 100%; aspect-ratio: 1; min-height: 18px; border: none; border-radius: 4px; padding: 0; }
.cell.on { outline: 3px solid #2b3a4a; outline-offset: -1px; }
.detail { margin: 10px 0 6px; min-height: 22px; font-size: 15px; text-align: center; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 12px; justify-content: center; font-size: 12px; color: #6c7a89; }
.legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
</style>
