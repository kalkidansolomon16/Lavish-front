<script setup>
// Dashboard — data from GET /staff/dashboard (cards and panels depend on the portal).
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { t } from '../ui'
import { ago } from '../stores/notifications'
import BarChart from '../components/BarChart.vue'
import Donut from '../components/Donut.vue'

const auth = useAuth()
const data = ref(null)
const error = ref('')
const announcement = ref(null)
// A doctor who also teaches can switch between the two dashboards.
const portals = computed(() => auth.user.roles.filter((r) => ['doctor', 'teacher'].includes(r.key)))
const portal = ref(auth.portal?.key)

const etb = (n) => `ETB ${Number(n).toLocaleString()}`
const when = (iso) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmt = (s) => (s.format === 'money' ? etb(s.value) : s.value)
const COMPLAINT = { open: ['Open', '#b8483f'], in_review: ['In review', '#cba590'], resolved: ['Resolved', '#0a7379'] }

async function load() {
  error.value = ''
  try {
    data.value = (await api.get('/staff/dashboard', { portal: portal.value })).data
  } catch (e) {
    error.value = e.message
  }
}
onMounted(async () => {
  load()
  if (auth.pages.includes('team')) {
    const list = (await api.get('/staff/team/announcements', { per_page: 5 }).catch(() => ({ data: [] }))).data
    announcement.value = list.find((a) => !a.read) ?? null
  }
})
const switchTo = (key) => { portal.value = key; load() }
const showsAppointments = computed(() => !!data.value?.today_schedule)
</script>

<template>
  <RouterLink v-if="announcement" to="/team" class="card ann-banner">
    <span class="ic">📣</span>
    <span><b>{{ announcement.title }}</b><small>{{ announcement.author?.name }} · {{ ago(announcement.created_at) }} — open Lavish Team to read</small></span>
  </RouterLink>

  <div class="head">
    <div>
      <h1>{{ t('welcome') }}, {{ auth.user.name }}</h1>
      <p>{{ auth.user.roles.map((r) => r.label).join(' · ') }} · {{ new Date().toDateString() }}</p>
    </div>
    <div v-if="portals.length > 1" class="tabs" style="margin: 0">
      <button v-for="p in portals" :key="p.key" :class="{ on: portal === p.key }" @click="switchTo(p.key)">{{ p.label }}</button>
    </div>
  </div>

  <p v-if="error" class="card text-bad">{{ error }} <a class="link" @click="load">Try again</a></p>
  <p v-else-if="!data" class="note">Loading…</p>

  <template v-else>
    <div class="grid g4">
      <div v-for="s in data.stats" :key="s.key" class="card stat" :class="{ gold: s.highlight }">
        <div class="n">{{ fmt(s) }}</div>
        <div class="l">{{ s.label }}</div>
      </div>
    </div>

    <div class="grid g2" style="margin-top: 20px">
      <div v-if="data.revenue_week" class="card">
        <h2>{{ t('revenue') }} <small class="note">ETB</small></h2>
        <BarChart :data="data.revenue_week" money />
      </div>
      <div v-if="data.treatment_mix?.length" class="card">
        <h2 style="margin-bottom: 14px">{{ t('mix') }} <small class="note">last 30 days</small></h2>
        <Donut :items="data.treatment_mix" center="bookings" />
      </div>
      <div v-if="data.branch_appointments" class="card">
        <h2 style="margin-bottom: 14px">Branch performance <small class="note">bookings, last 30 days</small></h2>
        <BarChart :data="data.branch_appointments" />
      </div>
      <div v-if="data.complaint_mix" class="card">
        <h2 style="margin-bottom: 14px">Complaint status</h2>
        <Donut :items="data.complaint_mix.map((c) => ({ label: COMPLAINT[c.label][0], value: c.value, color: COMPLAINT[c.label][1] }))" center="complaints" />
      </div>
      <div v-if="data.branch_stock" class="card">
        <h2 style="margin-bottom: 14px">Stock by branch <small class="note">units on hand</small></h2>
        <BarChart :data="data.branch_stock" />
      </div>
      <div v-if="data.low_stock" class="card">
        <h2 style="margin-bottom: 10px">Stock alerts</h2>
        <p v-for="p in data.low_stock" :key="p.id" class="alert-row">
          <span>{{ p.name }}</span>
          <span class="badge" :class="p.stock === 0 ? 'open' : 'pending'">{{ p.stock === 0 ? 'Out of stock' : p.stock + ' left' }}</span>
        </p>
        <p v-if="!data.low_stock.length" class="empty">All products are above their reorder level</p>
      </div>

      <div v-if="data.classes" class="card">
        <h2 style="margin-bottom: 8px">My classes</h2>
        <ul class="timeline">
          <li v-for="c in data.classes" :key="c.id"><b>{{ when(c.starts_at) }} — {{ c.title }}</b><small>{{ c.course?.title }} · {{ c.room }}</small></li>
          <li v-if="!data.classes.length"><small>No upcoming classes</small></li>
        </ul>
      </div>

      <div v-if="showsAppointments" class="card">
        <h2 style="margin-bottom: 8px">Today’s schedule</h2>
        <ul class="timeline">
          <li v-for="a in data.today_schedule" :key="a.id">
            <b>{{ a.time }} · {{ a.is_online ? '🎥 Online session (' + a.duration_minutes + ' min)' : a.service.name }}</b>
            <small>{{ a.client?.name }}<span v-if="portal !== 'doctor'"> with {{ a.doctor?.name ?? 'Unassigned' }}</span></small>
          </li>
          <li v-if="!data.today_schedule.length"><small>No approved sessions today</small></li>
        </ul>
      </div>

      <div class="card">
        <h2 style="margin-bottom: 8px">Latest activity</h2>
        <RouterLink v-for="n in data.notifications" :key="n.id" :to="n.path ?? '/dashboard'" class="alert-row">
          <span><b v-if="!n.read">● </b>{{ n.body }}</span><small class="note">{{ ago(n.created_at) }}</small>
        </RouterLink>
        <p v-if="!data.notifications.length" class="empty">Nothing new yet</p>
      </div>
    </div>

    <div v-if="showsAppointments" class="card" style="margin-top: 20px">
      <h2 style="margin-bottom: 10px">{{ t('upcoming') }}</h2>
      <table>
        <thead><tr><th>Client</th><th>Treatment</th><th v-if="portal !== 'doctor'">Doctor</th><th>When</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-for="a in data.upcoming" :key="a.id">
            <td>{{ a.client?.name }}</td>
            <td>{{ a.is_online ? '🎥 Online consultation' : a.service.name }}</td>
            <td v-if="portal !== 'doctor'">{{ a.doctor?.name ?? 'Unassigned' }}</td>
            <td>{{ a.date }} · {{ a.time }}</td>
            <td><span class="badge" :class="a.status">{{ a.status }}</span></td>
          </tr>
          <tr v-if="!data.upcoming.length"><td colspan="5" class="note">No upcoming appointments</td></tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
