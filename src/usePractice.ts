// 一次练习的流程：热身 → 逐题（先教、作答、答错讲解、自己改对）→ 完成。

import { computed, onUnmounted, ref } from 'vue'
import { fact as factOf } from './lib/facts'
import { newId, type AnswerEvent, type MbEvent, type QType } from './lib/events'
import { QTYPE_HINT, isRight, makeQuestion, type Question } from './lib/questions'
import { explain, say, type Step } from './lib/explain'
import { insertRetry, MAX_RETRIES, type Item } from './lib/session'
import { isFluent, type Baseline } from './lib/fluency'
import { placementBoxes, shouldSkip, type PlacementGroup, type PlacementResult } from './lib/placement'
import { pick, type Rng } from './lib/rng'
import { speak, stopSpeaking } from './voice'
import type { Run, RunResult } from './run'
import { PHRASES, PRAISE } from './lib/phrases'

export type Phase = 'warmup' | 'teach' | 'ask' | 'ok' | 'oops' | 'explain' | 'fix' | 'end'
type NoId<T> = T extends unknown ? Omit<T, 'id' | 't'> : never

export const FREE_LIMIT_MS = 10 * 60_000

export function usePractice(
  run: Run,
  baseline: () => Baseline,
  record: (e: MbEvent) => void,
  done: (r: RunResult) => void,
) {
  const rng: Rng = Math.random
  const placing = run.mode === 'placement'
  const queue = ref<Item[]>(
    placing ? run.placement!.map((p): Item => ({ fact: p.fact, qtype: p.qtype, role: 'due', teach: false, scaffold: false })) : [...run.items],
  )

  const phase = ref<Phase>(run.warmups.length ? 'warmup' : 'ask')
  const pos = ref(0)
  const wpos = ref(0)
  const q = ref<Question | null>(null)
  const steps = ref<Step[]>([])
  const step = ref(0)
  const flashOn = ref(false)
  const listened = ref(false)
  const shake = ref(0)
  const praise = ref('')

  const startedAt = Date.now()
  let shownAt = 0
  let answered = 0
  let correct = 0
  const touched = new Set<string>()
  const hinted = new Set<QType>()
  const retries = new Map<string, number>()
  const scaffolded = new Set<string>()
  const wrongByGroup: Partial<Record<PlacementGroup, number>> = {}
  const placementResults: PlacementResult[] = []

  const item = computed(() => queue.value[pos.value])
  const warmTarget = computed(() => run.warmups[wpos.value])
  const total = computed(() => queue.value.length)
  const hint = computed(() => (q.value && item.value?.scaffold ? explain(q.value.fact)[0] : null))

  const ev = <T extends MbEvent>(e: NoId<T>): T => ({ ...e, id: newId(), t: Date.now() }) as unknown as T

  function start() {
    record(ev({ kind: 'session_start', session: run.session, mode: run.mode }))
    if (run.warmups.length) startWarmup()
    else show()
  }

  // —— 热身：照着按数字，定熟练线 ——
  function startWarmup() {
    phase.value = 'warmup'
    shownAt = 0
    speak(PHRASES.warmup, () => { shownAt = performance.now() })
  }

  /** 热身和正式题一样：输完按确定，用时算到按确定 */
  function warmSubmit(value: string) {
    if (!shownAt) return
    if (value !== String(warmTarget.value)) { shake.value++; return }
    const ms = Math.round(performance.now() - shownAt)
    record(ev({ kind: 'baseline', digits: value.length >= 2 ? 2 : 1, ms }))
    wpos.value++
    if (wpos.value >= run.warmups.length) { show(); return }
    shownAt = performance.now()
  }

  // —— 出题 ——
  function show() {
    if (run.mode === 'free' && Date.now() - startedAt > (run.freeLimitMs ?? FREE_LIMIT_MS)) { finish(true); return }
    // 摸底不插再问，队列与摸底题一一对应
    while (placing && pos.value < queue.value.length && shouldSkip(run.placement![pos.value], wrongByGroup)) {
      pos.value++
    }
    const it = item.value
    if (!it) { finish(true); return }
    q.value = makeQuestion(it.fact, it.qtype, rng)
    touched.add(factOf(it.fact).companion)
    if (it.teach) {
      steps.value = explain(it.fact)
      step.value = 0
      phase.value = 'teach'
      speak(PHRASES.teachIntro + say(steps.value[0].text))
      return
    }
    ask()
  }

  function ask() {
    const cur = q.value!
    const at = pos.value
    phase.value = 'ask'
    listened.value = false
    shownAt = performance.now()
    const restart = () => { if (phase.value === 'ask' && pos.value === at) shownAt = performance.now() }
    // 看图列式必须读题；其余题型只在当天第一次出现时读提示语，算式默认不读
    if (cur.qtype === 'picture') speak(cur.speech, restart)
    else if (!hinted.has(cur.qtype)) { hinted.add(cur.qtype); speak(QTYPE_HINT[cur.qtype], restart) }
    flashOn.value = !!cur.flashMs
    if (cur.flashMs) setTimeout(() => { if (pos.value === at) flashOn.value = false }, cur.flashMs)
  }

  /** 点喇叭重听：用时从读完算起 */
  function listen() {
    if (!q.value || (phase.value !== 'ask' && phase.value !== 'fix')) return
    const at = pos.value
    listened.value = true
    speak(q.value.speech, () => { if (pos.value === at) shownAt = performance.now() })
  }

  function teachNext() {
    if (step.value < steps.value.length - 1) {
      step.value++
      speak(say(steps.value[step.value].text))
    } else {
      stopSpeaking()
      ask()
    }
  }

  // —— 作答 ——
  function submit(given: string) {
    if (phase.value === 'fix') { fixSubmit(given); return }
    if (phase.value !== 'ask' || !q.value) return
    const cur = q.value
    const it = item.value
    const ok = isRight(cur, given)
    const e = ev<AnswerEvent>({
      kind: 'answer', session: run.session, fact: cur.fact, qtype: cur.qtype, mode: run.mode,
      correct: ok, ms: Math.round(performance.now() - shownAt), expected: cur.answer,
      given: /^\d+$/.test(given) ? Number(given) : given, listened: listened.value, retry: it.role === 'retry',
    })
    record(e)
    answered++
    if (ok) correct++
    stopSpeaking()

    if (placing) {
      placementResults.push({ fact: cur.fact, correct: ok, fluent: isFluent(e, baseline()) })
      const g = run.placement![pos.value].group
      if (!ok) wrongByGroup[g] = (wrongByGroup[g] ?? 0) + 1
      phase.value = ok ? 'ok' : 'oops'
      praise.value = ok ? pick(rng, PRAISE) : PHRASES.placementWrong
      setTimeout(next, ok ? 700 : 1000)
      return
    }

    if (ok) {
      phase.value = 'ok'
      praise.value = pick(rng, PRAISE)
      setTimeout(next, 700)
      return
    }

    // 答错：讲一遍，自己改对，隔 2~4 题再问
    const n = (retries.get(cur.fact) ?? 0) + 1
    retries.set(cur.fact, n)
    if (it.role === 'retry') scaffolded.add(cur.fact)
    if (n <= MAX_RETRIES) {
      const retry = { ...it, scaffold: scaffolded.has(cur.fact) }
      queue.value = insertRetry(queue.value, pos.value, retry, rng)
    }
    steps.value = explain(cur.fact)
    step.value = 0
    phase.value = 'explain'
    speak(PHRASES.explainIntro + say(steps.value[0].text))
  }

  function explainNext() {
    if (step.value < steps.value.length - 1) {
      step.value++
      speak(say(steps.value[step.value].text))
      return
    }
    phase.value = 'fix'
    speak(PHRASES.fixPrompt)
  }

  /** 讲完自己改对才往下走；这一下不记分 */
  function fixSubmit(given: string) {
    if (!q.value) return
    if (!isRight(q.value, given)) { shake.value++; return }
    stopSpeaking()
    phase.value = 'ok'
    praise.value = PHRASES.fixOk
    setTimeout(next, 800)
  }

  function next() {
    if (phase.value === 'end') return
    pos.value++
    show()
  }

  function finish(completed: boolean) {
    if (phase.value === 'end') return
    phase.value = 'end'
    stopSpeaking()
    record(ev({ kind: 'session_end', session: run.session, mode: run.mode, completed }))
    if (placing && completed) record(ev({ kind: 'placement', boxes: placementBoxes(placementResults) }))
    done({ mode: run.mode, answered, correct, ms: Date.now() - startedAt, companions: [...touched], completed })
  }

  onUnmounted(stopSpeaking)

  return {
    phase, pos, total, item, q, steps, step, flashOn, shake, praise, hint, warmTarget, wpos,
    start, warmSubmit, listen, teachNext, submit, explainNext, finish,
  }
}
