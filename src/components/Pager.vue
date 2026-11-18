<script setup>
// Page bar under a list: "Showing 31–60 of 245 · ‹ 1 2 [3] 4 … 9 ›".
// meta = the API's pagination meta { current_page, last_page, per_page, total } (or the same shape built
// in the page for lists that load everything). Emits `go` with the page number.
import { computed } from 'vue'

const props = defineProps({ meta: { type: Object, default: () => ({}) }, label: { type: String, default: '' } })
const emit = defineEmits(['go'])

const cur = computed(() => props.meta?.current_page ?? 1)
const last = computed(() => props.meta?.last_page ?? 1)
const total = computed(() => props.meta?.total ?? 0)
const per = computed(() => props.meta?.per_page ?? 0)
const from = computed(() => (total.value ? (cur.value - 1) * per.value + 1 : 0))
const to = computed(() => Math.min(total.value, cur.value * per.value))

// 1 … 4 5 [6] 7 8 … 20
const pages = computed(() => {
  const n = last.value
  const c = cur.value
  const set = new Set([1, n, c - 2, c - 1, c, c + 1, c + 2].filter((p) => p >= 1 && p <= n))
  const list = [...set].sort((a, b) => a - b)
  const out = []
  list.forEach((p, i) => {
    if (i && p - list[i - 1] > 1) out.push('…' + p)
    out.push(p)
  })
  return out
})
const go = (p) => {
  if (p >= 1 && p <= last.value && p !== cur.value) {
    emit('go', p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
</script>

<template>
  <div v-if="total > 0" class="pager">
    <span class="info">Showing <b>{{ from }}–{{ to }}</b> of <b>{{ total.toLocaleString() }}</b>{{ label ? ' ' + label : '' }}</span>
    <div v-if="last > 1" class="btns">
      <button type="button" :disabled="cur <= 1" aria-label="Previous page" @click="go(cur - 1)">‹ Prev</button>
      <template v-for="p in pages" :key="p">
        <span v-if="typeof p === 'string'" class="gap">…</span>
        <button v-else type="button" :class="{ on: p === cur }" @click="go(p)">{{ p }}</button>
      </template>
      <button type="button" :disabled="cur >= last" aria-label="Next page" @click="go(cur + 1)">Next ›</button>
    </div>
  </div>
</template>

<style scoped>
.pager { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 14px; font-size: 13px; color: var(--muted); }
.pager b { color: var(--ink); font-weight: 500; }
.btns { display: flex; gap: 4px; align-items: center; }
.btns button { min-width: 34px; height: 34px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--line); background: #fff; color: var(--ink); font-size: 13px; cursor: pointer; }
.btns button:hover:not(:disabled) { border-color: var(--dark); color: var(--teal-deep); }
.btns button.on { background: var(--dark); border-color: var(--dark); color: #fff; font-weight: 500; }
.btns button:disabled { opacity: .4; cursor: default; }
.gap { padding: 0 4px; }
</style>
