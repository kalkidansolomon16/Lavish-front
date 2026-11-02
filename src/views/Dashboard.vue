<script setup>
import { computed } from 'vue'
import { state, doctorName, courseTitle, etb, can, BRANCHES } from '../store'
import { ui, t } from '../ui'
import BarChart from '../components/BarChart.vue'
import Donut from '../components/Donut.vue'
import ClientLink from '../components/ClientLink.vue'

const role = state.user.role
const myDoc = state.user.doctorId
const todayStr = new Date().toISOString().slice(0, 10)
const count = (list, fn) => list.filter(fn).length
const myCourses = computed(() => state.courses.filter((c) => c.teacherIds.includes(myDoc)).map((c) => c.id))
const myStudents = computed(() => state.students.filter((s) => myCourses.value.includes(s.courseId) && s.status !== 'pending'))

const stats = computed(() => {
  const s = state
  const revenue = ui.revenue.reduce((t, d) => t + d.value, 0)
  const all = {
    ceo: [
      ['Revenue this week', etb(revenue), true],
      ['Pending appointments', count(s.appointments, (a) => a.status === 'pending')],
      ['Orders to deliver', count(s.orders, (o) => o.status === 'placed')],
      ['Open complaints', count(s.complaints, (c) => c.status !== 'resolved')],
    ],
    gm: [
      ['Open complaints', count(s.complaints, (c) => c.status !== 'resolved'), true],
      ['Staff & doctors', s.staff.length + s.doctors.length],
      ['Products to reorder', count(s.products, (p) => p.stock <= p.reorder)],
      ['Certificates to issue', count(s.students, (x) => x.status === 'completed' && !x.certificate)],
    ],
    reception: [
      ['Awaiting approval', count(s.appointments, (a) => a.status === 'pending'), true],
      ['Today’s appointments', count(s.appointments, (a) => a.date === todayStr && a.status === 'approved')],
      ['Unpaid invoices', count(s.payments, (p) => p.status === 'unpaid')],
      ['Not on the app yet', count(s.clients, (c) => !c.app)],
    ],
    ecommerce: [
      ['Orders to deliver', count(s.orders, (o) => o.status === 'placed'), true],
      ['Unpaid orders', count(s.orders, (o) => o.payment !== 'paid')],
      ['Low stock', count(s.products, (p) => p.stock > 0 && p.stock <= p.reorder)],
      ['Out of stock', count(s.products, (p) => p.stock === 0)],
    ],
    doctor: [
      ['My patients', count(s.clients, (c) => c.doctorId === myDoc), true],
      ['Upcoming sessions', count(s.appointments, (a) => a.doctorId === myDoc && a.status === 'approved')],
      ['Awaiting reception', count(s.appointments, (a) => a.doctorId === myDoc && a.status === 'pending')],
      ['Chats unlocked', count(s.clients, (c) => c.doctorId === myDoc && c.treated)],
    ],
    teacher: [
      ['My students', myStudents.value.length, true],
      ['Courses I teach', myCourses.value.length],
      ['Classes this week', count(s.sessions, (x) => x.teacherId === myDoc)],
      ['Unanswered messages', count(myStudents.value, (x) => x.chat.at(-1)?.from === 'student')],
    ],
  }
  return all[role]
})

const mine = (a) => role !== 'doctor' || a.doctorId === myDoc
const schedule = computed(() =>
  state.appointments.filter((a) => a.date === todayStr && a.status === 'approved' && mine(a)).sort((a, b) => a.time.localeCompare(b.time)),
)
const upcoming = computed(() =>
  state.appointments.filter((a) => ['pending', 'approved'].includes(a.status) && mine(a)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5),
)
const mix = computed(() => {
  const m = {}
  state.appointments.filter(mine).forEach((a) => (m[a.service] = (m[a.service] || 0) + 1))
  return Object.entries(m).map(([label, value]) => ({ label, value }))
})
const complaintMix = computed(() => [
  { label: 'Open', value: count(state.complaints, (c) => c.status === 'open'), color: '#b8483f' },
  { label: 'In review', value: count(state.complaints, (c) => c.status === 'in-review'), color: '#cba590' },
  { label: 'Resolved', value: count(state.complaints, (c) => c.status === 'resolved'), color: '#0a7379' },
])
const branchStock = computed(() => BRANCHES.map((b) => ({ label: b.replace('Addis Ababa – ', 'Addis – '), value: state.products.reduce((t, p) => t + p.branches[b], 0) })))
const lowStock = computed(() => state.products.filter((p) => p.stock <= p.reorder))
const classes = computed(() => state.sessions.filter((x) => x.teacherId === myDoc).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)))
const feed = computed(() => ui.notifications.filter((n) => n.roles.includes(role)).slice(0, 5))
const hasAppts = ['ceo', 'reception', 'doctor'].includes(role)
</script>

