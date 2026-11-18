<script setup>
// Lavish Team: staff announcements, groups created by the CEO / GM, and direct messages between staff.
// GET /staff/team/{people,announcements,groups} · direct chats are conversations of type "direct".
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { when } from '../fmt'
import ChatThread from '../components/ChatThread.vue'

const auth = useAuth()
const canAnnounce = computed(() => auth.can('team.announce'))
const canGroups = computed(() => auth.can('team.groups'))
const ROLE = { ceo: 'CEO', gm: 'General Manager', reception: 'Reception', ecommerce: 'E-commerce', doctor: 'Doctors', nurse: 'Nurses', teacher: 'Lavish Academy' }
const initials = (n) => (n ?? '').replace('Dr. ', '').split(' ').map((w) => w[0]).join('').slice(0, 2)

const people = ref([])
const anns = ref([])
const groups = ref([])
const dms = ref([])
const error = ref('')
const others = computed(() => people.value.filter((p) => p.id !== auth.user?.id))
const byRole = computed(() => { const out = {}; others.value.forEach((p) => (out[p.role] ??= []).push(p)); return out })
const unreadAnn = computed(() => anns.value.filter((a) => !a.read).length)

async function load() {
  try {
    const [p, a, g, d] = await Promise.all([
      api.get('/staff/team/people'), api.get('/staff/team/announcements', { per_page: 50 }),
      api.get('/staff/team/groups'), api.get('/conversations', { type: 'direct' }),
    ])
    people.value = p.data; anns.value = a.data; groups.value = g.data; dms.value = d.data
  } catch (e) {
    error.value = e.message
  }
}
onMounted(load)

// sel = { kind: 'ann' } | { kind: 'conv', c }
const sel = ref({ kind: 'ann' })
const conv = computed(() => (sel.value.kind === 'conv' ? sel.value.c : null))
function openAnn() {
  sel.value = { kind: 'ann' }
  anns.value.filter((a) => !a.read).forEach((a) => { a.read = true; api.post(`/staff/team/announcements/${a.id}/read`).catch(() => {}) })
}
function openConv(c) { c.unread = 0; sel.value = { kind: 'conv', c } }
const isMember = (g) => g.members?.some((m) => m.id === auth.user?.id)
const onSent = (m) => { if (conv.value) conv.value.last_message = { body: m.body, mine: true, created_at: m.created_at } }

// New direct message
const picking = ref(false)
const pickWho = ref('')
async function startDm() {
  if (!pickWho.value) return
  try {
    const c = (await api.post(`/staff/team/direct/${pickWho.value}`)).data
    if (!dms.value.find((x) => x.id === c.id)) dms.value.unshift(c)
    openConv(dms.value.find((x) => x.id === c.id))
    picking.value = false
    pickWho.value = ''
  } catch (e) {
    notify(e.message)
  }
}

// Announcements
const annForm = ref(null)
async function postAnn() {
  const f = annForm.value
  if (!f.title.trim() || !f.body.trim()) return
  const to = f.group_id ? '# ' + groups.value.find((g) => g.id === f.group_id)?.title : 'all staff'
  if (!(await ask({ title: 'Post this announcement?', body: `“${f.title.trim()}” to ${to}.\nEveryone in the audience is notified.`, ok: 'Post' }))) return
  try {
    anns.value.unshift((await api.post('/staff/team/announcements', { title: f.title.trim(), body: f.body, group_id: f.group_id || null })).data)
    annForm.value = null
  } catch (e) {
    notify(e.message)
  }
}
async function removeAnn(a) {
  if (!(await ask({ title: 'Delete this announcement?', body: `“${a.title}” will be removed for everyone.`, ok: 'Delete', tone: 'danger' }))) return
  try {
    await api.delete(`/staff/team/announcements/${a.id}`)
    anns.value = anns.value.filter((x) => x.id !== a.id)
  } catch (e) {
    notify(e.message)
  }
}

