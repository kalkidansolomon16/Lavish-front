<script setup>
// Staff & access — GET /staff/members. New accounts get a temporary password (shown once) that the person
// replaces at first sign-in. Doctors need portal access to appear in the app; their treatments decide what they can be booked for.
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { day } from '../fmt'
import PhoneInput from '../components/PhoneInput.vue'
import Pager from '../components/Pager.vue'

const auth = useAuth()
const ROLE = { ceo: 'CEO', gm: 'General Manager', reception: 'Receptionist', ecommerce: 'E-commerce', doctor: 'Doctor', nurse: 'Nurse', teacher: 'Lavish Academy' }
const AVAIL = [['available', 'Available'], ['in_surgery', 'In surgery'], ['off_today', 'Off today'], ['on_leave', 'On leave']]
const rows = ref([])
const meta = ref({ creatable_roles: [] })
const branches = ref([])
const services = ref([])
const tab = ref('all')
const error = ref('')
const form = ref(null)
const editing = ref(null)
const secret = ref(null) // { name, phone, password }

async function load() {
  try {
    const res = await api.get('/staff/members')
    rows.value = res.data
    meta.value = res.meta
  } catch (e) {
    error.value = e.message
  }
}
onMounted(async () => {
  load()
  const [b, s] = await Promise.all([api.get('/catalog/branches'), api.get('/catalog/services')])
  branches.value = b.data
  services.value = s.data
})

const roleOf = (m) => m.roles?.[0]?.key
const roles = (m) => m.roles?.map((r) => r.key) ?? []
const shown = computed(() => rows.value.filter((m) => tab.value === 'all' || roles(m).includes(tab.value)))
const count = (r) => (r === 'all' ? rows.value.length : rows.value.filter((m) => roles(m).includes(r)).length)
const initials = (n) => n.replace('Dr. ', '').split(' ').map((w) => w[0]).join('').slice(0, 2)
const pendingDocs = computed(() => rows.value.filter((m) => m.doctor?.access === 'pending'))
const isMe = (m) => m.id === auth.user?.id
const below = (m) => (m.level ?? 0) > (auth.user?.level ?? 0)
const canToggle = (m) => !isMe(m) && below(m) && auth.can(m.status === 'active' ? 'staff.suspend' : 'staff.edit')
const replace = (m) => { const i = rows.value.findIndex((x) => x.id === m.id); i >= 0 ? (rows.value[i] = m) : rows.value.push(m) }