<template>
  <div class="head">
    <div>
      <h1>{{ t('welcome') }}, {{ state.user.name }}</h1>
      <p>{{ state.user.label }} · {{ new Date().toDateString() }}</p>
    </div>
  </div>

  <div class="grid g4">
    <div v-for="s in stats" :key="s[0]" class="card stat" :class="{ gold: s[2] }">
      <div class="n">{{ s[1] }}</div>
      <div class="l">{{ s[0] }}</div>
    </div>
  </div>

  <div class="grid g2" style="margin-top: 20px">
    <div v-if="can.seeRevenue(role)" class="card">
      <h2>{{ t('revenue') }} <small class="note">ETB</small></h2>
      <BarChart :data="ui.revenue" money />
    </div>
    <div v-if="hasAppts" class="card">
      <h2 style="margin-bottom: 14px">{{ t('mix') }}</h2>
      <Donut :items="mix" center="bookings" />
    </div>
    <div v-if="role === 'ceo'" class="card">
      <h2 style="margin-bottom: 14px">Branch performance <small class="note">bookings this month</small></h2>
      <BarChart :data="ui.branches" />
    </div>
    <div v-if="role === 'gm' || role === 'ceo'" class="card">
      <h2 style="margin-bottom: 14px">Complaint status</h2>
      <Donut :items="complaintMix" center="complaints" />
    </div>
    <div v-if="role === 'gm'" class="card">
      <h2 style="margin-bottom: 14px">Stock by branch <small class="note">units on hand</small></h2>
      <BarChart :data="branchStock" />
    </div>
    <div v-if="role === 'ecommerce' || role === 'gm'" class="card">
      <h2 style="margin-bottom: 10px">Stock alerts</h2>
      <p v-for="p in lowStock" :key="p.id" class="alert-row">
        <span>{{ p.name }}</span>
        <span class="badge" :class="p.stock === 0 ? 'open' : 'pending'">{{ p.stock === 0 ? 'Out of stock' : p.stock + ' left' }}</span>
      </p>
    </div>

    <div v-if="role === 'teacher'" class="card">
      <h2 style="margin-bottom: 8px">My classes</h2>
      <ul class="timeline">
        <li v-for="c in classes" :key="c.id"><b>{{ c.date }} · {{ c.time }} — {{ c.title }}</b><small>{{ courseTitle(c.courseId) }} · {{ c.room }}</small></li>
      </ul>
    </div>
    <div v-if="role === 'teacher'" class="card">
      <h2 style="margin-bottom: 8px">Student progress</h2>
      <p v-for="s in myStudents" :key="s.id" class="alert-row">
        <span>{{ s.name }}<small class="note" style="display: block">{{ courseTitle(s.courseId) }}</small></span>
        <span class="badge" :class="s.status">{{ s.progress }}%</span>
      </p>
    </div>

    <div v-if="hasAppts" class="card">
      <h2 style="margin-bottom: 8px">Today’s schedule</h2>
      <ul class="timeline">
        <li v-for="a in schedule" :key="a.id">
          <b>{{ a.time }} · {{ a.service }}</b>
          <small><ClientLink :id="a.clientId" /><span v-if="role !== 'doctor'"> with {{ doctorName(a.doctorId) }}</span></small>
        </li>
        <li v-if="!schedule.length"><small>No approved sessions today</small></li>
      </ul>
    </div>

    <div class="card">
      <h2 style="margin-bottom: 8px">Live activity <span class="live">● live</span></h2>
      <p v-for="n in feed" :key="n.id" class="alert-row"><span>{{ n.text }}</span><small class="note">{{ n.time }}</small></p>
      <p v-if="!feed.length" class="empty">Waiting for activity from the mobile app…</p>
    </div>
  </div>

  <div v-if="hasAppts" class="card" style="margin-top: 20px">
    <h2 style="margin-bottom: 10px">{{ t('upcoming') }}</h2>
    <table>
      <thead><tr><th>Client</th><th>Treatment</th><th v-if="role !== 'doctor'">Doctor</th><th>When</th><th>Status</th></tr></thead>
      <tbody>
        <tr v-for="a in upcoming" :key="a.id">
          <td><ClientLink :id="a.clientId" /></td>
          <td>{{ a.service }}</td>
          <td v-if="role !== 'doctor'">{{ doctorName(a.doctorId) }}</td>
          <td>{{ a.date }} · {{ a.time }}</td>
          <td><span class="badge" :class="a.status">{{ a.status }}</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
