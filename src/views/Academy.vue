<script setup>
// Lavish Academy (manager portal) — courses & learning paths, teacher access, enrolment with app logins,
// fees and certificates. GET /staff/academy/{courses,enrollments}. Teachers fill lessons in their own portal.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { etb, day } from '../fmt'
import PhoneInput from '../components/PhoneInput.vue'

const auth = useAuth()
const canPaths = computed(() => auth.can('academy.paths'))
const canAdd = computed(() => auth.can('academy.students'))
const courses = ref([])
const enrollments = ref([])
const doctors = ref([])
const branches = ref([])
const tab = ref('paths')
const error = ref('')
const newModule = ref({})

async function load() {
  try {
    const [c, e] = await Promise.all([api.get('/staff/academy/courses'), api.get('/staff/academy/enrollments', { per_page: 200 })])
    courses.value = c.data
    enrollments.value = e.data
  } catch (err) {
    error.value = err.message
  }
}
onMounted(async () => {
  load()
  const [d, b] = await Promise.all([api.get('/catalog/doctors').catch(() => ({ data: [] })), api.get('/catalog/branches')])
  doctors.value = d.data
  branches.value = b.data
})
const completed = computed(() => enrollments.value.filter((e) => e.status === 'completed'))
const courseOf = (e) => courses.value.find((c) => c.id === e.course?.id) ?? e.course

// ---- courses
const courseForm = ref(null)
const openCourse = (c = null) => (courseForm.value = c
  ? { id: c.id, title: c.title, about: c.about ?? '', level: c.level, weeks: c.weeks, price: c.price, mode: c.mode ?? '', branch_id: c.branch?.id ?? null, starts_on: c.starts_on ?? '', requirement: c.requirement ?? '', active: c.active }
  : { title: '', about: '', level: 'Beginner', weeks: 5, price: 0, mode: 'In person', branch_id: branches.value.find((b) => b.is_main)?.id ?? null, starts_on: '', requirement: '', active: true })
async function saveCourse() {
  const f = courseForm.value
  if (!(await ask({ title: f.id ? 'Save course?' : 'Create this course?', body: `${f.title} · ${f.level} · ${f.weeks} weeks · ${etb(f.price)}${f.active ? '\nShown in the app’s Academy catalogue.' : ''}`, ok: f.id ? 'Save' : 'Create course' }))) return
  try {
    const body = { ...f, starts_on: f.starts_on || null, branch_id: f.branch_id || null }
    const c = (f.id ? await api.patch(`/staff/academy/courses/${f.id}`, body) : await api.post('/staff/academy/courses', body)).data
    courseForm.value = null
    notify('Course saved')
    load()
    return c
  } catch (e) {
    notify(e.message)
  }
}
async function addModule(c) {
  const t = (newModule.value[c.id] || '').trim()
  if (!t) return
  if (!(await ask({ title: 'Add this module?', body: `“${t}” is added to ${c.title}. The teacher adds its video and exercise.`, ok: 'Add module' }))) return
  try {
    await api.post(`/staff/academy/courses/${c.id}/modules`, { title: t })
    newModule.value[c.id] = ''
    load()
  } catch (e) {
    notify(e.message)
  }
}
async function removeModule(m) {
  if (!(await ask({ title: `Remove week ${m.week}?`, body: `“${m.title}” and its lesson content are removed from the path.`, ok: 'Remove', tone: 'danger' }))) return
  try {
    await api.delete(`/staff/academy/modules/${m.id}`)
    load()
  } catch (e) {
    notify(e.message)
  }
}
const editing = ref(null)
const picked = ref([])
const editTeachers = (c) => { editing.value = c; picked.value = (c.teachers ?? []).map((t) => t.id) }
async function saveTeachers() {
  if (!(await ask({ title: 'Save teacher access?', body: `Who teaches ${editing.value.title}. They get the Lavish Academy portal for it.`, ok: 'Save' }))) return
  try {
    await api.put(`/staff/academy/courses/${editing.value.id}/teachers`, { doctor_ids: picked.value })
    editing.value = null
    load()
  } catch (e) {
    notify(e.message)
  }
}

