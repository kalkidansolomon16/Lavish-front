<script setup>
// Appointments — GET /staff/appointments (+ /classes for the doctors' academy classes on the same calendar).
// Approving checks the doctor's calendar on the server first (GET /appointments/{id}/check).
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { ui } from '../ui'
import { etb } from '../fmt'
import ClientLink from '../components/ClientLink.vue'
import WalkIn from '../components/WalkIn.vue'
import Pager from '../components/Pager.vue'

const auth = useAuth()
const canApprove = computed(() => auth.can('appointments.approve'))
const isDoctor = computed(() => !canApprove.value && !!auth.user?.doctor_id)
const walkIn = ref(false)
const view = ref('calendar')
const tab = ref('all')
const doctors = ref([])
const docFilter = ref(0)
const error = ref('')

// ---- calendar week (starts yesterday so today's late bookings stay visible)
const iso = (d) => d.toISOString().slice(0, 10)
const offset = ref(0)
const days = computed(() => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset.value * 7 + i - 1)
  return { iso: iso(d), wd: d.toLocaleDateString('en', { weekday: 'short' }), dn: d.getDate(), today: iso(d) === iso(new Date()) }
}))
const hours = ['09', '10', '11', '12', '13', '14', '15', '16', '17']
const week = ref([])
const classes = ref([])
const local = (s) => ({ date: s.slice(0, 10), time: s.slice(11, 16) })

async function loadWeek() {
  const from = days.value[0].iso, to = days.value[6].iso
  try {
    const [a, c] = await Promise.all([
      api.get('/staff/appointments', { from, to, sort: 'asc', per_page: 200, doctor_id: docFilter.value || undefined, status: 'pending,approved,completed' }),
      api.get('/staff/appointments/classes', { from, to, doctor_id: docFilter.value || undefined }).catch(() => ({ data: [] })),
    ])
    week.value = a.data
    classes.value = c.data.map((s) => ({ ...s, ...local(s.starts_at), end: local(s.ends_at).time }))
  } catch (e) {
    error.value = e.message
  }
}
const at = (d, h) => week.value.filter((a) => a.date === d && a.time.startsWith(h))
const classesAt = (d, h) => classes.value.filter((s) => s.date === d && s.time.startsWith(h))
const kind = (a) => (!a.doctor && a.status === 'pending' ? 'nodoc' : a.status)
const short = (n) => (n ?? '').replace('Dr. ', 'Dr ')

// ---- list view
const rows = ref([])
const listMeta = ref({})
const listPage = ref(1)
const STATUS_OF = { all: undefined, pending: 'pending', approved: 'approved', completed: 'completed', declined: 'declined,cancelled', online: undefined }
async function loadList(reset = true) {
  if (reset) listPage.value = 1
  try {
    const res = await api.get('/staff/appointments', { status: STATUS_OF[tab.value], online: tab.value === 'online' ? 1 : undefined, doctor_id: docFilter.value || undefined, page: listPage.value, per_page: 40 })
    rows.value = res.data
    listMeta.value = res.meta
  } catch (e) {
    error.value = e.message
  }
}

// ---- needs-attention strips
const unassigned = ref([])
const onlinePending = ref([])
async function loadTodo() {
  if (!canApprove.value) return
  const [u, o] = await Promise.all([
    api.get('/staff/appointments', { status: 'pending', unassigned: 1, sort: 'asc', per_page: 20 }).catch(() => ({ data: [] })),
    api.get('/staff/appointments', { status: 'pending', online: 1, sort: 'asc', per_page: 20 }).catch(() => ({ data: [] })),
  ])
  unassigned.value = u.data
  onlinePending.value = o.data
}

const refresh = () => { loadTodo(); view.value === 'calendar' ? loadWeek() : loadList() }
watch([view, tab, docFilter], () => (view.value === 'calendar' ? loadWeek() : loadList()))
watch(offset, loadWeek)
onMounted(async () => {
  refresh()
  if (!isDoctor.value) doctors.value = (await api.get('/catalog/doctors').catch(() => ({ data: [] }))).data
})
function showOnline() { view.value = 'list'; tab.value = 'online' }

// ---- actions
const what = (a) => (a.is_online ? '45-min online session' : a.service?.name)
const checking = ref(null)   // conflict found when approving
const assigning = ref(null)  // pick a doctor (with suggestions)
const busy = ref(false)

