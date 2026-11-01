<script setup lang="ts">
// 导出、恢复备份。数据只在这台手机的这个浏览器里，换手机、换浏览器就靠它。
import { ref } from 'vue'
import type { MbEvent } from '../../lib/events'
import { backupFileName, browserCodec, buildBackup, parseBackup } from '../../lib/backup'
import { listClips, putClip, saveEvents } from '../../store'
import type { Settings } from '../../settings'

const props = defineProps<{ events: MbEvent[]; settings: Settings }>()
const emit = defineEmits<{ settings: [s: Settings]; restored: [] }>()

const msg = ref('')
const busy = ref(false)
const file = ref<HTMLInputElement | null>(null)

async function exportBackup() {
  busy.value = true
  msg.value = ''
  try {
    const data = await buildBackup(props.events, props.settings, await listClips(), Date.now(), browserCodec)
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = backupFileName(Date.now())
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    msg.value = `已导出 ${data.events.length} 条记录、${data.clips.length} 条录音。微信里下载不了时，请用手机自带浏览器打开再导出。`
  } catch (e) {
    msg.value = `导出失败：${(e as Error).message}`
  } finally {
    busy.value = false
  }
}

async function importBackup(ev: Event) {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  busy.value = true
  msg.value = ''
  try {
    const b = parseBackup(await f.text(), browserCodec)
    // 事件按编号写入，已有的覆盖成同样内容，等于去重合并
    await saveEvents(b.events)
    for (const c of b.clips) await putClip(c)
    emit('settings', b.settings)
    emit('restored')
    msg.value = `已恢复 ${b.events.length} 条记录、${b.clips.length} 条录音`
  } catch (e) {
    msg.value = `恢复失败：${(e as Error).message}`
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="block">
    <h2>备份</h2>
    <p class="hint">进度和录音只存在这台手机的这个浏览器里。换手机、换浏览器前先导出，到新地方再恢复。</p>
    <div class="btns">
      <button :disabled="busy" @click="exportBackup">导出备份</button>
      <button :disabled="busy" class="ghost" @click="file?.click()">恢复备份</button>
    </div>
    <input ref="file" type="file" accept="application/json,.json" class="file" @change="importBackup" />
    <p v-if="msg" class="msg" role="status">{{ msg }}</p>
  </section>
</template>

<style scoped>
.block { background: #fff; border-radius: 18px; padding: 12px 14px; box-shadow: 0 3px 0 #c9d6e3; }
h2 { margin: 0 0 6px; font-size: 17px; }
.hint { margin: 0 0 10px; font-size: 13px; line-height: 1.5; color: #6c7a89; }
.btns { display: flex; gap: 10px; }
.btns button { flex: 1; min-height: 48px; border: none; border-radius: 14px; background: #5cc46a; color: #fff; font-size: 16px; font-weight: 700; box-shadow: 0 4px 0 #3e9a4b; }
.btns button.ghost { background: #eef4fa; color: #2b3a4a; box-shadow: 0 4px 0 #c9d6e3; }
.btns button:disabled { opacity: 0.5; }
.file { display: none; }
.msg { margin: 10px 0 0; font-size: 14px; line-height: 1.5; }
</style>
