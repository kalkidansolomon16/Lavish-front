<script setup>
// Clients — GET /staff/clients (doctors see only their own patients; the server decides).
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { ui } from '../ui'
import { day } from '../fmt'
import ClientLink from '../components/ClientLink.vue'
import Pager from '../components/Pager.vue'

const auth = useAuth()
const isDoctor = computed(() => !auth.can('appointments.approve', 'appointments.create', 'clients.history') && !!auth.user?.doctor_id)
const rows = ref([])
const meta = ref({})
const q = ref('')
const filter = ref('')
const page = ref(1)
const loading = ref(false)
const error = ref('')

async function load(reset = true) {
  if (reset) page.value = 1
  loading.value = true
  try {
    const res = await api.get('/staff/clients', { q: q.value || undefined, has_app: filter.value === 'app' ? 1 : filter.value === 'noapp' ? 0 : undefined, page: page.value, per_page: 40 })
    rows.value = res.data
    meta.value = res.meta
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
let t
watch(q, () => { clearTimeout(t); t = setTimeout(load, 300) })
watch(() => ui.drawerClient, (id, old) => { if (!id && old) load() }) // refresh after editing in the drawer
onMounted(load)

async function invite(c) {
  if (!(await ask({ title: c.app_invited_at ? 'Resend the app link?' : 'Send the app link?', body: `${c.name} (${c.phone}) gets an SMS with the link to download the Lavish app. When they sign up with this phone number, their history and bookings are linked automatically.`, ok: 'Send link' }))) return
  try {
    notify((await api.post(`/staff/clients/${c.id}/invite`)).message)
    c.app_invited_at = new Date().toISOString()
  } catch (e) {
    notify(e.message)
  }
}
</script>

<template>
  <div class="head">
    <div>
      <h1>{{ isDoctor ? 'My patients' : 'Clients' }}</h1>
      <p v-if="isDoctor">Your patients and the history reception recorded for them. Click a name to open the full profile.</p>
      <p v-else>Clients from the mobile app and walk-ins. Send walk-in clients the app link — signing up with the same phone links their record.</p>
    </div>
  </div>
  <div class="row" style="gap: 8px; margin-bottom: 12px">
    <div class="tabs" style="margin: 0"><button v-for="[k, l] in [['', 'All'], ['app', 'On the app'], ['noapp', 'No app yet']]" :key="k" :class="{ on: filter === k }" @click="filter = k; load()">{{ l }}</button></div>
    <input v-model="q" placeholder="Search name, phone or email" style="max-width: 280px; margin-left: auto" />
  </div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>
  <div class="card">
    <table>
      <thead><tr><th>Name</th><th>Phone</th><th>Doctor</th><th>History</th><th>Last treatment</th><th v-if="!isDoctor">Mobile app</th></tr></thead>
      <tbody>
        <tr v-for="c in rows" :key="c.id">
          <td><ClientLink :id="c.id" :name="c.name" /><small>Joined {{ day(c.joined_at) }} · {{ { app: 'App', walk_in: 'Walk-in', phone_call: 'Phone call', referral: 'Referral' }[c.source] ?? c.source }}</small></td>
          <td>{{ c.phone }}</td>
          <td>{{ c.primary_doctor?.name ?? '—' }}</td>
          <td>
            <a v-if="c.history" class="link" @click="ui.drawerClient = c.id">{{ c.history.concern || 'On file' }}</a>
            <button v-else-if="auth.can('clients.history')" class="btn ghost sm" @click="ui.drawerClient = c.id">+ Record history</button>
            <span v-else class="note">Not recorded</span>
            <small v-if="c.history">{{ c.history.source }}<template v-if="c.history.recorded_by"> · by {{ c.history.recorded_by }}</template></small>
          </td>
          <td>{{ c.last_treatment ?? '—' }}</td>
          <td v-if="!isDoctor">
            <span v-if="c.has_app" class="badge active">Registered</span>
            <template v-else-if="auth.can('clients.invite')">
              <button class="btn ghost sm" @click="invite(c)">{{ c.app_invited_at ? 'Resend link' : 'Send app link' }}</button>
              <small v-if="c.app_invited_at">Link sent {{ day(c.app_invited_at) }}</small>
            </template>
            <span v-else class="note">No app</span>
          </td>
        </tr>
        <tr v-if="!rows.length && !loading"><td colspan="6" class="empty">{{ q ? 'No clients match' : 'No clients yet — they appear when they sign up in the app or reception books a walk-in.' }}</td></tr>
      </tbody>
    </table>
    <Pager :meta="meta" label="clients" @go="(n) => { page = n; load(false) }" />
  </div>
</template>

<style scoped>
td small { display: block; color: var(--muted); font-size: 12px; }
</style>