// Groups
const groupForm = ref(null)
const newGroup = () => (groupForm.value = { name: '', about: '', members: [] })
const editGroup = (g) => (groupForm.value = { id: g.id, name: g.title, about: g.about ?? '', members: (g.members ?? []).map((m) => m.id).filter((id) => id !== auth.user?.id) })
const toggleAll = (list, on) => {
  const ids = list.map((p) => p.id)
  groupForm.value.members = on ? [...new Set([...groupForm.value.members, ...ids])] : groupForm.value.members.filter((k) => !ids.includes(k))
}
async function saveGroup() {
  const f = groupForm.value
  if (!f.name.trim() || !f.members.length) return
  if (!(await ask({ title: f.id ? 'Save group changes?' : 'Create this group?', body: `${f.name.trim()} · ${f.members.length + 1} members including you`, ok: f.id ? 'Save' : 'Create group' }))) return
  try {
    const body = { name: f.name.trim(), about: f.about || null, member_ids: [...new Set([auth.user.id, ...f.members])] }
    const g = (f.id ? await api.patch(`/staff/team/groups/${f.id}`, body) : await api.post('/staff/team/groups', body)).data
    groups.value = f.id ? groups.value.map((x) => (x.id === g.id ? { ...x, ...g } : x)) : [...groups.value, g]
    groupForm.value = null
    openConv(groups.value.find((x) => x.id === g.id))
  } catch (e) {
    notify(e.message)
  }
}
async function removeGroup(id) {
  const g = groups.value.find((x) => x.id === id)
  if (!(await ask({ title: `Delete “${g.title}”?`, body: 'The group and its messages are removed for everyone.', ok: 'Delete group', tone: 'danger' }))) return
  try {
    await api.delete(`/staff/team/groups/${id}`)
    groups.value = groups.value.filter((x) => x.id !== id)
    groupForm.value = null
    openAnn()
  } catch (e) {
    notify(e.message)
  }
}
const personTitle = (c) => people.value.find((p) => c.members?.some((m) => m.id === p.id && p.id !== auth.user?.id))?.title
</script>