async function approve(a) {
  if (!a.doctor) return openAssign(a)
  busy.value = true
  try {
    const check = (await api.get(`/staff/appointments/${a.id}/check`)).data
    if (check.clashes.length) return (checking.value = { a, ...check })
    if (!(await ask({
      title: a.is_online ? 'Confirm this online session?' : 'Approve this booking?',
      body: `${a.client?.name} · ${what(a)}\n${a.date} at ${a.time} with ${a.doctor.name}\n\n${a.is_online ? 'The client gets the video link and a payment request.' : 'The doctor and the client are notified straight away.'}`,
      ok: a.is_online ? 'Confirm session' : 'Approve',
    }))) return
    await api.post(`/staff/appointments/${a.id}/approve`)
    notify(a.is_online ? 'Online session confirmed' : 'Approved — doctor and client notified')
    refresh()
  } catch (e) {
    notify(e.message)
  } finally {
    busy.value = false
  }
}
async function openAssign(a) {
  try {
    const check = (await api.get(`/staff/appointments/${a.id}/check`)).data
    assigning.value = { a, ...check }
  } catch (e) {
    notify(e.message)
  }
}
async function assign(d) {
  const a = assigning.value.a
  if (!(await ask({ title: `Assign ${d.name}?`, body: `${a.client?.name} · ${what(a)} on ${a.date} at ${a.time}.\n${d.name} and the client will be notified.`, ok: a.is_online ? 'Assign & confirm' : 'Assign & approve' }))) return
  try {
    await api.post(`/staff/appointments/${a.id}/approve`, { doctor_id: d.id })
    assigning.value = null
    notify(`${d.name} assigned`)
    refresh()
  } catch (e) {
    notify(e.message)
  }
}
async function decline(a) {
  if (!(await ask({ title: 'Decline this booking?', body: `${a.client?.name} · ${what(a)} on ${a.date} at ${a.time}.\nThe client is told and can pick another time.`, ok: 'Decline', tone: 'danger' }))) return
  try {
    await api.post(`/staff/appointments/${a.id}/decline`)
    checking.value = null
    notify('Declined — the client was told')
    refresh()
  } catch (e) {
    notify(e.message)
  }
}
function reassign() { const a = checking.value.a; checking.value = null; openAssign(a) }
async function markTreated(a) {
  if (!(await ask({ title: 'Mark as treated?', body: `${a.client?.name} · ${what(a)} on ${a.date} at ${a.time}.\nChat with the client unlocks and points are credited once it’s paid.`, ok: 'Mark treated' }))) return
  try {
    await api.post(`/staff/appointments/${a.id}/complete`)
    notify('Marked as treated')
    refresh()
  } catch (e) {
    notify(e.message)
  }
}
const mineToTreat = (a) => auth.can('appointments.complete') && a.status === 'approved' && a.doctor?.id === auth.user?.doctor_id
const planTime = (p) => `${local(p.starts_at).time}–${local(p.ends_at).time}`
</script>

