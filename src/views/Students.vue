<script setup>
// My students (teachers) — GET /staff/teaching/students: progress, exercises to grade and chat
// (the enrolment's student_teacher conversation, which the student opens from the mobile app).
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api/http'
import { ask } from '../confirm'
import { notify } from '../store'
import { when } from '../fmt'
import ChatThread from '../components/ChatThread.vue'

const list = ref([])
const sel = ref(null)
const subs = ref([])
const pane = ref('chat')
const error = ref('')
const s = computed(() => list.value.find((e) => e.id === sel.value))
const initials = (n) => (n ?? '').split(' ').map((w) => w[0]).join('').slice(0, 2)

onMounted(async () => {
  try {
    list.value = (await api.get('/staff/teaching/students')).data
    sel.value = list.value[0]?.id ?? null
  } catch (e) {
    error.value = e.message
  }
})
watch(sel, async (id) => {
  subs.value = []
  if (id) subs.value = (await api.get('/staff/teaching/submissions', { enrollment_id: id }).catch(() => ({ data: [] }))).data
})

async function changeProgress(e, ev) {
  const v = +ev.target.value
  if (!(await ask({ title: 'Update progress?', body: `${e.student.name}: ${e.progress}% → ${v}%${v === 100 ? '\nThe course is marked completed — the certificate can then be issued.' : ''}`, ok: 'Update' }))) { ev.target.value = e.progress; return }
  try {
    Object.assign(e, (await api.put(`/staff/teaching/enrollments/${e.id}/progress`, { progress: v })).data)
  } catch (err) {
    ev.target.value = e.progress
    notify(err.message)
  }
}
const grading = ref(null)
async function grade() {
  const g = grading.value
  if (!(await ask({ title: g.status === 'graded' ? 'Save this grade?' : 'Return for changes?', body: `${g.sub.module?.exercise_title ?? g.sub.module?.title}${g.grade ? ' · ' + g.grade : ''}\nThe student is notified in the app.`, ok: g.status === 'graded' ? 'Save grade' : 'Return' }))) return
  try {
    const u = (await api.post(`/staff/teaching/submissions/${g.sub.id}/grade`, { status: g.status, grade: g.grade || null, feedback: g.feedback || null })).data
    subs.value = subs.value.map((x) => (x.id === u.id ? u : x))
    grading.value = null
  } catch (e) {
    notify(e.message)
  }
}
</script>

<template>
  <div class="head">
    <div>
      <h1>My students</h1>
      <p>Students enrolled in the courses you teach. Track progress, grade exercises and answer questions — they chat with you from the mobile app.</p>
    </div>
  </div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>

  <div class="chat2">
    <aside class="c-list">
      <button v-for="x in list" :key="x.id" :class="{ on: x.id === sel }" @click="sel = x.id; x.unread = 0">
        <span class="av">{{ initials(x.student?.name) }}<i></i></span>
        <span class="who"><b>{{ x.student?.name }}</b><small>{{ x.course?.title }} · {{ x.progress }}%</small></span>
        <span class="meta"><span v-if="x.unread" class="count">{{ x.unread }}</span></span>
      </button>
      <p v-if="!list.length" class="empty">No students yet</p>
    </aside>

    <section v-if="s" class="c-pane">
      <header class="c-head" style="flex-wrap: wrap">
        <span class="av lg">{{ initials(s.student?.name) }}<i></i></span>
        <div><b class="serif">{{ s.student?.name }}</b><small>{{ s.student?.phone }} · {{ s.course?.title }} · <span class="badge" :class="s.status">{{ s.status }}</span></small></div>
        <div class="row" style="margin-left: auto; align-items: center">
          <label style="margin: 0; white-space: nowrap; font-size: 13px">Progress {{ s.progress }}%</label>
          <input type="range" min="0" max="100" step="5" :value="s.progress" style="padding: 0; width: 160px" @change="changeProgress(s, $event)" />
        </div>
        <div class="tabs" style="margin: 8px 0 0; width: 100%"><button :class="{ on: pane === 'chat' }" @click="pane = 'chat'">Chat</button><button :class="{ on: pane === 'work' }" @click="pane = 'work'">Exercises · {{ subs.length }}</button></div>
      </header>
      <ChatThread v-if="pane === 'chat' && s.conversation_id" :id="s.conversation_id" placeholder="Reply to your student…" />
      <p v-else-if="pane === 'chat'" class="empty">No chat for this enrolment yet.</p>
      <div v-else class="c-msgs" style="gap: 10px">
        <div v-for="x in subs" :key="x.id" class="card">
          <div class="row" style="justify-content: space-between"><b>Week {{ x.module?.week }} · {{ x.module?.exercise_title ?? x.module?.title }}</b><span class="badge" :class="x.status === 'graded' ? 'active' : x.status === 'returned' ? 'declined' : 'pending'">{{ x.status }}{{ x.grade ? ' · ' + x.grade : '' }}</span></div>
          <small class="note">Submitted {{ when(x.submitted_at) }}</small>
          <p v-if="x.body" style="margin: 8px 0; white-space: pre-line">{{ x.body }}</p>
          <div class="row" style="gap: 8px"><a v-for="a in x.attachments" :key="a.url" :href="a.url" target="_blank" rel="noopener" class="link">📎 {{ a.name }}</a></div>
          <p v-if="x.feedback" class="note" style="margin-top: 6px">Your feedback: {{ x.feedback }}</p>
          <button class="btn gold sm" style="margin-top: 8px" @click="grading = { sub: x, status: 'graded', grade: x.grade ?? '', feedback: x.feedback ?? '' }">{{ x.status === 'submitted' ? 'Grade' : 'Change grade' }}</button>
        </div>
        <p v-if="!subs.length" class="empty">No exercises submitted yet</p>
      </div>
    </section>
  </div>

  <div v-if="grading" class="modal-bg" @click.self="grading = null">
    <form class="modal" @submit.prevent="grade">
      <h2>Grade exercise</h2>
      <p class="note">{{ s?.student?.name }} · Week {{ grading.sub.module?.week }}</p>
      <label>Result</label><select v-model="grading.status"><option value="graded">Graded</option><option value="returned">Return for changes</option></select>
      <label>Grade</label><input v-model="grading.grade" placeholder="e.g. 18/20 or Pass" />
      <label>Feedback</label><textarea v-model="grading.feedback" rows="3"></textarea>
      <div class="row" style="margin-top: 18px; justify-content: flex-end"><button type="button" class="btn ghost" @click="grading = null">Cancel</button><button class="btn gold">Save</button></div>
    </form>
  </div>
</template>

<style scoped>
label { display: block; font-size: 13px; margin: 10px 0 4px; }
textarea { width: 100%; }
</style>
