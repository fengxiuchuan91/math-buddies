<script setup lang="ts">
// 家长门槛：一道一年级孩子还不会的乘法题。
import { ref } from 'vue'
import Keypad from '../Keypad.vue'

const emit = defineEmits<{ pass: []; close: [] }>()

const r = () => 6 + Math.floor(Math.random() * 4)
const a = ref(r())
const b = ref(r())
const input = ref('')
const wrong = ref(false)

function digit(d: string) {
  if (input.value.length < 2) input.value += d
}
function ok() {
  if (!input.value) return
  if (Number(input.value) === a.value * b.value) { emit('pass'); return }
  // 答错换一道，免得孩子一个个试
  wrong.value = true
  a.value = r()
  b.value = r()
  input.value = ''
}
</script>

<template>
  <div class="gate">
    <header>
      <button class="back" @click="emit('close')">← 返回</button>
    </header>
    <p class="tip">家长请答题后进入</p>
    <div class="q">{{ a }} × {{ b }} = {{ input || '?' }}</div>
    <p class="wrong" :class="{ on: wrong }">不对，换了一道</p>
    <Keypad @digit="digit" @back="input = input.slice(0, -1)" @ok="ok" />
  </div>
</template>

<style scoped>
.gate { max-width: 480px; margin: 0 auto; padding: 12px 16px calc(16px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 14px; }
header { display: flex; }
.back { min-height: 44px; padding: 0 16px; border: none; border-radius: 14px; background: #fff; font-size: 16px; box-shadow: 0 3px 0 #c9d6e3; }
.tip { margin: 24px 0 0; text-align: center; color: #6c7a89; }
.q { text-align: center; font-size: 44px; font-weight: 800; }
.wrong { margin: 0; text-align: center; color: #e74c3c; visibility: hidden; }
.wrong.on { visibility: visible; }
</style>
