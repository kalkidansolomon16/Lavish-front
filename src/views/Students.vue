<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { state, actions, courseTitle } from '../store'

const me = state.user.doctorId
const myCourseIds = computed(() => state.courses.filter((c) => c.teacherIds.includes(me)).map((c) => c.id))
const list = computed(() => state.students.filter((s) => myCourseIds.value.includes(s.courseId) && ['active', 'completed'].includes(s.status)))
const sel = ref(list.value[0]?.id)
const s = computed(() => list.value.find((x) => x.id === sel.value))
const text = ref('')
const scroller = ref(null)
const initials = (n) => n.split(' ').map((w) => w[0]).join('')
const course = computed(() => state.courses.find((c) => c.id === s.value?.courseId))

function send() {
  if (!text.value.trim()) return
  actions.messageStudent(s.value, text.value.trim())
  text.value = ''
}
watch([sel, () => s.value?.chat.length], () => nextTick(() => scroller.value && (scroller.value.scrollTop = scroller.value.scrollHeight)), { flush: 'post' })
</script>

<template>
  <div class="head">
    <div>
      <h1>My students</h1>
      <p>Students enrolled in the courses you teach. Track progress and answer their questions — they chat with you from the mobile app.</p>
    </div>
  </div>

  <div class="card chat" style="grid-template-columns: 300px 1fr; height: 600px">
    <div class="list">
      <button v-for="x in list" :key="x.id" :class="{ on: x.id === sel }" @click="sel = x.id">
        <b>{{ x.name }}</b>
        <small>{{ courseTitle(x.courseId) }} · {{ x.progress }}%</small>
        <small v-if="x.chat.at(-1)?.from === 'student'" style="color: var(--dark)">● {{ x.chat.at(-1).text }}</small>
      </button>
      <p v-if="!list.length" class="empty">No students yet</p>
    </div>

    <div v-if="s" class="pane">
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--line)">
        <div class="row" style="justify-content: space-between">
          <div class="row"><span class="mini-avatar">{{ initials(s.name) }}</span><div><b>{{ s.name }}</b><small class="note" style="display: block">{{ s.phone }} · {{ courseTitle(s.courseId) }}</small></div></div>
          <span class="badge" :class="s.status">{{ s.status }}</span>
        </div>
        <div class="row" style="margin-top: 12px">
          <label style="margin: 0; white-space: nowrap">Progress {{ s.progress }}%</label>
          <input type="range" min="0" max="100" step="5" :value="s.progress" style="padding: 0" @input="actions.setProgress(s, +$event.target.value)" />
        </div>
        <small class="note">Exercises: {{ course.modules.filter((m) => m.exercise && m.published).length }} assigned ·
          {{ Math.round((s.progress / 100) * course.modules.filter((m) => m.exercise).length) }} submitted</small>
      </div>
      <div ref="scroller" class="msgs">
        <div v-for="(m, i) in s.chat" :key="i" class="bubble" :class="{ doctor: m.from === 'teacher' }">{{ m.text }}<small>{{ m.time }}</small></div>
        <p v-if="!s.chat.length" class="empty">No messages yet — say hello 👋</p>
      </div>
      <form class="compose" @submit.prevent="send">
        <input v-model="text" placeholder="Reply to your student…" />
        <button class="btn">Send</button>
      </form>
    </div>
  </div>
</template>