<template>
  <div class="head">
    <div>
      <h1>Lavish Team</h1>
      <p>Internal space for staff: announcements from management, team groups and direct messages between colleagues.</p>
    </div>
  </div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>

  <div class="chat2">
    <aside class="c-list">
      <button :class="{ on: sel.kind === 'ann' }" @click="openAnn">
        <span class="av">📣</span>
        <span class="who"><b>Announcements</b><small>{{ anns[0]?.title ?? 'Nothing yet' }}</small></span>
        <span class="meta"><span v-if="unreadAnn" class="count">{{ unreadAnn }}</span></span>
      </button>

      <div class="t-sec"><span>Groups</span><button v-if="canGroups" class="btn ghost sm" @click="newGroup">+ New group</button></div>
      <button v-for="g in groups" :key="g.id" :class="{ on: conv?.id === g.id }" @click="openConv(g)">
        <span class="av grp">#</span>
        <span class="who"><b>{{ g.title }}</b><small>{{ g.last_message ? (g.last_message.mine ? 'You: ' : '') + g.last_message.body : (g.members?.length ?? 0) + ' members' }}</small></span>
        <span class="meta"><span v-if="g.unread" class="count">{{ g.unread }}</span></span>
      </button>
      <p v-if="!groups.length" class="empty">{{ canGroups ? 'No groups yet' : 'You’re not in any group yet' }}</p>

      <div class="t-sec"><span>Direct messages</span><button class="btn ghost sm" @click="picking = true">+ New</button></div>
      <button v-for="c in dms" :key="c.id" :class="{ on: conv?.id === c.id }" @click="openConv(c)">
        <span class="av">{{ initials(c.title) }}<i></i></span>
        <span class="who"><b>{{ c.title }}</b><small>{{ c.last_message ? (c.last_message.mine ? 'You: ' : '') + c.last_message.body : '' }}</small></span>
        <span class="meta"><span v-if="c.unread" class="count">{{ c.unread }}</span></span>
      </button>
    </aside>

    <section v-if="sel.kind === 'ann'" class="c-pane">
      <header class="c-head">
        <span class="av lg">📣</span>
        <div><b class="serif">Announcements</b><small>From the CEO, General Manager and other leads</small></div>
        <button v-if="canAnnounce" class="btn gold sm" style="margin-left: auto" @click="annForm = { title: '', body: '', group_id: null }">+ New announcement</button>
      </header>
      <div class="c-msgs" style="gap: 12px">
        <div v-for="a in anns" :key="a.id" class="card ann">
          <div class="row" style="justify-content: space-between">
            <span class="badge" :class="a.audience === 'all' ? 'active' : 'pending'">{{ a.audience === 'all' ? 'All staff' : '# ' + a.group?.name }}</span>
            <small class="note">{{ when(a.created_at) }}</small>
          </div>
          <h3 class="serif" style="font-size: 21px; margin-top: 8px">{{ a.title }}</h3>
          <p style="margin: 6px 0 10px; line-height: 1.55; white-space: pre-line">{{ a.body }}</p>
          <div class="row" style="justify-content: space-between">
            <small class="note">— {{ a.author?.name }} · seen by {{ a.read_count }}</small>
            <button v-if="canAnnounce" class="btn danger sm" @click="removeAnn(a)">Delete</button>
          </div>
        </div>
        <p v-if="!anns.length" class="empty">No announcements yet</p>
      </div>
    </section>

    <section v-else class="c-pane">
      <header class="c-head">
        <template v-if="conv.type === 'group'">
          <span class="av lg grp">#</span>
          <div><b class="serif">{{ conv.title }}</b><small>{{ conv.members?.length }} members<template v-if="conv.about"> · {{ conv.about }}</template></small></div>
          <button class="btn ghost sm" style="margin-left: auto" @click="editGroup(conv)">{{ canGroups ? 'Manage members' : 'Members' }}</button>
        </template>
        <template v-else>
          <span class="av lg">{{ initials(conv.title) }}<i></i></span>
          <div><b class="serif">{{ conv.title }}</b><small>{{ personTitle(conv) }}</small></div>
        </template>
      </header>
      <ChatThread v-if="conv.type !== 'group' || isMember(conv)" :id="conv.id" :show-names="conv.type === 'group'" :placeholder="conv.type === 'group' ? 'Message # ' + conv.title + '…' : 'Message ' + (conv.title ?? '').split(' ')[0] + '…'" @sent="onSent" />
      <p v-else class="empty">You manage this group but aren’t a member — add yourself to read and post.</p>
    </section>
  </div>

  <div v-if="picking" class="modal-bg" @click.self="picking = false">
    <form class="modal" @submit.prevent="startDm">
      <h2>New message</h2>
      <label>To</label>
      <select v-model="pickWho" required>
        <option value="" disabled>Choose a colleague…</option>
        <option v-for="p in others" :key="p.id" :value="p.id">{{ p.name }} — {{ p.title ?? ROLE[p.role] }}</option>
      </select>
      <p v-if="!others.length" class="note">No other staff accounts yet — add them in Staff.</p>
      <div class="row" style="margin-top: 18px; justify-content: flex-end"><button type="button" class="btn ghost" @click="picking = false">Cancel</button><button class="btn gold">Start chat</button></div>
    </form>
  </div>

  <div v-if="annForm" class="modal-bg" @click.self="annForm = null">
    <form class="modal" @submit.prevent="postAnn">
      <h2>New announcement</h2>
      <label>Send to</label>
      <select v-model="annForm.group_id"><option :value="null">All staff</option><option v-for="g in groups" :key="g.id" :value="g.id"># {{ g.title }} ({{ g.members?.length }})</option></select>
      <label>Title</label><input v-model="annForm.title" required placeholder="e.g. Staff meeting on Friday" />
      <label>Message</label><textarea v-model="annForm.body" rows="4" required placeholder="What does the team need to know?"></textarea>
      <div class="row" style="margin-top: 18px; justify-content: flex-end"><button type="button" class="btn ghost" @click="annForm = null">Cancel</button><button class="btn gold">Send announcement</button></div>
    </form>
  </div>

  <div v-if="groupForm" class="modal-bg" @click.self="groupForm = null">
    <form class="modal" style="width: min(620px, 95vw); max-height: 90vh; overflow: auto" @submit.prevent="saveGroup">
      <h2>{{ groupForm.id ? (canGroups ? 'Manage group' : 'Group members') : 'New group' }}</h2>
      <template v-if="canGroups">
        <label>Group name</label><input v-model="groupForm.name" required placeholder="e.g. Adama team" />
        <label>What is it for?</label><input v-model="groupForm.about" placeholder="e.g. Daily coordination at Adama" />
      </template>
      <label>Members <small class="note">· only members can open this group</small></label>
      <div v-for="(list, role) in byRole" :key="role" class="t-role">
        <div class="row" style="justify-content: space-between">
          <b>{{ ROLE[role] ?? role }}</b>
          <span v-if="canGroups" class="row"><a class="link" @click="toggleAll(list, true)">all</a><a class="link" @click="toggleAll(list, false)">none</a></span>
        </div>
        <label v-for="p in list" :key="p.id" class="t-person"><input v-model="groupForm.members" type="checkbox" :value="p.id" :disabled="!canGroups" /> {{ p.name }} <small class="note">{{ p.title }}</small></label>
      </div>
      <p v-if="!others.length" class="note">No other staff accounts yet — add them in Staff.</p>
      <p class="note" style="margin-top: 10px">{{ groupForm.members.length + 1 }} members including you.</p>
      <div class="row" style="margin-top: 18px; justify-content: space-between">
        <button v-if="groupForm.id && canGroups" type="button" class="btn danger" @click="removeGroup(groupForm.id)">Delete group</button><span v-else></span>
        <div class="row"><button type="button" class="btn ghost" @click="groupForm = null">{{ canGroups ? 'Cancel' : 'Close' }}</button><button v-if="canGroups" class="btn gold">{{ groupForm.id ? 'Save' : 'Create group' }}</button></div>
      </div>
    </form>
  </div>
</template>