function openNew() {
  form.value = { name: '', phone: '', email: '', role: meta.value.creatable_roles.includes('doctor') ? 'doctor' : meta.value.creatable_roles[0], position: '', branch_id: branches.value.find((b) => b.is_main)?.id ?? null, service_ids: [], error: '' }
}
async function save() {
  const f = form.value
  const name = (f.role === 'doctor' && !/^dr\.?\s/i.test(f.name.trim()) ? 'Dr. ' : '') + f.name.trim()
  if (!(await ask({ title: `Add ${name}?`, body: `${ROLE[f.role]} · ${f.phone}\nA temporary password is created — you’ll see it once to give to them.${f.role === 'doctor' && !auth.can('doctors.grant') ? '\nA manager must then give the doctor portal access.' : ''}`, ok: 'Add staff' }))) return
  try {
    const res = (await api.post('/staff/members', { ...f, name, email: f.email || null, service_ids: f.role === 'doctor' ? f.service_ids : undefined })).data
    replace(res.member)
    form.value = null
    secret.value = { name: res.member.name, phone: res.member.phone, password: res.temporary_password }
  } catch (e) {
    f.error = e.message
  }
}
async function resetPassword(m) {
  if (!(await ask({ title: `Reset ${m.name}’s password?`, body: 'Their current password stops working. You’ll see a new temporary password once.', ok: 'Reset password', tone: 'danger' }))) return
  try {
    const res = (await api.post(`/staff/members/${m.id}/reset-password`)).data
    secret.value = { name: m.name, phone: m.phone, password: res.temporary_password }
  } catch (e) {
    notify(e.message)
  }
}
async function setAccess(m, access, reinstating = false) {
  const d = m.doctor
  const ban = access === 'banned'
  if (!(await ask(ban
    ? { title: `Ban ${d.name}?`, body: 'They lose portal access and stop appearing in the app for bookings.', ok: 'Ban doctor', tone: 'danger' }
    : { title: reinstating ? `Reinstate ${d.name}?` : `Grant access to ${d.name}?`, body: 'They can sign in and clients can book them in the app.', ok: reinstating ? 'Reinstate' : 'Grant access' }))) return
  try {
    m.doctor = (await api.post(`/staff/doctors/${d.id}/access`, { access })).data
    notify('Access updated')
  } catch (e) {
    notify(e.message)
  }
}
async function toggle(m) {
  const suspend = m.status === 'active'
  if (!(await ask(suspend
    ? { title: `Suspend ${m.name}?`, body: 'They are signed out and can’t use the portal until access is given back.', ok: 'Suspend', tone: 'danger' }
    : { title: `Give access to ${m.name}?`, body: 'They can sign in to the portal again.', ok: 'Give access' }))) return
  try {
    replace((await api.post(`/staff/members/${m.id}/status`, { status: suspend ? 'suspended' : 'active' })).data)
  } catch (e) {
    notify(e.message)
  }
}
async function setAvailability(m, value) {
  try {
    m.doctor = (await api.patch(`/staff/doctors/${m.doctor.id}`, { availability: value })).data
  } catch (e) {
    notify(e.message)
  }
}
function openEdit(m) {
  const d = m.doctor
  editing.value = { m, name: m.name, email: m.email ?? '', position: m.position ?? '', branch_id: m.branch?.id ?? null,
    doctor: d && { specialty: d.specialty, years_experience: d.years_experience, bio: d.bio ?? '', working_days: d.working_days ?? '', service_ids: (d.services ?? []).map((s) => s.id) }, error: '' }
}
async function saveEdit() {
  const e = editing.value
  if (!(await ask({ title: `Save ${e.m.name}?`, ok: 'Save' }))) return
  try {
    let m = e.m
    if (!isMe(m)) m = (await api.patch(`/staff/members/${m.id}`, { name: e.name, email: e.email || null, position: e.position || null, branch_id: e.branch_id })).data
    if (e.doctor) m = { ...m, doctor: (await api.patch(`/staff/doctors/${e.m.doctor.id}`, { ...e.doctor, branch_id: e.branch_id })).data }
    replace(m)
    editing.value = null
    notify('Saved')
  } catch (err) {
    e.error = err.message
  }
}
const pick = (list, id) => (list.includes(id) ? list.splice(list.indexOf(id), 1) : list.push(id))
const copy = () => { navigator.clipboard?.writeText(secret.value.password); notify('Password copied') }
// Shown 25 at a time.
const localPage = ref(1)
const PER = 25
const pageRows = computed(() => shown.value.slice((localPage.value - 1) * PER, localPage.value * PER))
const localMeta = computed(() => ({ current_page: localPage.value, last_page: Math.max(1, Math.ceil(shown.value.length / PER)), per_page: PER, total: shown.value.length }))
watch(() => shown.value.length, () => { if (localPage.value > localMeta.value.last_page) localPage.value = 1 })
</script>

