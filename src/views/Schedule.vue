<script setup>
// Class schedule (teachers) — GET /staff/teaching/sessions. Students see classes in the app and get a reminder;
// reception sees them on the appointments calendar, so no treatment is booked over a class.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { day } from '../fmt'

const auth = useAuth()
const sessions = ref([])
const courses = ref([])
const treatments = ref([])
const error = ref('')
const form = ref(null)
const clashes = ref([])

async function load() {
  try {
    const [s, c] = await Promise.all([api.get('/staff/teaching/sessions'), api.get('/staff/teaching/courses')])
    sessions.value = s.data
    courses.value = c.data
    if (auth.can('page.appointments')) {
      treatments.value = (await api.get('/staff/appointments', { status: 'approved', from: new Date().toISOString().slice(0, 10), sort: 'asc', per_page: 20 }).catch(() => ({ data: [] }))).data
    }
  } catch (e) {
    error.value = e.message
  }
}
onMounted(load)
const tomorrow = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10)
const openNew = () => { clashes.value = []; form.value = { course_id: courses.value[0]?.id, title: '', kind: 'Practical', date: tomorrow(), time: '10:00', duration_minutes: 120, room: '' } }
async function save() {
  const f = form.value
  const c = courses.value.find((x) => x.id === f.course_id)
  if (!(await ask({ title: 'Add this class?', body: `${f.title.trim()} · ${c?.title}\n${f.date} at ${f.time} (${f.duration_minutes} min)${f.room ? ' · ' + f.room : ''}\nStudents are notified.`, ok: 'Add class' }))) return
  clashes.value = []
  try {
    sessions.value.push((await api.post('/staff/teaching/sessions', { ...f, title: f.title.trim(), room: f.room || null })).data)
    sessions.value.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    form.value = null
    notify('Class added — students notified')
  } catch (e) {
    if (e.details?.clashes) clashes.value = e.details.clashes
    else notify(e.message)
  }
}
async function remove(s) {
  if (!(await ask({ title: 'Cancel this class?', body: `${s.title} · ${s.date} at ${s.time}\nStudents are told it’s cancelled.`, ok: 'Cancel class', tone: 'danger' }))) return
  try {
    await api.delete(`/staff/teaching/sessions/${s.id}`)
    sessions.value = sessions.value.filter((x) => x.id !== s.id)
  } catch (e) {
    notify(e.message)
  }
}
const enrolled = (courseId) => courses.value.find((c) => c.id === courseId)?.enrollments_count ?? 0
const mine = (s) => s.teacher?.id === auth.user?.doctor_id
</script>

<template>
  <div class="head">
    <div>
      <h1>Schedule</h1>
      <p>Classes for the courses you teach. Students see these in the mobile app and get a reminder. Reception sees your classes too, so no treatment is booked over them.</p>
    </div>
    <button v-if="auth.can('academy.teach') && courses.length" class="btn gold" @click="openNew">+ Add class</button>
  </div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>

  <div class="card">
    <table>
      <thead><tr><th>When</th><th>Class</th><th>Course</th><th>Type</th><th>Where</th><th>Students</th><th></th></tr></thead>
      <tbody>
        <tr v-for="s in sessions" :key="s.id">
          <td><b>{{ day(s.date) }}</b><small>{{ s.time }}</small></td>
          <td>{{ s.title }}<small v-if="!mine(s)">With {{ s.teacher?.name }}</small></td>
          <td>{{ s.course?.title }}</td>
          <td><span class="badge" :class="s.kind === 'Practical' ? 'pending' : ''">{{ s.kind }}</span></td>
          <td>{{ s.room ?? '—' }}</td>
          <td>{{ enrolled(s.course?.id) }}</td>
          <td><button v-if="mine(s)" class="btn ghost sm" @click="remove(s)">Cancel</button></td>
        </tr>
        <tr v-if="!sessions.length"><td colspan="7" class="empty">{{ courses.length ? 'No classes scheduled' : 'You are not assigned to a course yet — the General Manager gives teacher access in Academy.' }}</td></tr>
      </tbody>
    </table>
  </div>

  <div v-if="auth.can('page.appointments')" class="card" style="margin-top: 16px">
    <h2>Your upcoming treatments</h2>
    <p class="note">Approved by reception — plan classes around these.</p>
    <table style="margin-top: 8px">
      <tbody>
        <tr v-for="a in treatments" :key="a.id">
          <td><b>{{ day(a.date) }}</b><small>{{ a.time }}</small></td>
          <td>{{ a.client?.name }}</td>
          <td>{{ a.is_online ? 'Online consultation' : a.service?.name }}</td>
        </tr>
        <tr v-if="!treatments.length"><td colspan="3" class="empty">No upcoming treatments</td></tr>
      </tbody>
    </table>
  </div>

  <div v-if="form" class="modal-bg" @click.self="form = null">
    <form class="modal" @submit.prevent="save">
      <h2>Add class</h2>
      <label>Course</label><select v-model.number="form.course_id"><option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}</option></select>
      <label>Title</label><input v-model="form.title" required placeholder="e.g. Chemical peels — practical" />
      <div class="qgrid">
        <div><label>Type</label><select v-model="form.kind"><option>Practical</option><option>Theory</option><option>Exam</option></select></div>
        <div><label>Length (minutes)</label><input v-model.number="form.duration_minutes" type="number" min="15" max="480" step="15" /></div>
        <div><label>Date</label><input v-model="form.date" type="date" :min="new Date().toISOString().slice(0, 10)" required /></div>
        <div><label>Time</label><input v-model="form.time" type="time" required /></div>
      </div>
      <p v-for="c in clashes" :key="c.kind + c.id" class="note" style="color: var(--bad); margin-top: 8px">⚠ Clashes with: {{ c.text }}</p>
      <label>Room or link</label><input v-model="form.room" placeholder="e.g. Addis Ababa training room" />
      <div class="row" style="margin-top: 18px; justify-content: flex-end"><button type="button" class="btn ghost" @click="form = null">Cancel</button><button class="btn gold">Add & notify students</button></div>
    </form>
  </div>
</template>

<style scoped>
td small { display: block; color: var(--muted); font-size: 12px; }
label { display: block; font-size: 13px; margin: 10px 0 4px; }
</style>