// ---- students
const adding = ref(null)
const creds = ref(null)
const openAdd = () => (adding.value = { name: '', phone: '', email: '', course_id: courses.value[0]?.id, via: 'in_person', fee: courses.value[0]?.price ?? 0, paid: false, send_sms: false, error: '' })
async function addStudent() {
  const s = adding.value
  if (!(await ask({ title: 'Enrol this student?', body: `${s.name.trim()} · ${s.phone}\n${courses.value.find((c) => c.id === s.course_id)?.title}\nA student app login is created — you’ll see the password once.`, ok: 'Enrol student' }))) return
  try {
    const res = (await api.post('/staff/academy/enrollments', { ...s, name: s.name.trim(), email: s.email || null, fee: +s.fee })).data
    creds.value = res.credentials
    adding.value = null
    load()
  } catch (e) {
    s.error = e.message
  }
}
async function resetPassword(e) {
  if (!(await ask({ title: 'Reset password?', body: `${e.student.name}’s current password stops working and a new one is created.`, ok: 'Reset password', tone: 'danger' }))) return
  try {
    creds.value = (await api.post(`/staff/academy/students/${e.student.id}/reset-password`, { send_sms: false })).data.credentials
  } catch (err) {
    notify(err.message)
  }
}
async function smsCreds() {
  if (!(await ask({ title: 'Send login by SMS?', body: `${creds.value.name} gets a new password by SMS (the one on screen stops working).`, ok: 'Send SMS' }))) return
  const e = enrollments.value.find((x) => x.student?.username === creds.value.username)
  try {
    if (e) await api.post(`/staff/academy/students/${e.student.id}/reset-password`, { send_sms: true })
    notify('Login sent by SMS')
    creds.value = null
  } catch (err) {
    notify(err.message)
  }
}
async function markPaid(e) {
  if (!(await ask({ title: 'Mark the fee as paid?', body: `${e.student.name} · ${e.course?.title} · ${etb(e.fee)}`, ok: 'Mark paid' }))) return
  try {
    await api.post(`/staff/academy/enrollments/${e.id}/mark-paid`)
    load()
  } catch (err) {
    notify(err.message)
  }
}
const cert = ref(null)
async function issue(e) {
  if (!(await ask({ title: 'Issue certificate?', body: `${e.student.name} receives their ${e.course?.title} certificate in the app.`, ok: 'Issue certificate' }))) return
  try {
    const u = (await api.post(`/staff/academy/enrollments/${e.id}/certificate`)).data
    load()
    cert.value = { ...e, ...u }
  } catch (err) {
    notify(err.message)
  }
}
const print = () => window.print()
</script>

