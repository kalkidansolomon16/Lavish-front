<script setup>
import { ref, computed } from 'vue'
import { state, actions, clientName, doctorName, suggestDoctors, doctorClashes, can, CLASS_MINS, ONLINE, apptMins, etb } from '../store'
import { ui, pushNotif } from '../ui'
import ClientLink from '../components/ClientLink.vue'
import WalkIn from '../components/WalkIn.vue'

const role = state.user.role
const canApprove = can('appointments.approve')
const walkIn = ref(false)
const tab = ref('all')
const view = ref('calendar')
const docFilter = ref(role === 'doctor' ? state.user.doctorId : 0)
const assigning = ref(null)

const mine = computed(() =>
  state.appointments.filter((a) => (role !== 'doctor' || a.doctorId === state.user.doctorId) && (!docFilter.value || !a.doctorId || a.doctorId === docFilter.value)),
)
const rows = computed(() => mine.value.filter((a) => tab.value === 'all' || (tab.value === 'online' ? a.online : a.status === tab.value)).sort((a, b) => b.date.localeCompare(a.date)))
const unassigned = computed(() => state.appointments.filter((a) => !a.doctorId && a.status === 'pending'))
// Online sessions booked in the app wait for reception to confirm them.
const onlinePending = computed(() => state.appointments.filter((a) => a.online && a.status === 'pending'))
function showOnline() { view.value = 'list'; tab.value = 'online' }
const suggestions = computed(() => (assigning.value ? suggestDoctors(assigning.value) : []))
const history = computed(() => state.appointments.filter((a) => assigning.value && a.clientId === assigning.value.clientId && a.status === 'completed'))

// calendar: yesterday … +5 days, hourly slots
const days = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(Date.now() + (i - 1) * 864e5)
  return { iso: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en', { weekday: 'short', day: 'numeric' }), today: i === 1 }
})
const hours = ['09', '10', '11', '12', '13', '14', '15', '16', '17']
const at = (iso, h) => mine.value.filter((a) => a.date === iso && a.time.startsWith(h) && a.status !== 'declined')
// Academy classes taught by the doctor(s) in view — shown on the same calendar so reception sees both.
const classesAt = (iso, h) => state.sessions.filter((s) => (!docFilter.value || s.teacherId === docFilter.value) && s.date === iso && s.time.startsWith(h))
const endOf = (t) => { const m = +t.slice(0, 2) * 60 + +t.slice(3, 5) + CLASS_MINS; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }

// Before approving, cross-check the doctor's academy classes and other treatments.
const clashes = (a) => (a.doctorId && a.status === 'pending' ? doctorClashes(a.doctorId, a.date, a.time, apptMins(a), a.id) : [])
const checking = ref(null)
const dayPlan = computed(() => {
  const a = checking.value
  if (!a) return []
  const classes = state.sessions.filter((s) => s.teacherId === a.doctorId && s.date === a.date)
    .map((s) => ({ time: s.time, end: endOf(s.time), kind: 'Class', text: `${s.title} · ${s.room}` }))
  const treatments = state.appointments.filter((x) => x.doctorId === a.doctorId && x.date === a.date && x.status === 'approved')
    .map((x) => ({ time: x.time, kind: x.online ? 'Online' : 'Treatment', text: `${clientName(x.clientId)} — ${x.online ? 'online session (45 min)' : x.service}` }))
  return [...classes, ...treatments].sort((x, y) => x.time.localeCompare(y.time))
})

function approve(a) {
  if (!a.doctorId) return (assigning.value = a)
  if (clashes(a).length) return (checking.value = a)
  actions.approveAppointment(a)
  pushNotif(a.online ? `${clientName(a.clientId)} — 45-min online session on ${a.date} ${a.time} was confirmed` : `${clientName(a.clientId)} — ${a.service} on ${a.date} ${a.time} was approved`, ['doctor'], '/appointments', a.doctorId)
}
function reassign() { assigning.value = checking.value; checking.value = null }
function decline() { actions.declineAppointment(checking.value); checking.value = null }
function assign(d) {
  const a = assigning.value
  actions.assignDoctor(a, d)
  pushNotif(`${clientName(a.clientId)} was assigned to you — ${a.online ? '45-min online session' : a.service} on ${a.date} ${a.time}`, ['doctor'], '/appointments', d.id)
  assigning.value = null
}
</script>