<template>
  <div class="head">
    <div>
      <h1>Appointments</h1>
      <p v-if="canApprove">Requests from the mobile app plus walk-in and phone bookings. Approving notifies the doctor and the client.</p>
      <p v-else>Sessions assigned to you by reception.</p>
    </div>
    <div class="row">
      <button v-if="auth.can('appointments.create')" class="btn gold" @click="walkIn = true">+ Walk-in / phone booking</button>
      <select v-if="!isDoctor" v-model.number="docFilter" style="width: 200px">
        <option :value="0">All doctors</option>
        <option v-for="d in doctors" :key="d.id" :value="d.id">{{ d.name }}</option>
      </select>
      <div class="tabs" style="margin: 0">
        <button :class="{ on: view === 'calendar' }" @click="view = 'calendar'">calendar</button>
        <button :class="{ on: view === 'list' }" @click="view = 'list'">list</button>
      </div>
    </div>
  </div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>

  <div v-if="canApprove && (unassigned.length || onlinePending.length)" class="todo">
    <div v-if="unassigned.length" class="todo-row nodoc">
      <span class="dot"></span>
      <div class="todo-text">
        <b>{{ unassigned.length }} {{ unassigned.length === 1 ? 'booking needs' : 'bookings need' }} a doctor</b>
        <small>Clients who didn’t choose one. Lavish suggests doctors by specialty, availability and workload.</small>
      </div>
      <div class="todo-actions"><button v-for="a in unassigned" :key="a.id" class="pill" @click="openAssign(a)">{{ a.client?.name }} · {{ a.date.slice(5) }} {{ a.time }}</button></div>
    </div>
    <div v-if="onlinePending.length" class="todo-row online">
      <span class="dot"></span>
      <div class="todo-text">
        <b>{{ onlinePending.length }} online {{ onlinePending.length === 1 ? 'session' : 'sessions' }} to confirm</b>
        <small>45-min video consultations. Confirming sends the video link and a payment request.</small>
      </div>
      <div class="todo-actions"><button class="pill" @click="showOnline">Review</button></div>
    </div>
  </div>

  <div v-if="view === 'calendar'" class="card calwrap">
    <div class="legend">
      <span class="k approved">Approved</span>
      <span class="k pending">Awaiting approval</span>
      <span class="k nodoc">Needs a doctor</span>
      <span class="k lesson">Academy class</span>
      <span class="k completed">Completed</span>
      <span class="hint row" style="gap: 6px; align-items: center">
        <button class="pill" @click="offset--">‹ Prev</button>
        <button class="pill" :disabled="offset === 0" @click="offset = 0">This week</button>
        <button class="pill" @click="offset++">Next ›</button>
      </span>
    </div>
    <div class="calscroll">
      <table class="wk">
        <thead>
          <tr>
            <th class="gut"></th>
            <th v-for="d in days" :key="d.iso" :class="{ today: d.today }"><span class="wd">{{ d.wd }}</span><span class="dn">{{ d.dn }}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in hours" :key="h">
            <td class="gut">{{ h }}:00</td>
            <td v-for="d in days" :key="d.iso" :class="{ today: d.today }">
              <div v-for="s in classesAt(d.iso, h)" :key="'c' + s.id" class="ev lesson" :title="`Academy class ${s.time}–${s.end} · ${s.teacher?.name} · ${s.title}`">
                <div class="ev-top"><span class="t">{{ s.time }}–{{ s.end }}</span><span class="tag">Class</span></div>
                <div class="who">{{ short(s.teacher?.name) }}</div>
                <div class="what">{{ s.title }}</div>
              </div>
              <div v-for="a in at(d.iso, h)" :key="a.id" class="ev" :class="kind(a)" :title="`${a.time} ${a.client?.name} · ${a.is_online ? 'Online video call (45 min)' : a.service?.name} · ${a.doctor ? short(a.doctor.name) : 'No doctor yet'}`" @click="ui.drawerClient = a.client?.id">
                <div class="ev-top"><span class="t">{{ a.time }}</span><span v-if="a.is_online" class="tag">Online</span></div>
                <div class="who">{{ a.client?.name }}</div>
                <div class="what">{{ a.is_online ? 'Video call · 45 min' : a.service?.name }}</div>
                <div class="doc" :class="{ missing: !a.doctor }">{{ a.doctor ? short(a.doctor.name) : 'No doctor yet' }}</div>
                <button v-if="canApprove && a.status === 'pending'" class="ev-btn" :disabled="busy" @click.stop="approve(a)">{{ !a.doctor ? 'Assign doctor' : a.is_online ? 'Confirm' : 'Approve' }}</button>
                <button v-else-if="mineToTreat(a)" class="ev-btn" @click.stop="markTreated(a)">Mark treated</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!week.length && !classes.length" class="note" style="text-align: center; padding: 14px">No bookings this week.</p>
    </div>
  </div>

  <template v-else>
    <div class="tabs">
      <button v-for="t in ['all', 'pending', 'approved', 'completed', 'declined', 'online']" :key="t" :class="{ on: tab === t }" @click="tab = t">{{ t === 'online' ? '🎥 online' : t }}</button>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Client</th><th>Treatment</th><th>Doctor</th><th>When</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr v-for="a in rows" :key="a.id">
            <td><ClientLink :id="a.client?.id" :name="a.client?.name" /><small>{{ a.client?.phone }}</small></td>
            <td>
              <template v-if="a.is_online">🎥 Online consultation<small>Video call · 45 min · {{ etb(a.price) }}</small><small v-if="a.video_link">Link: {{ a.video_link }}</small></template>
              <template v-else>{{ a.service?.name }}<small>{{ a.branch?.name }} · {{ etb(a.price) }}</small></template>
            </td>
            <td><span v-if="!a.doctor" class="badge open">Needs doctor</span><template v-else>{{ a.doctor.name }}</template></td>
            <td>{{ a.date }}<small>{{ a.time }} · {{ a.duration_minutes }} min</small></td>
            <td><span class="badge" :class="a.status">{{ a.status }}</span><small v-if="a.payment">{{ a.payment.status === 'paid' ? 'Paid' : a.payment.status === 'in_review' ? 'Receipt to check' : 'Not paid' }}</small></td>
            <td class="row">
              <template v-if="canApprove && a.status === 'pending'">
                <button v-if="!a.doctor" class="btn gold sm" @click="openAssign(a)">✨ Assign doctor</button>
                <button v-else class="btn gold sm" :disabled="busy" @click="approve(a)">{{ a.is_online ? 'Confirm online session' : 'Approve & notify' }}</button>
                <button class="btn danger sm" @click="decline(a)">Decline</button>
              </template>
              <button v-if="mineToTreat(a)" class="btn sm" @click="markTreated(a)">Mark treated</button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="6" class="empty">No appointments</td></tr>
        </tbody>
      </table>
    <Pager :meta="listMeta" label="appointments" @go="(n) => { listPage = n; loadList(false) }" />
    </div>
  </template>

  <WalkIn v-if="walkIn" @close="walkIn = false" @booked="refresh" />

  <div v-if="checking" class="modal-bg" @click.self="checking = null">
    <div class="modal" style="width: min(560px, 95vw)">
      <h2>Schedule conflict</h2>
      <p class="note">{{ checking.a.client?.name }} · {{ what(checking.a) }} · {{ checking.a.date }} at {{ checking.a.time }}</p>
      <ul class="reasons" style="margin: 12px 0"><li v-for="c in checking.clashes" :key="c.kind + c.id" class="no">✕ {{ c.text }}</li></ul>
      <h3 style="margin-top: 14px">{{ checking.a.doctor?.name }}’s day — classes & treatments</h3>
      <table style="margin-top: 6px">
        <tbody>
          <tr v-for="p in checking.day_plan" :key="p.kind + p.id">
            <td><b>{{ planTime(p) }}</b></td>
            <td><span class="badge" :class="p.kind === 'class' ? 'pending' : 'approved'">{{ p.kind === 'class' ? 'Class' : 'Treatment' }}</span></td>
            <td>{{ p.text }}</td>
          </tr>
        </tbody>
      </table>
      <p class="note" style="margin-top: 10px">Pick another doctor, or decline and ask the client for a different time.</p>
      <div class="row" style="justify-content: flex-end; margin-top: 16px">
        <button class="btn ghost" @click="checking = null">Cancel</button>
        <button class="btn danger" @click="decline(checking.a)">Decline</button>
        <button class="btn gold" @click="reassign">✨ Choose another doctor</button>
      </div>
    </div>
  </div>

  <div v-if="assigning" class="modal-bg" @click.self="assigning = null">
    <div class="modal" style="width: min(680px, 95vw); max-height: 92vh; overflow: auto">
      <h2>Assign a doctor</h2>
      <div class="card" style="background: var(--bg); margin: 12px 0">
        <b>{{ assigning.a.client?.name }}</b> · {{ assigning.a.is_online ? '🎥 Online consultation (45-min video call)' : assigning.a.service?.name }}
        <p class="note">{{ assigning.a.date }} at {{ assigning.a.time }}{{ assigning.a.doctor ? '' : ' · client did not choose a doctor' }}
          <span v-if="assigning.client_history.length"> · last treated: {{ assigning.client_history[0].service?.name }} with {{ assigning.client_history[0].doctor?.name }}</span></p>
      </div>

      <div v-for="(s, i) in assigning.suggestions" :key="s.doctor.id" class="sugg" :class="{ best: i === 0 && s.available, off: !s.available }">
        <div class="row" style="justify-content: space-between; align-items: flex-start">
          <div>
            <b class="serif" style="font-size: 20px">{{ s.doctor.name }}</b>
            <span v-if="i === 0 && s.available" class="badge" style="margin-left: 8px; background: var(--gold); color: #262626">★ Best match</span>
            <span v-else-if="!s.available" class="badge declined" style="margin-left: 8px">Unavailable</span>
            <p class="note">{{ s.doctor.specialty }} · {{ s.doctor.branch?.name }}</p>
          </div>
          <div class="score"><b>{{ s.score }}</b><small>/ 110</small></div>
        </div>
        <div class="meter"><i :style="{ width: Math.min(100, (s.score / 110) * 100) + '%' }"></i></div>
        <ul class="reasons">
          <li v-for="r in s.reasons" :key="r.text" :class="r.ok ? 'ok' : 'no'">{{ r.ok ? '✓' : '✕' }} {{ r.text }}</li>
        </ul>
        <button class="btn sm" :class="s.available ? 'gold' : 'ghost'" :disabled="!s.available" @click="assign(s.doctor)">
          Assign {{ short(s.doctor.name) }} & {{ assigning.a.is_online ? 'confirm' : 'approve' }}
        </button>
      </div>
      <p v-if="!assigning.suggestions.length" class="note">No doctor offers this treatment yet — give a doctor portal access and the treatment in Staff.</p>

      <div class="row" style="justify-content: flex-end; margin-top: 14px">
        <button class="btn ghost" @click="assigning = null">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Needs-attention strips */
