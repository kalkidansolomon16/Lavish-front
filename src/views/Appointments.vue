<script setup>
import { ref, computed } from 'vue'
import { state, actions, clientName, doctorName, suggestDoctors } from '../store'
import { ui, pushNotif } from '../ui'
import ClientLink from '../components/ClientLink.vue'

const role = state.user.role
const canApprove = ['reception', 'admin'].includes(role)
const tab = ref('all')
const view = ref('calendar')
const docFilter = ref(role === 'doctor' ? state.user.doctorId : 0)
const assigning = ref(null)

const mine = computed(() =>
  state.appointments.filter((a) => (role !== 'doctor' || a.doctorId === state.user.doctorId) && (!docFilter.value || !a.doctorId || a.doctorId === docFilter.value)),
)
const rows = computed(() => mine.value.filter((a) => tab.value === 'all' || a.status === tab.value).sort((a, b) => b.date.localeCompare(a.date)))
const unassigned = computed(() => state.appointments.filter((a) => !a.doctorId && a.status === 'pending'))
const suggestions = computed(() => (assigning.value ? suggestDoctors(assigning.value) : []))
const history = computed(() => state.appointments.filter((a) => assigning.value && a.clientId === assigning.value.clientId && a.status === 'completed'))

// calendar: yesterday … +5 days, hourly slots
const days = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(Date.now() + (i - 1) * 864e5)
  return { iso: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en', { weekday: 'short', day: 'numeric' }), today: i === 1 }
})
const hours = ['09', '10', '11', '12', '13', '14', '15', '16', '17']
const at = (iso, h) => mine.value.filter((a) => a.date === iso && a.time.startsWith(h) && a.status !== 'declined')

function approve(a) {
  if (!a.doctorId) return (assigning.value = a)
  actions.approveAppointment(a)
  pushNotif(`${clientName(a.clientId)} — ${a.service} on ${a.date} ${a.time} was approved`, ['doctor'], '/appointments', a.doctorId)
}
function assign(d) {
  const a = assigning.value
  actions.assignDoctor(a, d)
  pushNotif(`${clientName(a.clientId)} was assigned to you — ${a.service} on ${a.date} ${a.time}`, ['doctor'], '/appointments', d.id)
  assigning.value = null
}
</script>

<template>
  <div class="head">
    <div>
      <h1>Appointments</h1>
      <p v-if="canApprove">Requests booked by clients in the mobile app. Approving notifies the doctor instantly.</p>
      <p v-else>Sessions assigned to you by reception.</p>
    </div>
    <div class="row">
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

  <div v-if="view === 'calendar'" class="card" style="overflow-x: auto">
    <table class="cal">
      <thead>
        <tr><th></th><th v-for="d in days" :key="d.iso" :class="{ today: d.today }">{{ d.label }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="h in hours" :key="h">
          <td class="hr">{{ h }}:00</td>
          <td v-for="d in days" :key="d.iso" :class="{ today: d.today }">
            <div v-for="a in at(d.iso, h)" :key="a.id" class="chip" :class="[a.status, { nodoc: !a.doctorId }]" @click="ui.drawerClient = a.clientId">
              <b>{{ a.time }}</b> {{ clientName(a.clientId) }}
              <small>{{ a.service }} · {{ a.doctorId ? doctorName(a.doctorId).replace('Dr. ', 'Dr ') : 'Needs doctor' }}</small>
              <span v-if="canApprove && a.status === 'pending'" class="chip-actions" @click.stop>
                <button @click="approve(a)">{{ a.doctorId ? '✓ Approve' : '✨ Assign doctor' }}</button>
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="note" style="margin-top: 12px">Dashed = awaiting approval · solid teal = approved · click a booking to open the client profile.</p>
  </div>

  <template v-else>
    <div class="tabs">
      <button v-for="t in ['all', 'pending', 'approved', 'completed', 'declined']" :key="t" :class="{ on: tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Client</th><th>Treatment</th><th>Doctor</th><th>When</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr v-for="a in rows" :key="a.id">
            <td><ClientLink :id="a.clientId" /></td>
            <td>{{ a.service }}</td>
            <td>
              <span v-if="!a.doctorId" class="badge open">Needs doctor</span>
              <template v-else>{{ doctorName(a.doctorId) }}<small v-if="a.notified">Doctor notified ✓</small></template>
            </td>
            <td>{{ a.date }}<small>{{ a.time }}</small></td>
            <td><span class="badge" :class="a.status">{{ a.status }}</span></td>
            <td class="row">
              <template v-if="canApprove && a.status === 'pending'">
                <button v-if="!a.doctorId" class="btn gold sm" @click="assigning = a">✨ Assign doctor</button>
                <button v-else class="btn gold sm" @click="approve(a)">Approve & notify</button>
                <button class="btn danger sm" @click="actions.declineAppointment(a)">Decline</button>
              </template>
              <button v-if="role === 'doctor' && a.status === 'approved'" class="btn sm" @click="actions.completeAppointment(a)">Mark treated</button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="6" class="empty">No appointments</td></tr>
        </tbody>
      </table>
    </div>
  </template>

  <div v-if="assigning" class="modal-bg" @click.self="assigning = null">
    <div class="modal" style="width: min(680px, 95vw); max-height: 92vh; overflow: auto">
      <h2>Assign a doctor</h2>
      <div class="card" style="background: var(--bg); margin: 12px 0">
        <b>{{ clientName(assigning.clientId) }}</b> · {{ assigning.service }}
        <p class="note">{{ assigning.date }} at {{ assigning.time }} · client did not choose a doctor
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
          Assign {{ s.doctor.name.replace('Dr. ', 'Dr ') }} & approve
        </button>
      </div>

      <div class="row" style="justify-content: flex-end; margin-top: 14px">
        <button class="btn ghost" @click="assigning = null">Cancel</button>
      </div>
    </div>
  </div>
</template>
