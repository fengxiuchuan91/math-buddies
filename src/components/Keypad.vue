<script setup lang="ts">
// 大号数字键盘。每个键不小于 64px。
defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ digit: [d: string]; back: []; ok: [] }>()
const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
</script>

<template>
  <div class="keypad" :class="{ disabled }">
    <button v-for="k in keys" :key="k" class="key" @click="emit('digit', k)">{{ k }}</button>
    <button class="key key-back" aria-label="退格" @click="emit('back')">⌫</button>
    <button class="key" @click="emit('digit', '0')">0</button>
    <button class="key key-ok" aria-label="确定" @click="emit('ok')">✓</button>
  </div>
</template>

<style scoped>
.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
}
.keypad.disabled { opacity: 0.4; pointer-events: none; }
.key {
  min-height: 64px;
  border: none;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 4px 0 #c9d6e3;
  font-size: 30px;
  font-weight: 700;
  color: #2b3a4a;
}
.key:active { transform: translateY(3px); box-shadow: 0 1px 0 #c9d6e3; }
.key-back { color: #8a97a5; }
.key-ok { background: #5cc46a; color: #fff; box-shadow: 0 4px 0 #3e9a4b; }
</style>