<template>
  <div class="head">
    <div>
      <h1>Lavish Academy</h1>
      <p>Control learning paths, give teacher doctors access, enrol students and issue certificates. Teachers manage lessons in their own portal.</p>
    </div>
    <div class="row">
      <button v-if="auth.can('academy.create')" class="btn ghost" @click="openCourse()">+ New course</button>
      <button v-if="canAdd && courses.length" class="btn gold" @click="openAdd">+ Add student</button>
    </div>
  </div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>

  <div class="tabs">
    <button :class="{ on: tab === 'paths' }" @click="tab = 'paths'">Learning paths · {{ courses.length }}</button>
    <button :class="{ on: tab === 'students' }" @click="tab = 'students'">Students · {{ enrollments.length }}</button>
    <button :class="{ on: tab === 'certs' }" @click="tab = 'certs'">Certificates · {{ completed.length }}</button>
  </div>

  <div v-if="tab === 'paths'" class="grid g2">
    <div v-for="c in courses" :key="c.id" class="card" :style="{ opacity: c.active ? 1 : 0.6 }">
      <div class="row" style="justify-content: space-between; align-items: flex-start">
        <div><h2>{{ c.title }}</h2><p class="note">{{ c.level }} · {{ c.weeks }} weeks · {{ etb(c.price) }}<template v-if="c.mode"> · {{ c.mode }}</template><template v-if="c.starts_on"> · starts {{ day(c.starts_on) }}</template> · {{ c.enrollments_count ?? 0 }} enrolled</p></div>
        <div class="row"><span class="badge">{{ (c.modules ?? []).filter((m) => m.published).length }}/{{ (c.modules ?? []).length }} live</span><button v-if="canPaths" class="btn ghost sm" @click="openCourse(c)">Edit</button></div>
      </div>
      <label>Teacher doctors (have access to the Academy teacher portal)</label>
      <div class="row">
        <span v-for="t in c.teachers" :key="t.id" class="badge active">🎓 {{ t.name }}</span>
        <span v-if="!c.teachers?.length" class="badge open">No teacher</span>
        <button v-if="canPaths" class="btn ghost sm" @click="editTeachers(c)">Manage access</button>
      </div>
      <label>Learning path</label>
      <div v-for="m in c.modules" :key="m.id" class="mod">
        <span class="wk" :class="{ off: !m.published }">Wk<br />{{ m.week }}</span>
        <div>
          <b>{{ m.title }}</b><br />
          <span class="asset" :class="{ missing: !m.video }">▶ {{ m.video ? m.video.title + (m.video.minutes ? ' · ' + m.video.minutes + ' min' : '') : 'No video yet' }}</span>
          <span class="asset" :class="{ missing: !m.exercise }">✎ {{ m.exercise ? m.exercise.title : 'No exercise yet' }}</span>
        </div>
        <span class="badge" :class="m.published ? 'active' : 'pending'">{{ m.published ? 'live' : 'draft' }}</span>
        <button v-if="canPaths" class="btn ghost sm" title="Remove" @click="removeModule(m)">✕</button>
      </div>
      <p v-if="canPaths && (c.modules?.length ?? 0) >= 5" class="note" style="margin-top: 12px">All 5 weeks have a module.</p>
      <form v-if="canPaths && (c.modules?.length ?? 0) < 5" class="row" style="margin-top: 12px; flex-wrap: nowrap" @submit.prevent="addModule(c)">
        <input v-model="newModule[c.id]" placeholder="Add a module to this path…" />
        <button class="btn gold sm">Add</button>
      </form>
    </div>
    <p v-if="!courses.length" class="empty card">No courses yet{{ auth.can('academy.create') ? ' — create the first one with “New course”.' : '.' }}</p>
  </div>

  <div v-else-if="tab === 'students'" class="card">
    <p class="note" style="margin-bottom: 10px">Students can’t sign up in the app. They enrol in person or by phone, and someone with the “Enrol students” permission creates their app login here.</p>
    <table>
      <thead><tr><th>Student</th><th>Course</th><th>Progress</th><th>Fee</th><th>Status</th><th>App login</th><th></th></tr></thead>
      <tbody>
        <tr v-for="e in enrollments" :key="e.id">
          <td>{{ e.student?.name }}<small>{{ e.student?.phone }}</small></td>
          <td>{{ e.course?.title }}<small>{{ (courseOf(e)?.teachers ?? []).map((t) => t.name).join(', ') }}</small></td>
          <td style="width: 150px">
            <div style="background: var(--line); border-radius: 9px; height: 7px"><div :style="{ width: e.progress + '%', background: 'var(--gold)', height: '7px', borderRadius: '9px' }"></div></div>
            <small>{{ e.progress }}%</small>
          </td>
          <td>{{ etb(e.fee) }}<small>{{ e.paid ? 'Paid' : 'Not paid' }}</small></td>
          <td><span class="badge" :class="e.status">{{ e.status }}</span></td>
          <td>{{ e.student?.username }}<small>{{ e.student?.activated ? 'Using the app ✓' : 'Not logged in yet' }} · {{ e.enrolled_via === 'phone_call' ? 'Phone call' : 'In person' }}</small></td>
          <td class="row">
            <button v-if="canAdd && !e.paid" class="btn gold sm" @click="markPaid(e)">Mark paid</button>
            <button v-if="canAdd" class="btn ghost sm" @click="resetPassword(e)">Reset password</button>
          </td>
        </tr>
        <tr v-if="!enrollments.length"><td colspan="7" class="empty">No students yet</td></tr>
      </tbody>
    </table>
  </div>

  <div v-else class="card">
    <p class="note" style="margin-bottom: 10px">Students who finished their course (the teacher sets progress to 100%). Issuing delivers the certificate to the student’s app; you can also print it.</p>
    <table>
      <thead><tr><th>Student</th><th>Course</th><th>Certificate</th><th></th></tr></thead>
      <tbody>
        <tr v-for="e in completed" :key="e.id">
          <td>{{ e.student?.name }}<small>{{ e.student?.phone }}</small></td>
          <td>{{ e.course?.title }}</td>
          <td><span v-if="e.certificate" class="badge active">{{ e.certificate.number }}</span><span v-else class="badge pending">not issued</span><small v-if="e.certificate">Issued {{ day(e.certificate.issued_at) }} · sent to app</small></td>
          <td class="row">
            <button v-if="!e.certificate && auth.can('academy.certificates')" class="btn gold sm" @click="issue(e)">Issue certificate</button>
            <button v-else-if="e.certificate" class="btn ghost sm" @click="cert = e">View / print</button>
          </td>
        </tr>
        <tr v-if="!completed.length"><td colspan="4" class="empty">No completed students yet</td></tr>
      </tbody>
    </table>
  </div>

  <div v-if="courseForm" class="modal-bg" @click.self="courseForm = null">
    <form class="modal" style="width: min(620px, 95vw); max-height: 92vh; overflow: auto" @submit.prevent="saveCourse">
      <h2>{{ courseForm.id ? 'Edit course' : 'New course' }}</h2>
      <label>Title</label><input v-model="courseForm.title" required placeholder="e.g. Medical Aesthetics Foundations" />
      <div class="qgrid">
        <div><label>Level</label><select v-model="courseForm.level"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
        <div><label>Length</label><input value="5 weeks · one module per week" disabled /></div>
        <div><label>Fee (ETB)</label><input v-model.number="courseForm.price" type="number" min="0" required /></div>
        <div><label>Starts on</label><input v-model="courseForm.starts_on" type="date" /></div>
        <div><label>Mode</label><input v-model="courseForm.mode" placeholder="e.g. In person · Addis Ababa" /></div>
        <div><label>Branch</label><select v-model.number="courseForm.branch_id"><option :value="null">—</option><option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option></select></div>
      </div>
      <label>About (shown in the app)</label><textarea v-model="courseForm.about" rows="3"></textarea>
      <label>Entry requirement (optional)</label><input v-model="courseForm.requirement" placeholder="e.g. For licensed doctors and nurses only" />
      <label class="row" style="color: var(--ink); margin-top: 12px"><input v-model="courseForm.active" type="checkbox" style="width: auto" /> Show in the app’s Academy catalogue</label>
      <div class="row" style="margin-top: 18px; justify-content: flex-end"><button type="button" class="btn ghost" @click="courseForm = null">Cancel</button><button class="btn gold">Save course</button></div>
    </form>
  </div>

  <div v-if="adding" class="modal-bg" @click.self="adding = null">
    <form class="modal" @submit.prevent="addStudent">
      <h2>Add student</h2>
      <p class="note">Enrol the student and create their mobile app login. You’ll get a temporary password to give them.</p>
      <label>Full name</label><input v-model="adding.name" required placeholder="e.g. Meklit Bogale" />
      <div class="qgrid">
        <div><label>Phone (their app username)</label><PhoneInput v-model="adding.phone" required /></div>
        <div><label>Email (optional)</label><input v-model="adding.email" type="email" /></div>
        <div><label>Course</label><select v-model.number="adding.course_id" @change="adding.fee = courses.find((c) => c.id === adding.course_id)?.price ?? 0"><option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}</option></select></div>
        <div><label>Fee (ETB)</label><input v-model.number="adding.fee" type="number" min="0" /></div>
        <div><label>How did they enrol?</label><select v-model="adding.via"><option value="in_person">In person</option><option value="phone_call">Phone call</option></select></div>
      </div>
      <label class="row" style="color: var(--ink); margin-top: 10px"><input v-model="adding.paid" type="checkbox" style="width: auto" /> Fee already paid</label>
      <label class="row" style="color: var(--ink)"><input v-model="adding.send_sms" type="checkbox" style="width: auto" /> Also send the login by SMS</label>
      <p v-if="adding.error" class="note" style="color: var(--bad)">{{ adding.error }}</p>
      <div class="row" style="margin-top: 18px; justify-content: flex-end"><button type="button" class="btn ghost" @click="adding = null">Cancel</button><button class="btn gold">Enrol & create login</button></div>
    </form>
  </div>

  <div v-if="creds" class="modal-bg">
    <div class="modal" style="width: min(460px, 94vw)">
      <h2>App login for {{ creds.name }}</h2>
      <p class="note">Give these to the student in person or read them out on the phone. They choose a new password the first time they log in.</p>
      <div class="card" style="background: var(--bg); margin-top: 12px">
        <p>Username <b style="float: right">{{ creds.username }}</b></p>
        <p v-if="creds.password" style="margin-top: 8px">Temporary password <b class="serif" style="float: right; font-size: 20px; letter-spacing: 1px">{{ creds.password }}</b></p>
        <p v-else class="note" style="margin-top: 8px">This student already had an app account — they keep their current password.</p>
      </div>
      <p class="note" style="margin-top: 10px">This password is only shown once.</p>
      <div class="row" style="margin-top: 18px; justify-content: flex-end"><button class="btn ghost" @click="smsCreds">Send by SMS instead</button><button class="btn gold" @click="creds = null">Done</button></div>
    </div>
  </div>

  <div v-if="editing" class="modal-bg" @click.self="editing = null">
    <div class="modal">
      <h2>Teacher access</h2>
      <p class="note">{{ editing.title }} — checked doctors can open the Academy teacher portal for this course.</p>
      <label v-for="d in doctors" :key="d.id" class="row" style="color: var(--ink); margin: 12px 0 0"><input v-model="picked" type="checkbox" :value="d.id" style="width: auto" /> {{ d.name }} <small class="note">{{ d.specialty }}</small></label>
      <p v-if="!doctors.length" class="note">No doctors with portal access yet — add them in Staff.</p>
      <div class="row" style="margin-top: 18px; justify-content: flex-end"><button class="btn ghost" @click="editing = null">Cancel</button><button class="btn gold" @click="saveTeachers">Save access</button></div>
    </div>
  </div>

  <div v-if="cert" class="modal-bg" @click.self="cert = null">
    <div class="modal" style="width: min(760px, 95vw)">
      <div class="cert">
        <img src="/img/logo-white.png" alt="Lavish" />
        <span class="eyebrow">LAVISH ACADEMY</span>
        <h1>Certificate of Completion</h1>
        <p>This certifies that</p>
        <div class="who">{{ cert.student?.name }}</div>
        <p>has successfully completed <b>{{ cert.course?.title }}</b></p>
        <div class="sig">
          <div><b>{{ cert.certificate?.issued_by }}</b>Lavish Academy</div>
          <div>No. {{ cert.certificate?.number }}<br />{{ day(cert.certificate?.issued_at) }}</div>
          <div><b>{{ courseOf(cert)?.teachers?.[0]?.name }}</b>Lead teacher</div>
        </div>
      </div>
      <div class="row" style="margin-top: 16px; justify-content: space-between">
        <small class="note">✓ Delivered to the student’s mobile app</small>
        <div class="row"><button class="btn ghost" @click="cert = null">Close</button><button class="btn gold" @click="print">🖨 Print</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
td small { display: block; color: var(--muted); font-size: 12px; }
label { display: block; font-size: 13px; margin: 10px 0 4px; }
textarea { width: 100%; }
</style>