<template>
  <div class="head">
    <div>
      <h1>{{ auth.portal?.key === 'gm' ? 'Staff · HR' : 'Staff & access' }}</h1>
      <p>Everyone who works at Lavish. Doctors with access appear in the mobile app for clients to book.</p>
    </div>
    <button v-if="meta.creatable_roles.length" class="btn gold" @click="openNew">+ Add & give access</button>
  </div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>

  <div v-if="pendingDocs.length && auth.can('doctors.grant')" class="card assign-banner">
    <div>
      <b class="serif" style="font-size: 20px">{{ pendingDocs.length }} doctor(s) waiting for access</b>
      <p class="note">They can’t sign in or receive bookings until access is granted.</p>
    </div>
    <div class="row"><button v-for="m in pendingDocs" :key="m.id" class="btn gold sm" @click="setAccess(m, 'active')">✓ Grant {{ m.name }}</button></div>
  </div>

  <div class="tabs">
    <button v-for="t in ['all', 'doctor', 'nurse', 'ceo', 'gm', 'reception', 'ecommerce', 'teacher']" :key="t" :class="{ on: tab === t }" @click="tab = t">{{ t === 'all' ? 'All' : ROLE[t] }} · {{ count(t) }}</button>
  </div>

  <div class="card">
    <table>
      <thead><tr><th>Name</th><th>Role</th><th>Position / specialty</th><th>Branch</th><th>Contact</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="m in pageRows" :key="m.id">
          <td><span class="mini-avatar">{{ initials(m.name) }}</span>{{ m.name }}<small v-if="!m.activated">Hasn’t signed in yet</small></td>
          <td>
            <span v-for="r in m.roles" :key="r.key" class="badge" style="margin-right: 4px">{{ r.label }}</span>
            <small v-if="m.doctor?.teaches?.length">🎓 Teaches {{ m.doctor.teaches.map((c) => c.title).join(', ') }}</small>
          </td>
          <td>{{ m.doctor?.specialty ?? m.position ?? '—' }}<small v-if="m.doctor">{{ m.doctor.services?.length ?? 0 }} treatment(s)</small></td>
          <td>{{ m.branch?.name ?? '—' }}</td>
          <td>{{ m.phone }}<small v-if="m.email">{{ m.email }}</small></td>
          <td>
            <template v-if="m.doctor">
              <select v-if="m.doctor.access === 'active'" :value="m.doctor.availability.value" :disabled="!auth.can('doctors.grant') && !isMe(m)" style="width: 130px" @change="setAvailability(m, $event.target.value)">
                <option v-for="[k, l] in AVAIL" :key="k" :value="k">{{ l }}</option>
              </select>
              <span v-else class="badge" :class="m.doctor.access === 'banned' ? 'declined' : 'pending'">{{ m.doctor.access === 'banned' ? 'banned' : 'no access yet' }}</span>
            </template>
            <span v-else class="badge" :class="m.status === 'active' ? 'active' : 'declined'">{{ m.status }}</span>
          </td>
          <td class="row" style="justify-content: flex-end">
            <template v-if="m.doctor && !isMe(m)">
              <button v-if="m.doctor.access === 'pending' && auth.can('doctors.grant')" class="btn gold sm" @click="setAccess(m, 'active')">Grant access</button>
              <button v-else-if="m.doctor.access === 'active' && auth.can('doctors.ban')" class="btn danger sm" @click="setAccess(m, 'banned')">Ban</button>
              <button v-else-if="m.doctor.access === 'banned' && auth.can('doctors.ban')" class="btn ghost sm" @click="setAccess(m, 'active', true)">Reinstate</button>
            </template>
            <button v-else-if="canToggle(m)" class="btn sm" :class="m.status === 'active' ? 'danger' : 'ghost'" @click="toggle(m)">{{ m.status === 'active' ? 'Suspend' : 'Give access' }}</button>
            <button v-if="(auth.can('staff.edit') && below(m)) || (m.doctor && (auth.can('doctors.grant') || isMe(m)))" class="btn ghost sm" @click="openEdit(m)">Edit</button>
            <button v-if="auth.can('staff.password') && below(m)" class="btn ghost sm" @click="resetPassword(m)">Reset password</button>
          </td>
        </tr>
        <tr v-if="!shown.length"><td colspan="7" class="empty">Nobody here yet</td></tr>
      </tbody>
    </table>
    <Pager :meta="localMeta" label="people" @go="(n) => (localPage = n)" />
  </div>

  <div v-if="form" class="modal-bg" @click.self="form = null">
    <form class="modal" style="width: min(600px, 95vw); max-height: 92vh; overflow: auto" @submit.prevent="save">
      <h2>Add staff & give access</h2>
      <label>Full name</label><input v-model="form.name" required />
      <div class="qgrid">
        <div><label>Portal</label><select v-model="form.role"><option v-for="r in meta.creatable_roles" :key="r" :value="r">{{ ROLE[r] }}</option></select></div>
        <div><label>{{ form.role === 'doctor' ? 'Specialty' : 'Position' }}</label><input v-model="form.position" :placeholder="form.role === 'doctor' ? 'e.g. Dermatology' : 'e.g. Front Desk'" /></div>
        <div><label>Phone (their login)</label><PhoneInput v-model="form.phone" required /></div>
        <div><label>Email (optional — can also log in with it)</label><input v-model="form.email" type="email" /></div>
        <div><label>Branch</label><select v-model.number="form.branch_id"><option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option></select></div>
      </div>
      <template v-if="form.role === 'doctor'">
        <label>Treatments this doctor gives (clients can book them for these)</label>
        <div class="pills"><button v-for="s in services" :key="s.id" type="button" :class="{ on: form.service_ids.includes(s.id) }" @click="pick(form.service_ids, s.id)">{{ s.name }}</button></div>
      </template>
      <p class="note" style="margin-top: 12px">Everyone sees Lavish Team (their groups and announcements). To make a doctor an Academy teacher, assign them to a course in Academy.</p>
      <p v-if="form.error" class="note" style="color: var(--bad)">{{ form.error }}</p>
      <div class="row" style="margin-top: 18px; justify-content: flex-end"><button type="button" class="btn ghost" @click="form = null">Cancel</button><button class="btn gold">Add staff</button></div>
    </form>
  </div>

  <div v-if="editing" class="modal-bg" @click.self="editing = null">
    <form class="modal" style="width: min(600px, 95vw); max-height: 92vh; overflow: auto" @submit.prevent="saveEdit">
      <h2>{{ editing.m.name }}</h2>
      <template v-if="!isMe(editing.m) && auth.can('staff.edit')">
        <label>Name</label><input v-model="editing.name" required />
        <div class="qgrid">
          <div><label>Email</label><input v-model="editing.email" type="email" /></div>
          <div v-if="!editing.doctor"><label>Position</label><input v-model="editing.position" /></div>
        </div>
      </template>
      <label>Branch</label><select v-model.number="editing.branch_id"><option :value="null">—</option><option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option></select>
      <template v-if="editing.doctor">
        <div class="qgrid">
          <div><label>Specialty</label><input v-model="editing.doctor.specialty" :disabled="!auth.can('doctors.grant')" /></div>
          <div><label>Years of experience</label><input v-model.number="editing.doctor.years_experience" type="number" min="0" :disabled="!auth.can('doctors.grant')" /></div>
          <div><label>Working days</label><input v-model="editing.doctor.working_days" placeholder="e.g. Mon – Sat" /></div>
        </div>
        <label>Bio (shown in the app)</label><textarea v-model="editing.doctor.bio" rows="3"></textarea>
        <template v-if="auth.can('doctors.grant')">
          <label>Treatments</label>
          <div class="pills"><button v-for="s in services" :key="s.id" type="button" :class="{ on: editing.doctor.service_ids.includes(s.id) }" @click="pick(editing.doctor.service_ids, s.id)">{{ s.name }}</button></div>
        </template>
      </template>
      <p v-if="editing.error" class="note" style="color: var(--bad)">{{ editing.error }}</p>
      <div class="row" style="margin-top: 18px; justify-content: flex-end"><button type="button" class="btn ghost" @click="editing = null">Cancel</button><button class="btn gold">Save</button></div>
    </form>
  </div>

  <div v-if="secret" class="modal-bg">
    <div class="modal" style="text-align: center">
      <h2>Give this login to {{ secret.name }}</h2>
      <p class="note">Shown only once. They sign in at the web portal with their phone and this password, then choose their own.</p>
      <div class="card" style="background: var(--bg); margin: 14px 0">
        <p class="note">Phone</p><p style="font-size: 18px">{{ secret.phone }}</p>
        <p class="note" style="margin-top: 8px">Temporary password</p><p style="font: 600 24px ui-monospace, monospace; letter-spacing: 2px">{{ secret.password }}</p>
      </div>
      <div class="row" style="justify-content: center; gap: 8px"><button class="btn ghost" @click="copy">Copy password</button><button class="btn gold" @click="secret = null">Done</button></div>
    </div>
  </div>
</template>

<style scoped>
td small { display: block; color: var(--muted); font-size: 12px; }
label { display: block; font-size: 13px; margin: 10px 0 4px; }
textarea { width: 100%; }
.pills { display: flex; flex-wrap: wrap; gap: 6px; }
.pills button { padding: 5px 11px; border-radius: 99px; border: 1px solid var(--line); background: #fff; font-size: 12.5px; cursor: pointer; }
.pills button.on { border-color: var(--dark); background: #e8f3f2; color: var(--teal-deep); }
</style>
