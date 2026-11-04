<script setup>
// Lavish Team: staff announcements, groups created by the CEO / GM, and direct messages between staff.
import { ref, computed, watch, nextTick } from 'vue'
import { state, actions, can, ROLES, people, personName, meKey, dmKey } from '../store'
import { pushNotif } from '../ui'

const me = meKey()
const canAnnounce = can('team.announce')
const canGroups = can('team.groups')
const roleLabel = (r) => ROLES[r]?.label ?? r
const initials = (n) => n.replace('Dr. ', '').split(' ').map((w) => w[0]).join('').slice(0, 2)
const others = computed(() => people().filter((p) => p.key !== me))

// You see a group if you're in it; people who manage groups see all of them.
const myGroups = computed(() => state.groups.filter((g) => g.members.includes(me) || canGroups))
const visibleAnn = computed(() => state.announcements.filter((a) =>
  a.audience === 'all' || canGroups || state.groups.find((g) => g.id === a.audience)?.members.includes(me)))
const unreadAnn = computed(() => visibleAnn.value.filter((a) => !a.readBy.includes(me)).length)
const dmThreads = computed(() => Object.keys(state.dms).filter((k) => k.split('|').includes(me))
  .map((k) => ({ key: k, with: k.split('|').find((x) => x !== me) })))
const groupName = (id) => state.groups.find((g) => g.id === id)?.name ?? 'a group'

// sel = { kind: 'ann' } | { kind: 'group', id } | { kind: 'dm', with }
const sel = ref({ kind: 'ann' })
const group = computed(() => sel.value.kind === 'group' ? state.groups.find((g) => g.id === sel.value.id) : null)
const msgs = computed(() => {
  if (group.value) return group.value.messages
  if (sel.value.kind === 'dm') return state.dms[dmKey(me, sel.value.with)] ?? []
  return []
})
const isOn = (s) => s.kind === sel.value.kind && s.id === sel.value.id && s.with === sel.value.with

watch(sel, (s) => { if (s.kind === 'ann') visibleAnn.value.forEach((a) => a.readBy.includes(me) || a.readBy.push(me)) }, { immediate: true })

const scroller = ref(null)
watch(() => [sel.value, msgs.value.length], () => nextTick(() => scroller.value && (scroller.value.scrollTop = scroller.value.scrollHeight)), { flush: 'post' })

const text = ref('')
function send() {
  const t = text.value.trim()
  if (!t) return
  if (group.value) actions.sendGroupMessage(group.value, t)
  else actions.sendDirect(sel.value.with, t)
  text.value = ''
}

// New direct message
const picking = ref(false)
const pickWho = ref('')
function startDm() {
  if (!pickWho.value) return
  sel.value = { kind: 'dm', with: pickWho.value }
  picking.value = false
  pickWho.value = ''
}

// Announcements
const annOpen = ref(false)
const af = ref({ title: '', body: '', audience: 'all' })
const rolesOf = (keys) => [...new Set(people().filter((p) => keys.includes(p.key)).map((p) => (p.role === 'doctor' ? ['doctor', 'teacher'] : [p.role])).flat())]
function postAnn() {
  if (!af.value.title.trim()) return
  const audience = af.value.audience === 'all' ? 'all' : +af.value.audience
  actions.postAnnouncement({ ...af.value, title: af.value.title.trim(), audience })
  const roles = audience === 'all' ? Object.keys(ROLES) : rolesOf(state.groups.find((g) => g.id === audience).members)
  pushNotif(`📣 ${af.value.title.trim()} — from ${state.user.name}`, roles, '/team')
  af.value = { title: '', body: '', audience: 'all' }
  annOpen.value = false
}

// Groups: create + manage members
const groupForm = ref(null) // { id?, name, about, members: [] }
const byRole = computed(() => {
  const out = {}
  others.value.forEach((p) => (out[p.role] ??= []).push(p))
  return out
})
const newGroup = () => (groupForm.value = { name: '', about: '', members: [] })
const editGroup = (g) => (groupForm.value = { id: g.id, name: g.name, about: g.about, members: g.members.filter((k) => k !== me) })
const toggleAll = (list, on) => {
  const keys = list.map((p) => p.key)
  groupForm.value.members = on ? [...new Set([...groupForm.value.members, ...keys])] : groupForm.value.members.filter((k) => !keys.includes(k))
}
function saveGroup() {
  const f = groupForm.value
  if (!f.name.trim()) return
  if (f.id) {
    const g = state.groups.find((x) => x.id === f.id)
    g.name = f.name.trim(); g.about = f.about
    actions.setGroupMembers(g, [...(g.members.includes(me) ? [me] : []), ...f.members])
  } else {
    const g = actions.createGroup({ name: f.name.trim(), about: f.about, members: f.members })
    if (g) {
      pushNotif(`You were added to the group “${g.name}”`, rolesOf(g.members), '/team')
      sel.value = { kind: 'group', id: g.id }
    }
  }
  groupForm.value = null
}
function removeGroup(g) {
  actions.deleteGroup(g)
  groupForm.value = null
  sel.value = { kind: 'ann' }
}
</script>

