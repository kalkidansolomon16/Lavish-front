<script setup>
// Complaints — GET /staff/complaints (open first, then by priority). Replies reach the client in the app.
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { when } from '../fmt'
import ClientLink from '../components/ClientLink.vue'
import Pager from '../components/Pager.vue'

const auth = useAuth()
const canReply = computed(() => auth.can('complaints.reply'))
const canResolve = computed(() => auth.can('complaints.resolve'))
const canManage = computed(() => canReply.value || canResolve.value)
const rows = ref([])
const tab = ref('open,in_review')
const error = ref('')
const replies = ref({})
const STATUS = { open: 'Open', in_review: 'In review', resolved: 'Resolved' }

async function load() {
  try {
    const res = await api.get('/staff/complaints', { status: tab.value || undefined, page: page.value, per_page: 20 })
    rows.value = res.data
    meta.value = res.meta
  } catch (e) {
    error.value = e.message
  }
}
watch(tab, load)
onMounted(load)
const replace = (c) => (rows.value = rows.value.map((x) => (x.id === c.id ? c : x)))

async function reply(c, status = null) {
  const body = (replies.value[c.id] ?? '').trim()
  if (!body) return
  if (!(await ask({ title: status === 'resolved' ? 'Reply and resolve?' : 'Send this reply?', body: `To ${c.client?.name} about “${c.subject}”:\n\n${body}`, ok: status === 'resolved' ? 'Send & resolve' : 'Send reply' }))) return
  try {
    replace((await api.post(`/staff/complaints/${c.id}/reply`, { body, status })).data)
    replies.value[c.id] = ''
    notify('Reply sent — the client was notified')
  } catch (e) {
    notify(e.message)
  }
}
async function setStatus(c, status) {
  const resolving = status === 'resolved'
  if (!(await ask({ title: resolving ? 'Resolve this complaint?' : 'Mark as in review?', body: `“${c.subject}”${resolving ? '\nThe client can then rate how it was handled.' : ''}`, ok: resolving ? 'Resolve' : 'Mark in review' }))) return
  try {
    replace((await api.post(`/staff/complaints/${c.id}/status`, { status })).data)
  } catch (e) {
    notify(e.message)
  }
}
const page = ref(1)
const meta = ref({})
watch(tab, () => (page.value = 1), { flush: 'sync' })
</script>

<template>
  <div class="head">
    <div>
      <h1>Complaints</h1>
      <p>Submitted by clients from the mobile app. Replies and status changes reach the client in the app.</p>
    </div>
  </div>
  <div class="tabs"><button v-for="[k, l] in [['open,in_review', 'Open'], ['resolved', 'Resolved'], ['', 'All']]" :key="k" :class="{ on: tab === k }" @click="tab = k">{{ l }}</button></div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>

  <div class="grid">
    <div v-for="c in rows" :key="c.id" class="card">
      <div class="row" style="justify-content: space-between">
        <h2>{{ c.subject }}</h2>
        <div class="row">
          <span class="badge">{{ c.category }}</span>
          <span class="badge" :class="c.priority">{{ c.priority }} priority</span>
          <span class="badge" :class="c.status === 'in_review' ? 'in-review' : c.status">{{ STATUS[c.status] }}</span>
        </div>
      </div>
      <p class="note"><ClientLink :id="c.client?.id" :name="c.client?.name" /> · {{ c.client?.phone }} · {{ when(c.created_at) }}<template v-if="c.reference"> · {{ c.reference }}</template></p>
      <p style="margin: 10px 0; white-space: pre-line">{{ c.message }}</p>
      <div v-if="c.attachments?.length" class="row" style="gap: 8px; margin-bottom: 10px">
        <a v-for="a in c.attachments" :key="a.url" :href="a.url" target="_blank" rel="noopener"><img v-if="a.is_image" :src="a.url" :alt="a.name" style="width: 90px; height: 90px; object-fit: cover; border-radius: 10px" /><span v-else class="link">📎 {{ a.name }}</span></a>
      </div>
      <div v-if="c.messages?.length" class="thread">
        <div v-for="m in c.messages" :key="m.id" class="msg" :class="{ staff: m.from_staff }"><b>{{ m.author }}</b><small>{{ when(m.created_at) }}</small><p>{{ m.body }}</p></div>
      </div>
      <p v-if="c.feedback" class="note">Client rated the handling {{ '★'.repeat(c.feedback.rating) }}{{ c.feedback.comment ? ' — “' + c.feedback.comment + '”' : '' }}</p>
      <template v-if="canManage && c.status !== 'resolved'">
        <template v-if="canReply">
          <label>Reply to client</label>
          <textarea v-model="replies[c.id]" rows="2" placeholder="Write a reply…"></textarea>
        </template>
        <div class="row" style="margin-top: 10px">
          <button v-if="canReply" class="btn gold sm" :disabled="!replies[c.id]?.trim()" @click="reply(c)">Send reply</button>
          <button v-if="canReply && canResolve" class="btn ghost sm" :disabled="!replies[c.id]?.trim()" @click="reply(c, 'resolved')">Reply & resolve</button>
          <button v-if="canResolve" class="btn ghost sm" :disabled="c.status === 'in_review'" @click="setStatus(c, 'in_review')">Mark in review</button>
          <button v-if="canResolve" class="btn ghost sm" @click="setStatus(c, 'resolved')">Resolve</button>
        </div>
      </template>
      <button v-else-if="canResolve" class="btn ghost sm" @click="setStatus(c, 'open')">Reopen</button>
    </div>
    <p v-if="!rows.length" class="empty card">No complaints here.</p>
    <Pager :meta="meta" label="complaints" @go="(n) => { page = n; load() }" />
  </div>
</template>

<style scoped>
label { display: block; font-size: 13px; margin: 10px 0 4px; }
textarea { width: 100%; }
.thread { display: grid; gap: 8px; margin: 8px 0 12px; }
.msg { padding: 10px 12px; border-radius: 12px; background: #f6f5f4; max-width: 85%; }
.msg.staff { background: #e8f3f2; margin-left: auto; }
.msg b { font-weight: 500; font-size: 13px; }
.msg small { color: var(--muted); font-size: 11.5px; margin-left: 6px; }
.msg p { margin: 4px 0 0; font-size: 14px; }
</style>
