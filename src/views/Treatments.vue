<script setup>
// Treatments clients can book in the app — name, price, length, description, icon and which doctors offer
// each one. Hidden treatments stay in history but disappear from the app. GET/POST/PATCH/DELETE /staff/services
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { etb } from '../fmt'

const auth = useAuth()
const rows = ref([])
const meta = ref({ icons: [], doctors: [] })
const error = ref('')
const form = ref(null)
const q = ref('')
const show = ref('all')

// Preview of the app icon for each Material Symbols name.
const ICON = { spa: '🌿', water_drop: '💧', auto_awesome: '✨', healing: '🩹', vaccines: '💉', face_retouching_natural: '🧖', face: '🙂', self_improvement: '🧘', accessibility_new: '🧍', fitness_center: '🏋️', bolt: '⚡', content_cut: '✂️', science: '🔬', diamond: '💎', favorite: '❤️', medical_services: '🩺', video_call: '📹' }
const ICON_NAME = { spa: 'Leaf (spa)', water_drop: 'Drop', auto_awesome: 'Sparkle', healing: 'Bandage', vaccines: 'Injection', face_retouching_natural: 'Facial', face: 'Face', self_improvement: 'Wellness', accessibility_new: 'Body shape', fitness_center: 'Body', bolt: 'Energy / laser', content_cut: 'Hair', science: 'Science', diamond: 'Premium', favorite: 'Heart', medical_services: 'Medical', video_call: 'Video call' }

const canCreate = computed(() => auth.can('treatments.create'))
const canEdit = computed(() => auth.can('treatments.edit'))
const canDelete = computed(() => auth.can('treatments.delete'))
const shown = computed(() => rows.value
  .filter((s) => show.value === 'all' || (show.value === 'live' ? s.active : !s.active))
  .filter((s) => !q.value || s.name.toLowerCase().includes(q.value.toLowerCase())))
