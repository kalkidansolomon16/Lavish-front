<script setup>
// Modules (teachers) — the General Manager sets the learning path; the teacher adds each module's video
// (a link: YouTube, Google Drive, Vimeo…) and exercise, then publishes it to students.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { day } from '../fmt'

const auth = useAuth()
const courses = ref([])
const sel = ref(null)
const error = ref('')
const course = computed(() => courses.value.find((c) => c.id === sel.value))

async function load() {
  try {
    courses.value = (await api.get('/staff/teaching/courses')).data
    sel.value ??= courses.value[0]?.id ?? null
  } catch (e) {
    error.value = e.message
  }
}
onMounted(load)

const editing = ref(null)
const edit = (m) => (editing.value = {
  m, vTitle: m.video?.title ?? '', vUrl: m.video?.url ?? '', mins: m.video?.minutes ?? 20,
  eTitle: m.exercise?.title ?? '', eText: m.exercise?.instructions ?? '', due: m.exercise?.due_on ?? new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
})
async function save() {
  const f = editing.value
  if (!(await ask({ title: 'Save this lesson?', body: `Week ${f.m.week} · ${f.m.title}`, ok: 'Save lesson' }))) return
  try {
    await api.put(`/staff/teaching/modules/${f.m.id}`, {
      video: f.vTitle.trim() ? { title: f.vTitle.trim(), url: f.vUrl || null, minutes: +f.mins || null } : null,
      exercise: f.eTitle.trim() ? { title: f.eTitle.trim(), instructions: f.eText || null, due_on: f.due || null } : null,
    })
    editing.value = null
    load()
  } catch (e) {
    notify(e.message)
  }
}
async function togglePublish(m) {
  const on = !m.published
  if (!(await ask({ title: on ? 'Publish this module?' : 'Unpublish this module?', body: `Week ${m.week} · ${m.title}\n${on ? 'Students can open it in the app and are notified.' : 'Students will no longer see it.'}`, ok: on ? 'Publish' : 'Unpublish', tone: on ? 'primary' : 'danger' }))) return
  try {
    await api.post(`/staff/teaching/modules/${m.id}/publish`, { published: on })
    m.published = on
  } catch (e) {
    notify(e.message)
  }
}
</script>

<template>
  <div class="head">
    <div>
      <h1>Modules</h1>
      <p>The learning path is set by the General Manager. Add a video and an exercise to each module, then publish it to students.</p>
    </div>
  </div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>

  <div class="tabs"><button v-for="c in courses" :key="c.id" :class="{ on: sel === c.id }" @click="sel = c.id">{{ c.title }}</button></div>

  <div v-if="course" class="card">
    <div v-for="m in course.modules" :key="m.id" class="mod">
      <span class="wk" :class="{ off: !m.published }">Wk<br />{{ m.week }}</span>
      <div>
        <b>{{ m.title }}</b><br />
        <span class="asset" :class="{ missing: !m.video }">▶ {{ m.video ? m.video.title + (m.video.minutes ? ' · ' + m.video.minutes + ' min' : '') : 'Add a video' }}</span>
        <span class="asset" :class="{ missing: !m.exercise }">✎ {{ m.exercise ? m.exercise.title + (m.exercise.due_on ? ' · due ' + day(m.exercise.due_on) : '') : 'Add an exercise' }}</span>
        <span v-if="m.submissions_count" class="asset">📥 {{ m.submissions_count }} submitted</span>
      </div>
      <div v-if="auth.can('academy.teach')" class="row">
        <button class="btn ghost sm" @click="edit(m)">Edit content</button>
        <button class="btn sm" :class="m.published ? 'ghost' : 'gold'" :disabled="!m.video && !m.published" @click="togglePublish(m)">{{ m.published ? 'Unpublish' : 'Publish' }}</button>
      </div>
    </div>
    <p v-if="!course.modules?.length" class="empty">No modules yet — the General Manager adds them to the learning path in Academy.</p>
  </div>
  <p v-else class="empty card">You are not assigned to any course yet. The General Manager gives teacher access in Academy.</p>

  <div v-if="editing" class="modal-bg" @click.self="editing = null">
    <form class="modal" style="width: min(600px, 95vw)" @submit.prevent="save">
      <h2>Week {{ editing.m.week }} · {{ editing.m.title }}</h2>
      <label>Video title</label><input v-model="editing.vTitle" placeholder="e.g. Peel depth & selection" />
      <div class="qgrid">
        <div><label>Video link</label><input v-model="editing.vUrl" type="url" placeholder="https://youtube.com/…" /></div>
        <div><label>Length (min)</label><input v-model.number="editing.mins" type="number" min="1" /></div>
      </div>
      <label>Exercise</label><input v-model="editing.eTitle" placeholder="e.g. Case study — 500 words" />
      <label>Instructions</label><textarea v-model="editing.eText" rows="3"></textarea>
      <label>Due date</label><input v-model="editing.due" type="date" />
      <div class="row" style="margin-top: 18px; justify-content: flex-end"><button type="button" class="btn ghost" @click="editing = null">Cancel</button><button class="btn gold">Save</button></div>
    </form>
  </div>
</template>

<style scoped>
label { display: block; font-size: 13px; margin: 10px 0 4px; }
textarea { width: 100%; }
</style>
