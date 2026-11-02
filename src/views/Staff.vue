<script setup>
import { ref, computed } from 'vue'
import { state, actions, ROLES } from '../store'

const BRANCHES = ['Addis Ababa – Bole', 'Addis Ababa – Kazanchis', 'Hawassa']
const roleLabel = (r) => (r === 'doctor' ? 'Doctor' : ROLES[r].label)
const tab = ref('all')
const open = ref(false)
const blank = () => ({ name: '', role: 'reception', position: '', branch: BRANCHES[0], phone: '' })
const form = ref(blank())

const everyone = computed(() => [
  ...state.doctors.map((d) => ({ key: 'd' + d.id, doctor: d, name: d.name, role: 'doctor', position: d.specialty, branch: d.branch, phone: '—' })),
  ...state.staff.map((m) => ({ key: 's' + m.id, member: m, name: m.name, role: m.role, position: m.position, branch: m.branch, phone: m.phone })),
])
const rows = computed(() => everyone.value.filter((r) => tab.value === 'all' || r.role === tab.value))
const count = (r) => (r === 'all' ? everyone.value.length : everyone.value.filter((x) => x.role === r).length)
const initials = (n) => n.replace('Dr. ', '').split(' ').map((w) => w[0]).join('')

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
      <h1>Staff</h1>
      <p>Everyone who works at Lavish. Doctors listed here appear in the mobile app for clients to book.</p>
    </div>
    <button class="btn gold" @click="open = true">+ Add staff</button>
  </div>

  <div class="tabs">
    <button v-for="t in ['all', 'doctor', 'admin', 'reception', 'cto', 'seller']" :key="t" :class="{ on: tab === t }" @click="tab = t">
      {{ t === 'all' ? 'All' : roleLabel(t) }} · {{ count(t) }}
    </button>
  </div>

  <div class="card">
    <table>
      <thead><tr><th>Name</th><th>Role</th><th>Position / specialty</th><th>Branch</th><th>Contact</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.key">
          <td><span class="mini-avatar">{{ initials(r.name) }}</span>{{ r.name }}</td>
          <td><span class="badge">{{ roleLabel(r.role) }}</span></td>
          <td>{{ r.position }}</td>
          <td>{{ r.branch }}</td>
          <td>{{ r.phone }}</td>
          <td>
            <select v-if="r.doctor" v-model="r.doctor.status" style="width: 130px">
              <option>Available</option><option>In surgery</option><option>Off today</option>
            </select>
            <span v-else class="badge" :class="r.member.status === 'active' ? 'active' : 'declined'">{{ r.member.status }}</span>
          </td>
          <td>
            <button v-if="r.member" class="btn sm" :class="r.member.status === 'active' ? 'danger' : 'ghost'" @click="actions.toggleStaff(r.member)">
              {{ r.member.status === 'active' ? 'Suspend' : 'Reactivate' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-if="open" class="modal-bg" @click.self="open = false">
    <form class="modal" @submit.prevent="save">
      <h2>Add staff member</h2>
      <label>Full name</label><input v-model="form.name" required />
      <label>Role</label>
      <select v-model="form.role">
        <option value="doctor">Doctor</option>
        <option value="reception">Receptionist</option>
        <option value="cto">CTO</option>
        <option value="seller">Medicine Seller</option>
        <option value="admin">Admin</option>
      </select>
      <label>{{ form.role === 'doctor' ? 'Specialty' : 'Position' }}</label>
      <input v-model="form.position" :placeholder="form.role === 'doctor' ? 'e.g. Dermatology' : 'e.g. Front Desk'" />
      <label>Branch</label>
      <select v-model="form.branch"><option v-for="b in BRANCHES" :key="b">{{ b }}</option></select>
      <label>Phone</label><input v-model="form.phone" placeholder="+251 …" />
      <p class="note" style="margin-top: 12px">A login invite is sent to this number and the role's menu is set automatically.</p>
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button type="button" class="btn ghost" @click="open = false">Cancel</button>
        <button class="btn gold">Add & send invite</button>
      </div>
    </form>
  </div>
</template>
