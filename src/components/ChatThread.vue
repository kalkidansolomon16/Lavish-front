<script setup>
// A conversation's messages — GET /conversations/{id}/messages (newest first, 30 per call),
// polling ?after_id= every 4 s while open, POST to send (text and/or files), POST …/read to clear the badge.
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { api } from '../api/http'
import { when } from '../fmt'

const props = defineProps({ id: Number, placeholder: String, showNames: Boolean, locked: Boolean, quick: { type: Array, default: () => [] } })
const emit = defineEmits(['sent'])
const msgs = ref([])
const text = ref('')
const files = ref([])
const busy = ref(false)
const older = ref(true)
const scroller = ref(null)
let timer

const bottom = () => nextTick(() => scroller.value && (scroller.value.scrollTop = scroller.value.scrollHeight))
async function load() {
  clearInterval(timer)
  msgs.value = []
  older.value = true
  if (!props.id) return
  const res = await api.get(`/conversations/${props.id}/messages`).catch(() => ({ data: [] }))
  msgs.value = [...res.data].reverse()
  older.value = res.data.length >= 30
  bottom()
  api.post(`/conversations/${props.id}/read`).catch(() => {})
  timer = setInterval(poll, 4000)
}
async function poll() {
  const last = msgs.value.at(-1)?.id
  const res = await api.get(`/conversations/${props.id}/messages`, last ? { after_id: last } : {}, { background: true }).catch(() => null)
  if (res?.data?.length) {
    const seen = new Set(msgs.value.map((m) => m.id))
    msgs.value.push(...[...res.data].reverse().filter((m) => !seen.has(m.id)))
    bottom()
    api.post(`/conversations/${props.id}/read`).catch(() => {})
  }
}
async function loadOlder() {
  const first = msgs.value[0]?.id
  const res = await api.get(`/conversations/${props.id}/messages`, { before_id: first }).catch(() => ({ data: [] }))
  msgs.value.unshift(...[...res.data].reverse())
  older.value = res.data.length >= 30
}
async function send() {
  const body = text.value.trim()
  if ((!body && !files.value.length) || busy.value) return
  busy.value = true
  try {
    let payload = { body }
    if (files.value.length) {
      payload = new FormData()
      if (body) payload.append('body', body)
      files.value.forEach((f) => payload.append('files[]', f))
    }
    const m = (await api.post(`/conversations/${props.id}/messages`, payload)).data
    msgs.value.push(m)
    text.value = ''
    files.value = []
    bottom()
    emit('sent', m)
  } finally {
    busy.value = false
  }
}
watch(() => props.id, load, { immediate: true })
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div ref="scroller" class="c-msgs">
    <button v-if="older && msgs.length" class="btn ghost sm" style="align-self: center" @click="loadOlder">Load earlier messages</button>
    <div v-for="m in msgs" :key="m.id" class="msg" :class="{ mine: m.mine }">
      <div class="bub">
        <b v-if="showNames && !m.mine" class="from">{{ m.sender?.name }}</b>
        <span style="white-space: pre-line">{{ m.body }}</span>
        <template v-for="a in m.attachments" :key="a.url">
          <a :href="a.url" target="_blank" rel="noopener"><img v-if="a.is_image" :src="a.url" :alt="a.name" style="display: block; max-width: 220px; border-radius: 10px; margin-top: 6px" /><span v-else style="display: block; margin-top: 6px">📎 {{ a.name }}</span></a>
        </template>
        <small>{{ when(m.created_at) }}</small>
      </div>
    </div>
    <p v-if="!msgs.length" class="empty">{{ locked ? 'This chat opens after the client’s first completed treatment.' : 'No messages yet — say hello 👋' }}</p>
  </div>
  <div v-if="!locked && quick.length" class="quick"><button v-for="q in quick" :key="q" type="button" @click="text = q">{{ q }}</button></div>
  <form v-if="!locked" class="c-compose" @submit.prevent="send">
    <label class="btn ghost sm" style="cursor: pointer" title="Attach photo or PDF">📎<input type="file" multiple accept="image/*,application/pdf" style="display: none" @change="files = [...$event.target.files]" /></label>
    <input v-model="text" :placeholder="files.length ? `${files.length} file(s) attached — add a message…` : placeholder" />
    <button class="round" title="Send" :disabled="busy">➤</button>
  </form>
</template>
