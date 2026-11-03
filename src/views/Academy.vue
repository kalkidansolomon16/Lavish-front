<script setup>
// General Manager's academy portal: controls learning paths, teacher access, enrolment and certificates.
import { ref, computed } from 'vue'
import { state, actions, courseTitle, doctorName, etb, can } from '../store'

const tab = ref('paths')
const newModule = ref({})
const editing = ref(null) // course whose teachers are being edited
const picked = ref([])
const cert = ref(null)

const teacherOptions = computed(() => state.doctors.filter((d) => d.access === 'active'))
const canAdd = can('academy.students')
const completed = computed(() => state.students.filter((s) => s.status === 'completed'))

function addModule(c) {
  const t = (newModule.value[c.id] || '').trim()
  if (!t) return
  actions.addModule(c, t)
  newModule.value[c.id] = ''
}
const editTeachers = (c) => { editing.value = c; picked.value = [...c.teacherIds] }
const saveTeachers = () => { actions.setTeachers(editing.value, picked.value); editing.value = null }
const issue = (s) => { actions.issueCertificate(s); cert.value = s }
const print = () => window.print()

// Students don't register in the app: the CEO enrols them (in person or by phone) and hands over a login.
const adding = ref(false)
const blankStudent = () => ({ name: '', phone: '+251 ', courseId: state.courses[0].id, via: 'In person' })
const sf = ref(blankStudent())
const creds = ref(null) // { name, username, password } shown once to read out / SMS
function addStudent() {
  if (!sf.value.name.trim() || sf.value.phone.replace(/\D/g, '').length < 10) return
  creds.value = actions.addStudent({ ...sf.value, name: sf.value.name.trim() })
  adding.value = false
  sf.value = blankStudent()
}
const resetPassword = (st) => (creds.value = actions.resetStudentPassword(st))
const smsCreds = () => { actions.smsStudentLogin(creds.value); creds.value = null }
</script>

