<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { state, nav } from '../store'
import { ui, t } from '../ui'

const router = useRouter()
const q = ref('')
const input = ref(null)
const idx = ref(0)

const all = computed(() => [
  ...nav().map((n) => ({ kind: 'Page', label: t(n), run: () => router.push('/' + n) })),
  ...state.clients.map((c) => ({ kind: 'Client', label: c.name, sub: c.phone, run: () => (ui.drawerClient = c.id) })),
  ...state.doctors.map((d) => ({ kind: 'Doctor', label: d.name, sub: d.specialty, run: () => router.push('/staff').catch(() => {}) })),
  ...state.products.map((p) => ({ kind: 'Product', label: p.name, sub: p.category, run: () => router.push('/products').catch(() => {}) })),
])
const results = computed(() => all.value.filter((r) => r.label.toLowerCase().includes(q.value.toLowerCase())).slice(0, 8))

watch(() => ui.palette, async (v) => { if (v) { q.value = ''; idx.value = 0; await nextTick(); input.value?.focus() } })
watch(q, () => (idx.value = 0))
const go = (r) => { ui.palette = false; r?.run() }
const key = (e) => {
  if (e.key === 'ArrowDown') idx.value = Math.min(idx.value + 1, results.value.length - 1)
  else if (e.key === 'ArrowUp') idx.value = Math.max(idx.value - 1, 0)
  else if (e.key === 'Enter') go(results.value[idx.value])
  else if (e.key === 'Escape') ui.palette = false
}
</script>

<template>
  <div v-if="ui.palette" class="modal-bg palette-bg" @click.self="ui.palette = false">
    <div class="palette">
      <input ref="input" v-model="q" placeholder="Search clients, doctors, products, pages…" @keydown="key" />
      <button v-for="(r, i) in results" :key="r.kind + r.label" :class="{ on: i === idx }" @click="go(r)" @mouseenter="idx = i">
        <span class="badge">{{ r.kind }}</span> {{ r.label }} <small v-if="r.sub">{{ r.sub }}</small>
      </button>
      <p v-if="!results.length" class="empty">No matches</p>
    </div>
  </div>
</template>
