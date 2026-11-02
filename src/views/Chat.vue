<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { state, actions, notify } from '../store'
import { ui } from '../ui'

const router = useRouter()
const clients = computed(() => state.clients.filter((c) => c.doctorId === state.user.doctorId && c.treated))
const sel = ref(clients.value[0]?.id)
const current = computed(() => state.clients.find((c) => c.id === sel.value))
const text = ref('')
const typing = ref(false)
const scroller = ref(null)
const search = ref('')

const msgs = computed(() => state.chats[sel.value] ?? [])
const list = computed(() => clients.value.filter((c) => c.name.toLowerCase().includes(search.value.toLowerCase())))
const lastMsg = (id) => state.chats[id]?.at(-1)
const initials = (n) => n.split(' ').map((w) => w[0]).join('')
const unread = (id) => lastMsg(id)?.from === 'client' && id !== sel.value

const quick = [
  'Please send me a photo of the area.',
  'Mild redness is normal for 48 hours. Apply the recovery balm.',
  'Let’s book a follow-up session this week.',
  'Avoid direct sun and use SPF 50 daily.',
]

const toBottom = () => nextTick(() => scroller.value && (scroller.value.scrollTop = scroller.value.scrollHeight))
watch([sel, () => msgs.value.length, typing], toBottom, { flush: 'post' })

function send(msg = text.value) {
  const m = msg.trim()
  if (!m) return
  const id = sel.value
  actions.sendChat(id, m)
  text.value = ''
  typing.value = true
  setTimeout(() => {
    state.chats[id].push({ from: 'client', text: 'Thank you, Doctor! 🙏', time: 'now' })
    typing.value = false
  }, 2000)
}
const prescribe = () => router.push({ path: '/prescriptions', query: { client: sel.value } })
</script>

<template>
  <div class="head">
    <div>
      <h1>Client chat</h1>
      <p>Clients can message you from anywhere once their first treatment is complete.</p>
    </div>
  </div>

  <div class="chat2">
    <aside class="c-list">
      <div class="c-search"><input v-model="search" placeholder="Search patients…" /></div>
      <button v-for="c in list" :key="c.id" :class="{ on: sel === c.id }" @click="sel = c.id">
        <span class="av">{{ initials(c.name) }}<i></i></span>
        <span class="who">
          <b>{{ c.name }}</b>
          <small :class="{ strong: unread(c.id) }">{{ lastMsg(c.id)?.text ?? 'No messages yet' }}</small>
        </span>
        <span class="meta">
          <small>{{ lastMsg(c.id)?.time }}</small>
          <em v-if="unread(c.id)"></em>
        </span>
      </button>
      <p v-if="!list.length" class="empty">No patients found</p>
    </aside>

    <section v-if="current" class="c-pane">
      <header class="c-head">
        <span class="av lg">{{ initials(current.name) }}<i></i></span>
        <div>
          <b class="serif">{{ current.name }}</b>
          <small>Online · last treatment: {{ current.lastTreatment }}</small>
        </div>
        <div class="row" style="margin-left: auto">
          <button class="btn ghost sm" @click="ui.drawerClient = current.id">Profile</button>
          <button class="btn gold sm" @click="prescribe">+ Prescribe</button>
        </div>
      </header>

      <div ref="scroller" class="c-msgs">
        <span class="day">Today</span>
        <div v-for="(m, i) in msgs" :key="i" class="msg" :class="m.from">
          <div class="bub">{{ m.text }}<small>{{ m.time }}<span v-if="m.from === 'doctor'"> ✓✓</span></small></div>
        </div>
        <div v-if="typing" class="msg client"><div class="bub typing"><span></span><span></span><span></span></div></div>
        <p v-if="!msgs.length" class="empty">Say hello to {{ current.name.split(' ')[0] }} 👋</p>
      </div>

      <div class="c-quick">
        <button v-for="q in quick" :key="q" @click="send(q)">{{ q }}</button>
      </div>
      <form class="c-compose" @submit.prevent="send()">
        <button type="button" class="round ghost" title="Attach" @click="notify('Photo attachments are sent from the mobile app')">📎</button>
        <input v-model="text" placeholder="Type a message…" />
        <button class="round" title="Send">➤</button>
      </form>
    </section>
  </div>
</template>