.todo { display: grid; gap: 8px; margin-bottom: 18px; }
.todo-row { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; flex-wrap: wrap; }
.todo-row .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.todo-row.nodoc .dot { background: var(--bad); box-shadow: 0 0 0 4px rgba(184, 72, 63, .12); }
.todo-row.online .dot { background: var(--dark); box-shadow: 0 0 0 4px rgba(10, 115, 121, .12); }
.todo-text { flex: 1; min-width: 240px; }
.todo-text b { display: block; font-size: 14px; font-weight: 500; color: var(--ink); }
.todo-text small { display: block; margin-top: 2px; font-size: 12px; color: var(--muted); }
.todo-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.pill { padding: 5px 12px; border-radius: 999px; border: 1px solid var(--line); background: #fff; font-size: 12px; color: var(--ink); cursor: pointer; transition: border-color .15s, background .15s; }
.pill:hover { border-color: var(--dark); background: #f2f9f8; }

/* Calendar */
.calwrap { padding: 16px 16px 8px; }
.legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; padding: 0 4px 14px; font-size: 12px; color: var(--muted); }
.legend .k { display: inline-flex; align-items: center; gap: 6px; }
.legend .k::before { content: ''; width: 10px; height: 10px; border-radius: 3px; background: var(--c); }
.legend .hint { margin-left: auto; font-size: 11.5px; }
.calscroll { overflow-x: auto; }

.wk { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; min-width: 880px; }
.wk th { background: var(--card); padding: 6px 4px 12px; font-weight: 400; border-bottom: 1px solid var(--line); }
.wk th .wd { display: block; font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted); }
.wk th .dn { display: inline-grid; place-items: center; width: 30px; height: 30px; margin-top: 3px; border-radius: 50%; font-size: 16px; color: var(--ink); }
.wk th.today .wd { color: var(--dark); font-weight: 500; }
.wk th.today .dn { background: var(--dark); color: #fff; }
.wk .gut { width: 54px; }
.wk td { vertical-align: top; padding: 5px; border-bottom: 1px solid #efeeec; border-left: 1px solid #efeeec; height: 44px; }
.wk td.gut { border-left: 0; padding: 4px 8px 0 0; text-align: right; font-size: 11px; color: var(--muted); }
.wk td.today { background: rgba(10, 115, 121, .025); }
.wk tbody tr:last-child td { border-bottom: 0; }

/* Booking cards: white, one colour stripe for status */
.ev { --c: var(--dark); position: relative; margin-bottom: 5px; padding: 7px 9px 8px 11px; border-radius: 9px; background: #fff; border: 1px solid #e9e8e6; font-size: 12px; line-height: 1.35; cursor: pointer; transition: box-shadow .15s, border-color .15s; }
.ev::before { content: ''; position: absolute; left: 0; top: 6px; bottom: 6px; width: 3px; border-radius: 0 3px 3px 0; background: var(--c); }
.ev:hover { border-color: #d8d6d3; box-shadow: 0 4px 14px -6px rgba(0, 0, 0, .18); }
.ev-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.ev .t { font-size: 11px; font-weight: 500; color: var(--c); font-variant-numeric: tabular-nums; }
.ev .tag { font-size: 10px; padding: 1px 6px; border-radius: 999px; background: color-mix(in srgb, var(--c) 12%, #fff); color: var(--c); }
.ev .who { margin-top: 2px; font-weight: 500; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev .what, .ev .doc { color: #6b6d70; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev .doc { font-size: 11px; }
.ev .doc.missing { color: var(--bad); }
.ev .clash { margin-top: 3px; font-size: 11px; color: var(--bad); }
.ev-btn { margin-top: 6px; width: 100%; padding: 4px 0; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--c) 40%, #fff); background: #fff; color: var(--c); font-size: 11px; font-weight: 500; cursor: pointer; transition: background .15s, color .15s; }
.ev-btn:hover { background: var(--c); color: #fff; }

.ev.approved, .legend .approved { --c: var(--dark); }
.ev.approved { background: #f3f9f8; border-color: #dcecea; }
.ev.pending, .legend .pending { --c: var(--warn); }
.ev.nodoc, .legend .nodoc { --c: var(--bad); }
.ev.lesson, .legend .lesson { --c: #a07a62; }
.ev.lesson { background: #fbf8f6; border-color: #efe6e0; cursor: default; }
.ev.completed, .legend .completed { --c: #9aa3a3; }
.ev.completed { opacity: .75; }
</style>
