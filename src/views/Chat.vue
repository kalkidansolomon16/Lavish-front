<script setup>
// Patient chat (doctors) — the doctor's client_doctor conversations. A chat opens after the client's
// first completed treatment with this doctor; messages reach the client's mobile app.
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/http'
import { ui } from '../ui'
import { when } from '../fmt'
import ChatThread from '../components/ChatThread.vue'

const router = useRouter()
const convs = ref([])
const sel = ref(null)
const search = ref('')
const error = ref('')
onMounted(async () => {
  try {
    convs.value = (await api.get('/conversations', { type: 'client_doctor' })).data
    sel.value = convs.value[0] ?? null
  } catch (e) {
    error.value = e.message
  }
})
const list = computed(() => convs.value.filter((c) => (c.client?.name ?? c.title ?? '').toLowerCase().includes(search.value.toLowerCase())))
const initials = (n) => (n ?? '').split(' ').map((w) => w[0]).join('').slice(0, 2)
const open = (c) => { c.unread = 0; sel.value = c }
const onSent = (m) => { sel.value.last_message = { body: m.body, mine: true, created_at: m.created_at } }
const quick = [
  'Please send me a photo of the area.',
  'Mild redness is normal for 48 hours. Apply the recovery balm.',
  'Let’s book a follow-up session this week.',
  'Avoid direct sun and use SPF 50 daily.',
]
const prescribe = () => router.push({ path: '/prescriptions', query: { client: sel.value.client?.id } })
</script>

<template>
  <div class="head">
    <div>
      <h1>Client chat</h1>
      <p>Chat with patients you have treated. Messages arrive in their Lavish app; photos they send appear here.</p>
    </div>
  </div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>

  <div class="chat2">
    <aside class="c-list">
      <div class="c-search"><input v-model="search" placeholder="Search patients…" /></div>
      <button v-for="c in list" :key="c.id" :class="{ on: sel?.id === c.id }" @click="open(c)">
        <span class="av">{{ initials(c.client?.name ?? c.title) }}<i></i></span>
        <span class="who"><b>{{ c.client?.name ?? c.title }}</b><small :class="{ strong: c.unread }">{{ c.last_message ? (c.last_message.mine ? 'You: ' : '') + c.last_message.body : 'No messages yet' }}</small></span>
        <span class="meta"><small v-if="c.last_message">{{ when(c.last_message.created_at) }}</small><span v-if="c.unread" class="count">{{ c.unread }}</span></span>
      </button>
      <p v-if="!list.length" class="empty">{{ convs.length ? 'No patients found' : 'No chats yet — a chat opens after you mark a patient’s first treatment as done.' }}</p>
    </aside>

    <section v-if="sel" class="c-pane">
      <header class="c-head">
        <span class="av lg">{{ initials(sel.client?.name ?? sel.title) }}<i></i></span>
        <div><b class="serif">{{ sel.client?.name ?? sel.title }}</b><small>Patient</small></div>
        <div class="row" style="margin-left: auto">
          <button v-if="sel.client" class="btn ghost sm" @click="ui.drawerClient = sel.client.id">Profile</button>
          <button v-if="sel.client" class="btn gold sm" @click="prescribe">+ Prescribe</button>
        </div>
      </header>
      <ChatThread :id="sel.id" :locked="sel.locked" :quick="quick" placeholder="Write a message…" @sent="onSent" />
    </section>
  </div>
</template>
