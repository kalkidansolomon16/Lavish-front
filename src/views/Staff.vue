<script setup>
import { ref, computed } from 'vue'
import { state, actions, ROLES, BRANCHES, can, courseTitle } from '../store'

const me = state.user.role
const roleLabel = (r) => (r === 'doctor' ? 'Doctor' : ROLES[r].label)
// The CEO can create any role (including the GM); the GM gives access to doctors, receptionists and e-commerce.
const creatable = me === 'ceo' ? ['doctor', 'gm', 'reception', 'ecommerce'] : ['doctor', 'reception', 'ecommerce']
const tab = ref('all')
const open = ref(false)
const blank = () => ({ name: '', role: 'doctor', position: '', branch: BRANCHES[0], phone: '' })
const form = ref(blank())

const teaches = (d) => state.courses.filter((c) => c.teacherIds.includes(d.id)).map((c) => c.title)
const everyone = computed(() => [
  ...state.doctors.map((d) => ({ key: 'd' + d.id, doctor: d, name: d.name, role: 'doctor', position: d.specialty, branch: d.branch, phone: '—' })),
  ...state.staff.map((m) => ({ key: 's' + m.id, member: m, name: m.name, role: m.role, position: m.position, branch: m.branch, phone: m.phone })),
])
const rows = computed(() => everyone.value.filter((r) => tab.value === 'all' || r.role === tab.value))
const count = (r) => (r === 'all' ? everyone.value.length : everyone.value.filter((x) => x.role === r).length)
const initials = (n) => n.replace('Dr. ', '').split(' ').map((w) => w[0]).join('')
const pendingDocs = computed(() => state.doctors.filter((d) => d.access === 'pending'))
// GM may reactivate but not suspend; nobody suspends the CEO or themselves.
const canToggle = (m) => m.role !== 'ceo' && m.name !== state.user.name && (can.ban(me) || m.status !== 'active')

function save() {
  if (!form.value.name.trim()) return
  actions.addStaff({ ...form.value, name: (form.value.role === 'doctor' && !form.value.name.startsWith('Dr.') ? 'Dr. ' : '') + form.value.name.trim() })
  form.value = blank()
  open.value = false
}
</script>

<template>
  <div class="head">
    <div>
      <h1>{{ me === 'gm' ? 'Staff · HR' : 'Staff & access' }}</h1>
      <p>Everyone who works at Lavish. Doctors with access appear in the mobile app for clients to book.
        <template v-if="me === 'gm'"> You can give access; only the CEO can ban.</template></p>
    </div>
    <button class="btn gold" @click="open = true">+ Add & give access</button>
  </div>

  <div v-if="pendingDocs.length" class="card assign-banner">
    <div>
      <b class="serif" style="font-size: 20px">{{ pendingDocs.length }} doctor(s) waiting for access</b>
      <p class="note">They can’t log in or receive bookings until access is granted.</p>
    </div>
    <div class="row">
      <button v-for="d in pendingDocs" :key="d.id" class="btn gold sm" @click="actions.setDoctorAccess(d, 'active')">✓ Grant {{ d.name }}</button>
    </div>
  </div>

  <div class="tabs">
    <button v-for="t in ['all', 'doctor', 'ceo', 'gm', 'reception', 'ecommerce']" :key="t" :class="{ on: tab === t }" @click="tab = t">
      {{ t === 'all' ? 'All' : roleLabel(t) }} · {{ count(t) }}
    </button>
  </div>

  <div class="card">
    <table>
      <thead><tr><th>Name</th><th>Role</th><th>Position / specialty</th><th>Branch</th><th>Contact</th><th>Status</th><th>Access</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.key">
          <td><span class="mini-avatar">{{ initials(r.name) }}</span>{{ r.name }}</td>
          <td>
            <span class="badge">{{ roleLabel(r.role) }}</span>
            <small v-if="r.doctor && teaches(r.doctor).length">🎓 Teaches {{ teaches(r.doctor).join(', ') }}</small>
          </td>
          <td>{{ r.position }}</td>
          <td>{{ r.branch }}</td>
          <td>{{ r.phone }}</td>
          <td>
            <select v-if="r.doctor && r.doctor.access === 'active'" v-model="r.doctor.status" style="width: 130px">
              <option>Available</option><option>In surgery</option><option>Off today</option>
            </select>
            <span v-else-if="r.doctor" class="badge" :class="r.doctor.access === 'banned' ? 'declined' : 'pending'">{{ r.doctor.access === 'banned' ? 'banned' : 'no access yet' }}</span>
            <span v-else class="badge" :class="r.member.status === 'active' ? 'active' : 'declined'">{{ r.member.status }}</span>
          </td>
          <td class="row">
            <template v-if="r.doctor">
              <button v-if="r.doctor.access === 'pending'" class="btn gold sm" @click="actions.setDoctorAccess(r.doctor, 'active')">Grant access</button>
              <button v-else-if="r.doctor.access === 'active' && can.ban(me)" class="btn danger sm" @click="actions.setDoctorAccess(r.doctor, 'banned')">Ban</button>
              <button v-else-if="r.doctor.access === 'banned' && can.ban(me)" class="btn ghost sm" @click="actions.setDoctorAccess(r.doctor, 'active')">Reinstate</button>
            </template>
            <button v-else-if="canToggle(r.member)" class="btn sm" :class="r.member.status === 'active' ? 'danger' : 'ghost'" @click="actions.toggleStaff(r.member)">
              {{ r.member.status === 'active' ? 'Suspend' : 'Give access' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-if="open" class="modal-bg" @click.self="open = false">
    <form class="modal" @submit.prevent="save">
      <h2>Add staff & give access</h2>
      <label>Full name</label><input v-model="form.name" required />
      <label>Portal</label>
      <select v-model="form.role"><option v-for="r in creatable" :key="r" :value="r">{{ roleLabel(r) }}</option></select>
      <label>{{ form.role === 'doctor' ? 'Specialty' : 'Position' }}</label>
      <input v-model="form.position" :placeholder="form.role === 'doctor' ? 'e.g. Dermatology' : 'e.g. Front Desk'" />
      <label>Branch</label>
      <select v-model="form.branch"><option v-for="b in BRANCHES" :key="b">{{ b }}</option></select>
      <label>Phone</label><input v-model="form.phone" placeholder="+251 …" />
      <p class="note" style="margin-top: 12px">A login invite is sent to this number. To make a doctor an Academy teacher, assign them to a course in Academy.</p>
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button type="button" class="btn ghost" @click="open = false">Cancel</button>
        <button class="btn gold">Add & send invite</button>
      </div>
    </form>
  </div>
</template>