<template>
  <div class="head">
    <div>
      <h1>Appointments</h1>
      <p v-if="canApprove">Requests from the mobile app plus walk-in and phone bookings. Approving notifies the doctor instantly.</p>
      <p v-else>Sessions assigned to you by reception.</p>
    </div>
    <div class="row">
      <button v-if="canApprove" class="btn gold" @click="walkIn = true">+ Walk-in / phone booking</button>
      <select v-if="role !== 'doctor'" v-model.number="docFilter" style="width: 200px">
        <option :value="0">All doctors</option>
        <option v-for="d in state.doctors" :key="d.id" :value="d.id">{{ d.name }}</option>
      </select>
      <div class="tabs" style="margin: 0">
        <button :class="{ on: view === 'calendar' }" @click="view = 'calendar'">calendar</button>
        <button :class="{ on: view === 'list' }" @click="view = 'list'">list</button>
      </div>
    </div>
  </div>

  <div v-if="canApprove && unassigned.length" class="card assign-banner">
    <div>
      <b class="serif" style="font-size: 20px">{{ unassigned.length }} booking(s) without a doctor</b>
      <p class="note">These clients didn’t choose a doctor. Lavish ranks doctors by specialty, availability and workload.</p>
    </div>
    <div class="row">
      <button v-for="a in unassigned" :key="a.id" class="btn gold sm" @click="assigning = a">✨ {{ clientName(a.clientId) }}</button>
    </div>
  </div>

  <div v-if="canApprove && onlinePending.length" class="card assign-banner online-banner">
    <div>
      <b class="serif" style="font-size: 20px">🎥 {{ onlinePending.length }} online session request(s) to confirm</b>
      <p class="note">{{ ONLINE.mins }}-min video consultations booked in the app · {{ etb(ONLINE.price) }} each. Confirming sends the client their video link and a payment request.</p>
    </div>
    <button class="btn gold sm" @click="showOnline">Review online requests</button>
  </div>

  <div v-if="view === 'calendar'" class="card" style="overflow-x: auto">
    <table class="cal">
      <thead>
        <tr><th></th><th v-for="d in days" :key="d.iso" :class="{ today: d.today }">{{ d.label }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="h in hours" :key="h">
          <td class="hr">{{ h }}:00</td>
          <td v-for="d in days" :key="d.iso" :class="{ today: d.today }">
            <div v-for="s in classesAt(d.iso, h)" :key="'c' + s.id" class="chip lesson">
              <b>{{ s.time }}–{{ endOf(s.time) }}</b> 🎓 {{ doctorName(s.teacherId).replace('Dr. ', 'Dr ') }}
              <small>Academy class · {{ s.title }}</small>
            </div>
            <div v-for="a in at(d.iso, h)" :key="a.id" class="chip" :class="[a.status, { nodoc: !a.doctorId, online: a.online }]" @click="ui.drawerClient = a.clientId">
              <b>{{ a.time }}</b> {{ a.online ? '🎥 ' : '' }}{{ clientName(a.clientId) }}
              <small>{{ a.online ? 'Online · 45 min' : a.service }} · {{ a.doctorId ? doctorName(a.doctorId).replace('Dr. ', 'Dr ') : 'Needs doctor' }}</small>
              <small v-if="clashes(a).length" class="clash">⚠ Doctor busy — {{ clashes(a)[0].kind === 'class' ? 'teaching' : 'treating' }}</small>
              <span v-if="canApprove && a.status === 'pending'" class="chip-actions" @click.stop>
                <button @click="approve(a)">{{ !a.doctorId ? '✨ Assign doctor' : a.online ? '✓ Confirm' : '✓ Approve' }}</button>
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="note" style="margin-top: 12px">Dashed = awaiting approval · solid teal = approved · 🎥 = 45-min online session (video call) · gold 🎓 = academy class the doctor teaches · click a booking to open the client profile.</p>
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
            <td><ClientLink :id="a.clientId" /></td>
            <td>
              <template v-if="a.online">🎥 Online consultation<small>Video call · 45 min · {{ etb(ONLINE.price) }}</small><small v-if="a.link">Link sent ✓ {{ a.link }}</small></template>
              <template v-else>{{ a.service }}</template>
            </td>
            <td>
              <span v-if="!a.doctorId" class="badge open">Needs doctor</span>
              <template v-else>{{ doctorName(a.doctorId) }}<small v-if="a.notified">Doctor notified ✓</small>
                <small v-for="c in clashes(a)" :key="c.text" class="clash">⚠ {{ c.text }}</small></template>
            </td>
            <td>{{ a.date }}<small>{{ a.time }}</small></td>
            <td><span class="badge" :class="a.status">{{ a.status }}</span></td>
            <td class="row">
              <template v-if="canApprove && a.status === 'pending'">
                <button v-if="!a.doctorId" class="btn gold sm" @click="assigning = a">✨ Assign doctor</button>
                <button v-else class="btn gold sm" @click="approve(a)">{{ a.online ? 'Confirm online session' : 'Approve & notify' }}</button>
                <button class="btn danger sm" @click="actions.declineAppointment(a)">Decline</button>
              </template>
              <button v-if="can('appointments.complete') && a.status === 'approved' && a.doctorId === state.user.doctorId" class="btn sm" @click="actions.completeAppointment(a)">Mark treated</button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="6" class="empty">No appointments</td></tr>
        </tbody>
      </table>
    </div>
  </template>

  <WalkIn v-if="walkIn" @close="walkIn = false" />

  <div v-if="checking" class="modal-bg" @click.self="checking = null">
    <div class="modal" style="width: min(560px, 95vw)">
      <h2>Schedule conflict</h2>
      <p class="note">{{ clientName(checking.clientId) }} · {{ checking.service }} · {{ checking.date }} at {{ checking.time }}</p>
      <ul class="reasons" style="margin: 12px 0">
        <li v-for="c in clashes(checking)" :key="c.text" class="no">✕ {{ c.text }}</li>
      </ul>
      <h3 style="margin-top: 14px">{{ doctorName(checking.doctorId) }}’s day — classes & treatments</h3>
      <table style="margin-top: 6px">
        <tbody>
          <tr v-for="p in dayPlan" :key="p.kind + p.time + p.text">
            <td><b>{{ p.time }}</b><small v-if="p.end">until {{ p.end }}</small></td>
            <td><span class="badge" :class="p.kind === 'Class' ? 'pending' : p.kind === 'Online' ? 'awaiting' : 'approved'">{{ p.kind }}</span></td>
            <td>{{ p.text }}</td>
          </tr>
        </tbody>
      </table>
      <p class="note" style="margin-top: 10px">Pick another doctor, or decline and ask the client for a different time.</p>
      <div class="row" style="justify-content: flex-end; margin-top: 16px">
        <button class="btn ghost" @click="checking = null">Cancel</button>
        <button class="btn danger" @click="decline">Decline</button>
        <button class="btn gold" @click="reassign">✨ Choose another doctor</button>
      </div>
    </div>
  </div>

  <div v-if="assigning" class="modal-bg" @click.self="assigning = null">
    <div class="modal" style="width: min(680px, 95vw); max-height: 92vh; overflow: auto">
      <h2>Assign a doctor</h2>
      <div class="card" style="background: var(--bg); margin: 12px 0">
        <b>{{ clientName(assigning.clientId) }}</b> · {{ assigning.online ? '🎥 Online consultation (45-min video call)' : assigning.service }}
        <p class="note">{{ assigning.date }} at {{ assigning.time }}{{ assigning.doctorId ? '' : ' · client did not choose a doctor' }}
          <span v-if="history.length"> · last treated: {{ history.at(-1).service }}</span></p>
      </div>

      <div v-for="(s, i) in suggestions" :key="s.doctor.id" class="sugg" :class="{ best: i === 0 && s.available, off: !s.available }">
        <div class="row" style="justify-content: space-between; align-items: flex-start">
          <div>
            <b class="serif" style="font-size: 20px">{{ s.doctor.name }}</b>
            <span v-if="i === 0 && s.available" class="badge" style="margin-left: 8px; background: var(--gold); color: #262626">★ Best match</span>
            <span v-else-if="!s.available" class="badge declined" style="margin-left: 8px">Unavailable</span>
            <p class="note">{{ s.doctor.specialty }} · {{ s.doctor.branch }}</p>
          </div>
          <div class="score"><b>{{ s.score }}</b><small>/ 110</small></div>
        </div>
        <div class="meter"><i :style="{ width: Math.min(100, (s.score / 110) * 100) + '%' }"></i></div>
        <ul class="reasons">
          <li v-for="r in s.reasons" :key="r.text" :class="r.ok ? 'ok' : 'no'">{{ r.ok ? '✓' : '✕' }} {{ r.text }}</li>
        </ul>
        <button class="btn sm" :class="s.available ? 'gold' : 'ghost'" :disabled="!s.available" @click="assign(s.doctor)">
          Assign {{ s.doctor.name.replace('Dr. ', 'Dr ') }} & {{ assigning.online ? 'confirm' : 'approve' }}
        </button>
      </div>

      <div class="row" style="justify-content: flex-end; margin-top: 14px">
        <button class="btn ghost" @click="assigning = null">Cancel</button>
      </div>
    </div>
  </div>
</template>
