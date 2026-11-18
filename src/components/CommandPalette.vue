<script setup>
// Ctrl K — pages you can open, plus clients, doctors, products and orders from GET /staff/search?q=.
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ui, t } from '../ui'

const router = useRouter()
const auth = useAuth()
const q = ref('')
const input = ref(null)
const idx = ref(0)
const found = ref([])
const KIND = { client: 'Client', doctor: 'Doctor', product: 'Product', order: 'Order' }

let timer
watch(q, (v) => {
  idx.value = 0
  clearTimeout(timer)
  if (v.trim().length < 2) { found.value = []; return }
  timer = setTimeout(async () => { found.value = (await api.get('/staff/search', { q: v.trim() }).catch(() => ({ data: [] }))).data }, 200)
})
const results = computed(() => [
  ...auth.pages.map((n) => ({ kind: 'Page', label: t(n), run: () => router.push('/' + n) })).filter((r) => r.label.toLowerCase().includes(q.value.toLowerCase())),
  ...found.value.map((r) => ({
    kind: KIND[r.type] ?? r.type, label: r.title, sub: r.subtitle,
    run: () => (r.type === 'client' ? (ui.drawerClient = r.id) : r.path && router.push(r.path.split('?')[0]).catch(() => {})),
  })),
].slice(0, 10))

watch(() => ui.palette, async (v) => { if (v) { q.value = ''; idx.value = 0; found.value = []; await nextTick(); input.value?.focus() } })
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
      <input ref="input" v-model="q" placeholder="Search clients, doctors, products, orders, pages…" @keydown="key" />
      <button v-for="(r, i) in results" :key="r.kind + r.label + i" :class="{ on: i === idx }" @click="go(r)" @mouseenter="idx = i">
        <span class="badge">{{ r.kind }}</span> {{ r.label }} <small v-if="r.sub">{{ r.sub }}</small>
      </button>
      <p v-if="!results.length" class="empty">{{ q.trim().length < 2 ? 'Type at least 2 letters' : 'No matches' }}</p>
    </div>
  </div>
</template>