<template>
  <div class="head">
    <div>
      <h1>Lavish Team</h1>
      <p>Internal space for staff: announcements from management, team groups and direct messages between colleagues.</p>
    </div>
  </div>

  <div class="chat2">
    <aside class="c-list">
      <button :class="{ on: sel.kind === 'ann' }" @click="sel = { kind: 'ann' }">
        <span class="av">📣</span>
        <span class="who"><b>Announcements</b><small>{{ visibleAnn[0]?.title ?? 'Nothing yet' }}</small></span>
        <span class="meta"><span v-if="unreadAnn" class="count">{{ unreadAnn }}</span></span>
      </button>

      <div class="t-sec"><span>Groups</span><button v-if="canGroups" class="btn ghost sm" @click="newGroup">+ New group</button></div>
      <button v-for="g in myGroups" :key="g.id" :class="{ on: isOn({ kind: 'group', id: g.id }) }" @click="sel = { kind: 'group', id: g.id }">
        <span class="av grp">#</span>
        <span class="who"><b>{{ g.name }}</b><small>{{ g.messages.at(-1) ? personName(g.messages.at(-1).from).split(' ')[0] + ': ' + g.messages.at(-1).text : g.members.length + ' members' }}</small></span>
        <span class="meta"><small>{{ g.messages.at(-1)?.time }}</small></span>
      </button>
      <p v-if="!myGroups.length" class="empty">You’re not in any group yet</p>

      <div class="t-sec"><span>Direct messages</span><button class="btn ghost sm" @click="picking = true">+ New</button></div>
      <button v-for="t in dmThreads" :key="t.key" :class="{ on: isOn({ kind: 'dm', with: t.with }) }" @click="sel = { kind: 'dm', with: t.with }">
        <span class="av">{{ initials(personName(t.with)) }}<i></i></span>
        <span class="who"><b>{{ personName(t.with) }}</b><small>{{ state.dms[t.key].at(-1)?.text }}</small></span>
        <span class="meta"><small>{{ state.dms[t.key].at(-1)?.time }}</small></span>
      </button>
    </aside>

    <!-- announcements -->
    <section v-if="sel.kind === 'ann'" class="c-pane">
      <header class="c-head">
        <span class="av lg">📣</span>
        <div><b class="serif">Announcements</b><small>From the CEO, General Manager and other leads</small></div>
        <button v-if="canAnnounce" class="btn gold sm" style="margin-left: auto" @click="annOpen = true">+ New announcement</button>
      </header>
      <div class="c-msgs" style="gap: 12px">
        <div v-for="a in visibleAnn" :key="a.id" class="card ann">
          <div class="row" style="justify-content: space-between">
            <span class="badge" :class="a.audience === 'all' ? 'active' : 'pending'">{{ a.audience === 'all' ? 'All staff' : '# ' + groupName(a.audience) }}</span>
            <small class="note">{{ a.date }}</small>
          </div>
          <h3 class="serif" style="font-size: 21px; margin-top: 8px">{{ a.title }}</h3>
          <p style="margin: 6px 0 10px; line-height: 1.55">{{ a.body }}</p>
          <div class="row" style="justify-content: space-between">
            <small class="note">— {{ personName(a.by) }} · seen by {{ a.readBy.length }}</small>
            <button v-if="canAnnounce" class="btn danger sm" @click="actions.deleteAnnouncement(a)">Delete</button>
          </div>
        </div>
        <p v-if="!visibleAnn.length" class="empty">No announcements yet</p>
      </div>
    </section>

    <!-- group or direct chat -->
    <section v-else class="c-pane">
      <header class="c-head">
        <template v-if="group">
          <span class="av lg grp">#</span>
          <div><b class="serif">{{ group.name }}</b><small>{{ group.members.length }} members · {{ group.about }}</small></div>
          <button class="btn ghost sm" style="margin-left: auto" @click="editGroup(group)">{{ canGroups ? 'Manage members' : 'Members' }}</button>
        </template>
        <template v-else>
          <span class="av lg">{{ initials(personName(sel.with)) }}<i></i></span>
          <div><b class="serif">{{ personName(sel.with) }}</b><small>{{ people().find((p) => p.key === sel.with)?.title }}</small></div>
        </template>
      </header>
      <div ref="scroller" class="c-msgs">
        <div v-for="(m, i) in msgs" :key="i" class="msg" :class="{ mine: m.from === me }">
          <div class="bub">
            <b v-if="group && m.from !== me" class="from">{{ personName(m.from) }}</b>
            {{ m.text }}<small>{{ m.time }}</small>
          </div>
        </div>
        <p v-if="!msgs.length" class="empty">No messages yet — say hello 👋</p>
      </div>
      <form class="c-compose" @submit.prevent="send">
        <input v-model="text" :placeholder="group ? 'Message # ' + group.name + '…' : 'Message ' + personName(sel.with).split(' ')[0] + '…'" />
        <button class="round" title="Send">➤</button>
      </form>
    </section>
  </div>

  <!-- new direct message -->
  <div v-if="picking" class="modal-bg" @click.self="picking = false">
    <form class="modal" @submit.prevent="startDm">
      <h2>New message</h2>
      <label>To</label>
      <select v-model="pickWho" required>
        <option value="" disabled>Choose a colleague…</option>
        <option v-for="p in others" :key="p.key" :value="p.key">{{ p.name }} — {{ p.title }}</option>
      </select>
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button type="button" class="btn ghost" @click="picking = false">Cancel</button>
        <button class="btn gold">Start chat</button>
      </div>
    </form>
  </div>

  <!-- new announcement -->
  <div v-if="annOpen" class="modal-bg" @click.self="annOpen = false">
    <form class="modal" @submit.prevent="postAnn">
      <h2>New announcement</h2>
      <label>Send to</label>
      <select v-model="af.audience">
        <option value="all">All staff</option>
        <option v-for="g in state.groups" :key="g.id" :value="g.id"># {{ g.name }} ({{ g.members.length }})</option>
      </select>
      <label>Title</label><input v-model="af.title" required placeholder="e.g. Staff meeting on Friday" />
      <label>Message</label><textarea v-model="af.body" rows="4" placeholder="What does the team need to know?"></textarea>
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button type="button" class="btn ghost" @click="annOpen = false">Cancel</button>
        <button class="btn gold">Send announcement</button>
      </div>
    </form>
  </div>

  <!-- create / manage group -->
  <div v-if="groupForm" class="modal-bg" @click.self="groupForm = null">
    <form class="modal" style="width: min(620px, 95vw); max-height: 90vh; overflow: auto" @submit.prevent="saveGroup">
      <h2>{{ groupForm.id ? (canGroups ? 'Manage group' : 'Group members') : 'New group' }}</h2>
      <template v-if="canGroups">
        <label>Group name</label><input v-model="groupForm.name" required placeholder="e.g. Adama team" />
        <label>What is it for?</label><input v-model="groupForm.about" placeholder="e.g. Daily coordination at Adama" />
      </template>
      <label>Members <small class="note">· only members can open this group in Lavish Team</small></label>
      <div v-for="(list, role) in byRole" :key="role" class="t-role">
        <div class="row" style="justify-content: space-between">
          <b>{{ role === 'doctor' ? 'Doctors' : roleLabel(role) }}</b>
          <span v-if="canGroups" class="row">
            <a class="link" @click="toggleAll(list, true)">all</a><a class="link" @click="toggleAll(list, false)">none</a>
          </span>
        </div>
        <label v-for="p in list" :key="p.key" class="t-person">
          <input v-model="groupForm.members" type="checkbox" :value="p.key" :disabled="!canGroups" />
          {{ p.name }} <small class="note">{{ p.title }}</small>
        </label>
      </div>
      <p class="note" style="margin-top: 10px">{{ groupForm.members.length + 1 }} members including you.</p>
      <div class="row" style="margin-top: 18px; justify-content: space-between">
        <button v-if="groupForm.id && canGroups" type="button" class="btn danger" @click="removeGroup(state.groups.find((g) => g.id === groupForm.id))">Delete group</button>
        <span v-else></span>
        <div class="row">
          <button type="button" class="btn ghost" @click="groupForm = null">{{ canGroups ? 'Cancel' : 'Close' }}</button>
          <button v-if="canGroups" class="btn gold">{{ groupForm.id ? 'Save' : 'Create group' }}</button>
        </div>
      </div>
    </form>
  </div>
</template>