const doctorName = (id) => meta.value.doctors.find((d) => d.id === id)?.name ?? '—'
const mins = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`)

async function load() {
  error.value = ''
  try {
    const res = await api.get('/staff/services')
    rows.value = res.data
    meta.value = res.meta
  } catch (e) {
    error.value = e.message
  }
}
onMounted(load)

const openNew = () => (form.value = { name: '', price: 1000, duration_minutes: 60, description: '', icon: 'spa', active: true, doctor_ids: [], error: '' })
const openEdit = (s) => (form.value = { ...s, description: s.description ?? '', icon: s.icon ?? 'spa', doctor_ids: [...s.doctor_ids], error: '' })
const pick = (id) => {
  const l = form.value.doctor_ids
  l.includes(id) ? l.splice(l.indexOf(id), 1) : l.push(id)
}

async function save() {
  const f = form.value
  const isNew = !f.id
  if (!(await ask({
    title: isNew ? `Add “${f.name}”?` : `Save “${f.name}”?`,
    body: `${etb(f.price)} · ${mins(f.duration_minutes)}${f.doctor_ids.length ? `\nOffered by ${f.doctor_ids.length} doctor${f.doctor_ids.length === 1 ? '' : 's'}` : '\nNo doctor chosen yet — clients can still book and reception assigns one.'}${f.active ? '\nClients see it in the app straight away.' : '\nHidden from the app.'}`,
    ok: isNew ? 'Add treatment' : 'Save',
  }))) return
  const body = { name: f.name.trim(), price: +f.price, duration_minutes: +f.duration_minutes, description: f.description || null, icon: f.icon, active: f.active, doctor_ids: f.doctor_ids }
  try {
    const s = (isNew ? await api.post('/staff/services', body) : await api.patch(`/staff/services/${f.id}`, body)).data
    rows.value = isNew ? [...rows.value, s] : rows.value.map((x) => (x.id === s.id ? s : x))
    form.value = null
    notify(isNew ? 'Treatment added' : 'Treatment saved')
  } catch (e) {
    f.error = e.code === 'validation_failed' ? Object.values(e.errors).flat()[0] : e.message
  }
}

async function toggle(s) {
  if (!(await ask({ title: s.active ? `Hide “${s.name}”?` : `Show “${s.name}” again?`, body: s.active ? 'Clients won’t be able to book it in the app. Existing bookings are not affected.' : 'Clients can book it in the app again.', ok: s.active ? 'Hide' : 'Show', tone: s.active ? 'danger' : 'primary' }))) return
  try {
    const u = (await api.patch(`/staff/services/${s.id}`, { active: !s.active })).data
    rows.value = rows.value.map((x) => (x.id === u.id ? u : x))
  } catch (e) {
    notify(e.message)
  }
}

async function remove(s) {
  if (!(await ask({ title: `Delete “${s.name}”?`, body: 'This removes it completely. Treatments that were ever booked can only be hidden.', ok: 'Delete', tone: 'danger' }))) return
  try {
    await api.delete(`/staff/services/${s.id}`)
    rows.value = rows.value.filter((x) => x.id !== s.id)
    notify('Treatment removed')
  } catch (e) {
    notify(e.message)
  }
}
</script>

<template>
  <div class="head">
    <div>
      <h1>Treatments</h1>
      <p>What clients can book in the app — price, length and which doctors offer each treatment. Hidden treatments stay in past bookings but can’t be booked.</p>
    </div>
    <button v-if="canCreate" class="btn gold" @click="openNew">+ Add treatment</button>
  </div>
  <p v-if="error" class="err">{{ error }}</p>

  <div class="row" style="gap: 8px; margin-bottom: 12px">
    <div class="tabs" style="margin: 0">
      <button v-for="[k, l] in [['all', 'All'], ['live', 'In the app'], ['hidden', 'Hidden']]" :key="k" :class="{ on: show === k }" @click="show = k">{{ l }}</button>
    </div>
    <input v-model="q" placeholder="Search treatments" style="max-width: 260px; margin-left: auto" />
  </div>

  <div class="card">
    <table>
      <thead><tr><th>Treatment</th><th>Price</th><th>Length</th><th>Doctors</th><th>Bookings</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="s in shown" :key="s.id" :class="{ off: !s.active }">
          <td>
            <span class="ic">{{ ICON[s.icon] ?? '🌿' }}</span><b>{{ s.name }}</b>
            <small>{{ s.is_online ? 'Video call from home · ' : '' }}{{ s.description || 'No description yet' }}</small>
          </td>
          <td><b>{{ etb(s.price) }}</b></td>
          <td>{{ mins(s.duration_minutes) }}</td>
          <td>
            <template v-if="s.doctor_ids.length">{{ s.doctor_ids.slice(0, 2).map(doctorName).join(', ') }}<small v-if="s.doctor_ids.length > 2">+{{ s.doctor_ids.length - 2 }} more</small></template>
            <span v-else class="note">{{ s.is_online ? 'Any doctor' : 'Reception assigns' }}</span>
          </td>
          <td>{{ s.bookings }}</td>
          <td><span class="badge" :class="s.active ? 'paid' : 'cancelled'">{{ s.active ? 'In the app' : 'Hidden' }}</span></td>
          <td class="acts">
            <button v-if="canEdit" class="btn ghost sm" @click="openEdit(s)">Edit</button>
            <button v-if="canEdit" class="btn sm" :class="s.active ? 'ghost' : 'gold'" @click="toggle(s)">{{ s.active ? 'Hide' : 'Show' }}</button>
            <button v-if="canDelete && !s.bookings && !s.is_online" class="btn danger sm" @click="remove(s)">Delete</button>
          </td>
        </tr>
        <tr v-if="!shown.length"><td colspan="7" class="empty">{{ q ? 'No treatments match' : 'No treatments yet' }}</td></tr>
      </tbody>
    </table>
  </div>

  <div v-if="form" class="modal-bg" @click.self="form = null">
    <form class="modal" style="width: min(640px, 95vw); max-height: 92vh; overflow: auto" @submit.prevent="save">
      <h2>{{ form.id ? 'Edit treatment' : 'New treatment' }}</h2>
      <label>Name (shown in the app)</label>
      <input v-model="form.name" required maxlength="120" placeholder="e.g. Lavish Glow Peel" />
      <div class="grid g2">
        <div><label>Price (ETB)</label><input v-model.number="form.price" type="number" min="0" step="50" required /></div>
        <div><label>Length (minutes)</label><input v-model.number="form.duration_minutes" type="number" min="15" max="600" step="15" required /></div>
      </div>
      <label>Description <small class="note">(shown when clients book)</small></label>
      <textarea v-model="form.description" rows="3" maxlength="2000" placeholder="What it does, who it’s for, how long results last…"></textarea>
      <label>Icon in the app</label>
      <div class="icons">
        <button v-for="i in meta.icons" :key="i" type="button" :class="{ on: form.icon === i }" :title="ICON_NAME[i] ?? i" @click="form.icon = i">{{ ICON[i] ?? '•' }}</button>
      </div>
      <label>Doctors who offer it <small class="note">(clients can pick one of them; none = reception assigns)</small></label>
      <div class="pills">
        <button v-for="d in meta.doctors" :key="d.id" type="button" :class="{ on: form.doctor_ids.includes(d.id) }" @click="pick(d.id)">{{ d.name }}<small v-if="d.specialty"> · {{ d.specialty }}</small></button>
        <span v-if="!meta.doctors.length" class="note">No doctors yet — add them on the Staff page.</span>
      </div>
      <label class="chk"><input v-model="form.active" type="checkbox" /> Show in the app (clients can book it)</label>
      <p v-if="form.error" class="err">{{ form.error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 16px">
        <button type="button" class="btn ghost" @click="form = null">Cancel</button>
        <button class="btn gold">{{ form.id ? 'Save' : 'Add treatment' }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
td small { display: block; color: var(--muted); font-size: 12px; max-width: 380px; }
tr.off td { opacity: .6; }
td:nth-child(2), td:nth-child(3) { white-space: nowrap; }
td .badge { white-space: nowrap; text-transform: none; }
.ic { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--mint); margin-right: 10px; vertical-align: middle; font-size: 15px; }
.acts { text-align: right; white-space: nowrap; }
.acts .btn + .btn { margin-left: 6px; }
label { display: block; font-size: 13px; margin: 12px 0 5px; }
textarea { width: 100%; }
.icons { display: flex; flex-wrap: wrap; gap: 6px; }
.icons button { width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid var(--line); background: #fff; font-size: 18px; cursor: pointer; }
.icons button.on { border-color: var(--dark); background: #e8f3f2; }
.pills { display: flex; flex-wrap: wrap; gap: 6px; }
.pills button { padding: 6px 12px; border-radius: 99px; border: 1px solid var(--line); background: #fff; font-size: 13px; cursor: pointer; }
.pills button.on { border-color: var(--dark); background: #e8f3f2; color: var(--teal-deep); }
.pills small { color: var(--muted); }
.chk { display: flex; gap: 8px; align-items: center; margin-top: 16px; }
.chk input { width: auto; }
.err { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: #fdecea; color: #b3261e; font-size: 13px; }
</style>
