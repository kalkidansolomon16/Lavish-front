<script setup>
// Teachers fill the modules the General Manager defined with a video and an exercise.
import { ref, computed } from 'vue'
import { state, actions, can } from '../store'

const me = state.user.doctorId
const myCourses = computed(() => state.courses.filter((c) => c.teacherIds.includes(me)))
const sel = ref(myCourses.value[0]?.id)
const course = computed(() => myCourses.value.find((c) => c.id === sel.value))
const editing = ref(null)
const form = ref({})

function edit(m) {
  editing.value = m
  form.value = { vTitle: m.video?.title ?? '', mins: m.video?.mins ?? 20, eTitle: m.exercise?.title ?? '', due: m.exercise?.due ?? new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) }
}
function save() {
  const f = form.value
  actions.saveLesson(editing.value, f.vTitle ? { title: f.vTitle, mins: +f.mins } : null, f.eTitle ? { title: f.eTitle, due: f.due } : null)
  editing.value = null
}
</script>

<template>
  <div class="head">
    <div>
      <h1>Modules</h1>
      <p>The learning path is set by the General Manager. Add a video and an exercise to each module, then publish it to students.</p>
    </div>
  </div>

  <div class="tabs">
    <button v-for="c in myCourses" :key="c.id" :class="{ on: sel === c.id }" @click="sel = c.id">{{ c.title }}</button>
  </div>

  <div v-if="course" class="card">
    <div v-for="m in course.modules" :key="m.id" class="mod">
      <span class="wk" :class="{ off: !m.published }">Wk<br />{{ m.week }}</span>
      <div>
        <b>{{ m.title }}</b><br />
        <span class="asset" :class="{ missing: !m.video }">▶ {{ m.video ? m.video.title + ' · ' + m.video.mins + ' min' : 'Add a video' }}</span>
        <span class="asset" :class="{ missing: !m.exercise }">✎ {{ m.exercise ? m.exercise.title + ' · due ' + m.exercise.due : 'Add an exercise' }}</span>
      </div>
      <div class="row">
        <template v-if="can('academy.teach')"><button class="btn ghost sm" @click="edit(m)">Edit content</button>
        <button class="btn sm" :class="m.published ? 'ghost' : 'gold'" :disabled="!m.video && !m.published" @click="actions.publishModule(m)">{{ m.published ? 'Unpublish' : 'Publish' }}</button></template>
      </div>
    </div>
  </div>
  <p v-else class="empty">You are not assigned to any course yet. The General Manager gives teacher access in Academy.</p>

  <div v-if="editing" class="modal-bg" @click.self="editing = null">
    <form class="modal" @submit.prevent="save">
      <h2>Week {{ editing.week }} · {{ editing.title }}</h2>
      <label>Video title</label><input v-model="form.vTitle" placeholder="e.g. Peel depth & selection" />
      <div class="qgrid">
        <div><label>Length (min)</label><input v-model="form.mins" type="number" min="1" /></div>
        <div><label>Video file</label><button type="button" class="btn ghost" style="width: 100%">⬆ Upload video</button></div>
      </div>
      <label>Exercise</label><input v-model="form.eTitle" placeholder="e.g. Case study — 500 words" />
      <label>Due date</label><input v-model="form.due" type="date" />
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button type="button" class="btn ghost" @click="editing = null">Cancel</button>
        <button class="btn gold">Save</button>
      </div>
    </form>
  </div>
</template>