<template>
  <div class="head">
    <div>
      <h1>Lavish Academy</h1>
      <p>Control learning paths, give teacher doctors access, enrol students and issue certificates. Teachers manage lessons in their own portal.</p>
    </div>
    <button v-if="canAdd" class="btn gold" @click="adding = true">+ Add student</button>
  </div>

  <div class="tabs">
    <button :class="{ on: tab === 'paths' }" @click="tab = 'paths'">Learning paths</button>
    <button :class="{ on: tab === 'students' }" @click="tab = 'students'">Students · {{ state.students.length }}</button>
    <button :class="{ on: tab === 'certs' }" @click="tab = 'certs'">Certificates · {{ completed.length }}</button>
  </div>

  <div v-if="tab === 'paths'" class="grid g2">
    <div v-for="c in state.courses" :key="c.id" class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start">
        <div><h2>{{ c.title }}</h2><p class="note">{{ c.level }} · {{ c.weeks }} weeks · {{ etb(c.price) }}</p></div>
        <span class="badge">{{ c.modules.filter((m) => m.published).length }}/{{ c.modules.length }} live</span>
      </div>

      <label>Teacher doctors (have access to the Academy teacher portal)</label>
      <div class="row">
        <span v-for="id in c.teacherIds" :key="id" class="badge active">🎓 {{ doctorName(id) }}</span>
        <span v-if="!c.teacherIds.length" class="badge open">No teacher</span>
        <button v-if="can('academy.paths')" class="btn ghost sm" @click="editTeachers(c)">Manage access</button>
      </div>

      <label>Learning path</label>
      <div v-for="m in c.modules" :key="m.id" class="mod">
        <span class="wk" :class="{ off: !m.published }">Wk<br />{{ m.week }}</span>
        <div>
          <b>{{ m.title }}</b><br />
          <span class="asset" :class="{ missing: !m.video }">▶ {{ m.video ? m.video.title + ' · ' + m.video.mins + ' min' : 'No video yet' }}</span>
          <span class="asset" :class="{ missing: !m.exercise }">✎ {{ m.exercise ? m.exercise.title : 'No exercise yet' }}</span>
        </div>
        <span class="badge" :class="m.published ? 'active' : 'pending'">{{ m.published ? 'live' : 'draft' }}</span>
      </div>
      <form v-if="can('academy.paths')" class="row" style="margin-top: 12px; flex-wrap: nowrap" @submit.prevent="addModule(c)">
        <input v-model="newModule[c.id]" placeholder="Add a module to this path…" />
        <button class="btn gold sm">Add</button>
      </form>
    </div>
  </div>

  <div v-else-if="tab === 'students'" class="card">
    <p class="note" style="margin-bottom: 10px">Students can’t sign up in the app. They enrol in person or by phone, and someone with the “Enrol students” permission (the CEO by default) creates their app login here.</p>
    <table>
      <thead><tr><th>Student</th><th>Course</th><th>Teachers</th><th>Progress</th><th>Status</th><th>App login</th><th></th></tr></thead>
      <tbody>
        <tr v-for="s in state.students" :key="s.id">
          <td>{{ s.name }}<small>{{ s.phone }}</small></td>
          <td>{{ courseTitle(s.courseId) }}</td>
          <td><small>{{ state.courses.find((c) => c.id === s.courseId).teacherIds.map(doctorName).join(', ') }}</small></td>
          <td style="width: 150px">
            <div style="background: var(--line); border-radius: 9px; height: 7px">
              <div :style="{ width: s.progress + '%', background: 'var(--gold)', height: '7px', borderRadius: '9px' }"></div>
            </div>
            <small>{{ s.progress }}%</small>
          </td>
          <td><span class="badge" :class="s.status">{{ s.status }}</span></td>
          <td>
            <template v-if="s.login">{{ s.login.username }}<small>{{ s.login.activated ? 'Using the app ✓' : 'Not logged in yet' }} · {{ s.login.via }}</small></template>
            <span v-else class="badge open">No login</span>
          </td>
          <td class="row">
            <button v-if="canAdd && s.login" class="btn ghost sm" @click="resetPassword(s)">Reset password</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-else class="card">
    <p class="note" style="margin-bottom: 10px">Students who finished their course. Issuing sends a PDF to the student’s app; you can also print it.</p>
    <table>
      <thead><tr><th>Student</th><th>Course</th><th>Certificate</th><th></th></tr></thead>
      <tbody>
        <tr v-for="s in completed" :key="s.id">
          <td>{{ s.name }}<small>{{ s.phone }}</small></td>
          <td>{{ courseTitle(s.courseId) }}</td>
          <td>
            <span v-if="s.certificate" class="badge active">{{ s.certificate.no }}</span>
            <span v-else class="badge pending">not issued</span>
            <small v-if="s.certificate">Issued {{ s.certificate.date }} · sent to app</small>
          </td>
          <td class="row">
            <button v-if="!s.certificate && can('academy.certificates')" class="btn gold sm" @click="issue(s)">Issue certificate</button>
            <button v-else class="btn ghost sm" @click="cert = s">View / print</button>
          </td>
        </tr>
        <tr v-if="!completed.length"><td colspan="4" class="empty">No completed students yet</td></tr>
      </tbody>
    </table>
  </div>

  <div v-if="adding" class="modal-bg" @click.self="adding = false">
    <form class="modal" @submit.prevent="addStudent">
      <h2>Add student</h2>
      <p class="note">Enrol the student and create their mobile app login. You’ll get a temporary password to give them.</p>
      <label>Full name</label><input v-model="sf.name" required placeholder="e.g. Meklit Bogale" />
      <label>Phone number (their app username)</label><input v-model="sf.phone" required inputmode="tel" />
      <label>Course</label>
      <select v-model.number="sf.courseId"><option v-for="c in state.courses" :key="c.id" :value="c.id">{{ c.title }} — {{ etb(c.price) }}</option></select>
      <label>How did they enrol?</label>
      <select v-model="sf.via"><option>In person</option><option>Phone call</option></select>
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button type="button" class="btn ghost" @click="adding = false">Cancel</button>
        <button class="btn gold">Enrol & create login</button>
      </div>
    </form>
  </div>

  <div v-if="creds" class="modal-bg">
    <div class="modal" style="width: min(460px, 94vw)">
      <h2>App login for {{ creds.name }}</h2>
      <p class="note">Give these to the student in person or read them out on the phone. They’ll be asked to choose a new password the first time they log in.</p>
      <div class="card" style="background: var(--bg); margin-top: 12px">
        <p>Username <b style="float: right">{{ creds.username }}</b></p>
        <p style="margin-top: 8px">Temporary password <b class="serif" style="float: right; font-size: 20px; letter-spacing: 1px">{{ creds.password }}</b></p>
      </div>
      <p class="note" style="margin-top: 10px">This password is only shown once.</p>
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button class="btn ghost" @click="smsCreds">Send by SMS</button>
        <button class="btn gold" @click="creds = null">Done</button>
      </div>
    </div>
  </div>

  <div v-if="editing" class="modal-bg" @click.self="editing = null">
    <div class="modal">
      <h2>Teacher access</h2>
      <p class="note">{{ editing.title }} — checked doctors can open the Academy teacher portal for this course.</p>
      <label v-for="d in teacherOptions" :key="d.id" class="row" style="color: var(--ink); margin: 12px 0 0">
        <input v-model="picked" type="checkbox" :value="d.id" style="width: auto" /> {{ d.name }} <small class="note">{{ d.specialty }}</small>
      </label>
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button class="btn ghost" @click="editing = null">Cancel</button>
        <button class="btn gold" @click="saveTeachers">Save access</button>
      </div>
    </div>
  </div>

  <div v-if="cert" class="modal-bg" @click.self="cert = null">
    <div class="modal" style="width: min(760px, 95vw)">
      <div class="cert">
        <img src="/img/logo-white.png" alt="Lavish" />
        <span class="eyebrow">LAVISH ACADEMY</span>
        <h1>Certificate of Completion</h1>
        <p>This certifies that</p>
        <div class="who">{{ cert.name }}</div>
        <p>has successfully completed <b>{{ courseTitle(cert.courseId) }}</b></p>
        <div class="sig">
          <div><b>{{ cert.certificate.by }}</b>General Manager</div>
          <div>No. {{ cert.certificate.no }}<br />{{ cert.certificate.date }}</div>
          <div><b>{{ doctorName(state.courses.find((c) => c.id === cert.courseId).teacherIds[0]) }}</b>Lead teacher</div>
        </div>
      </div>
      <div class="row" style="margin-top: 16px; justify-content: space-between">
        <small class="note">✓ Soft copy (PDF) delivered to the student’s mobile app</small>
        <div class="row"><button class="btn ghost" @click="cert = null">Close</button><button class="btn gold" @click="print">🖨 Print</button></div>
      </div>
    </div>
  </div>
</template>
