<script setup>
import { ref, computed } from 'vue'
import { state, actions, courseTitle, clientName, doctorClashes, CLASS_MINS, can } from '../store'

const me = state.user.doctorId
const myCourses = computed(() => state.courses.filter((c) => c.teacherIds.includes(me)))
const rows = computed(() =>
  state.sessions.filter((s) => myCourses.value.some((c) => c.id === s.courseId)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)))
const students = (courseId) => state.students.filter((s) => s.courseId === courseId && s.status === 'active').length
const open = ref(false)
const blank = () => ({ courseId: myCourses.value[0]?.id, title: '', kind: 'Practical', date: new Date(Date.now() + 864e5).toISOString().slice(0, 10), time: '10:00', room: 'Bole training room' })
const form = ref(blank())
// A teacher is also a doctor — a class can't overlap treatments reception already approved.
const busy = computed(() => doctorClashes(me, form.value.date, form.value.time, CLASS_MINS))
const treatments = computed(() => state.appointments.filter((a) => a.doctorId === me && a.status === 'approved' && a.date >= new Date().toISOString().slice(0, 10))
  .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)))
function save() {
  if (!form.value.title.trim() || busy.value.length) return
  actions.addSession({ ...form.value, teacherId: me })
  form.value = blank()
  open.value = false
}
</script>

<template>
  <div class="head">
    <div>
      <h1>Schedule</h1>
      <p>Classes for the courses you teach. Students see these in the mobile app and get a reminder. Reception sees your classes too, so no treatment is booked over them.</p>
    </div>
    <button v-if="can('academy.teach')" class="btn gold" @click="open = true">+ Add class</button>
  </div>

  <div class="card">
    <table>
      <thead><tr><th>When</th><th>Class</th><th>Course</th><th>Type</th><th>Where</th><th>Students</th></tr></thead>
      <tbody>
        <tr v-for="s in rows" :key="s.id">
          <td><b>{{ s.date }}</b><small>{{ s.time }}</small></td>
          <td>{{ s.title }}<small v-if="s.teacherId !== me">Co-teacher session</small></td>
          <td>{{ courseTitle(s.courseId) }}</td>
          <td><span class="badge" :class="s.kind === 'Practical' ? 'pending' : ''">{{ s.kind }}</span></td>
          <td>{{ s.room }}</td>
          <td>{{ students(s.courseId) }}</td>
        </tr>
        <tr v-if="!rows.length"><td colspan="6" class="empty">No classes scheduled</td></tr>
      </tbody>
    </table>
  </div>

  <div class="card" style="margin-top: 16px">
    <h2>Your upcoming treatments</h2>
    <p class="note">Approved by reception — plan classes around these.</p>
    <table style="margin-top: 8px">
      <tbody>
        <tr v-for="a in treatments" :key="a.id">
          <td><b>{{ a.date }}</b><small>{{ a.time }}</small></td>
          <td>{{ clientName(a.clientId) }}</td>
          <td>{{ a.service }}</td>
        </tr>
        <tr v-if="!treatments.length"><td colspan="3" class="empty">No upcoming treatments</td></tr>
      </tbody>
    </table>
  </div>

  <div v-if="open" class="modal-bg" @click.self="open = false">
    <form class="modal" @submit.prevent="save">
      <h2>Add class</h2>
      <label>Course</label><select v-model.number="form.courseId"><option v-for="c in myCourses" :key="c.id" :value="c.id">{{ c.title }}</option></select>
      <label>Title</label><input v-model="form.title" required placeholder="e.g. Chemical peels — practical" />
      <label>Type</label><select v-model="form.kind"><option>Practical</option><option>Theory</option><option>Exam</option></select>
      <div class="qgrid">
        <div><label>Date</label><input v-model="form.date" type="date" /></div>
        <div><label>Time</label><input v-model="form.time" type="time" /></div>
      </div>
      <p v-for="c in busy" :key="c.text" class="note" style="color: var(--bad); margin-top: 8px">⚠ Clashes with: {{ c.text }}</p>
      <label>Room or link</label><input v-model="form.room" />
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button type="button" class="btn ghost" @click="open = false">Cancel</button>
        <button class="btn gold" :disabled="busy.length">Add & notify students</button>
      </div>
    </form>
  </div>
</template>
