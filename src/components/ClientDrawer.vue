<script setup>
// Client drawer — GET /staff/clients/{id}: profile, intake history, visits, payments, orders, prescriptions.
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ui } from '../ui'
import { notify } from '../store'
import { ask } from '../confirm'
import { etb, day } from '../fmt'

const router = useRouter()
const auth = useAuth()
const c = ref(null)
const loyalty = ref(null)
const error = ref('')
const history = ref(null) // editable copy
const notes = ref('')
const saving = ref(false)

const FIELDS = [['concern', 'Main concern'], ['skin_type', 'Skin type'], ['allergies', 'Allergies'], ['medications', 'Medications'], ['conditions', 'Medical conditions'], ['previous_treatments', 'Previous treatments'], ['pregnant', 'Pregnant / breastfeeding']]
const editable = computed(() => auth.can('clients.history'))
const money = computed(() => auth.can('finance.revenue'))
const initials = computed(() => (c.value?.name ?? '').split(' ').map((w) => w[0]).join('').slice(0, 2))

async function load(id) {
  c.value = null
  loyalty.value = null
  error.value = ''
  try {
    c.value = (await api.get(`/staff/clients/${id}`)).data
    history.value = c.value.history ? { ...c.value.history } : null
    notes.value = c.value.notes ?? ''
    if (auth.can('page.rewards')) loyalty.value = (await api.get(`/staff/rewards/clients/${id}`).catch(() => null))?.data ?? null
  } catch (e) {
    error.value = e.message
  }
}
watch(() => ui.drawerClient, (id) => id && load(id))
const close = () => (ui.drawerClient = null)

const startHistory = () => (history.value = { source: 'Walk-in', concern: '', skin_type: 'Normal', allergies: '', medications: '', conditions: '', previous_treatments: '', pregnant: 'No' })
async function saveHistory() {
  if (!(await ask({ title: 'Save client history?', body: c.value.name, ok: 'Save' }))) return
  saving.value = true
  try {
    const h = { ...history.value }
    delete h.recorded_by; delete h.updated_at
    c.value.history = (await api.put(`/staff/clients/${c.value.id}/history`, h)).data
    history.value = { ...c.value.history }
    notify('History saved')
  } catch (e) {
    notify(e.message)
  } finally {
    saving.value = false
  }
}
async function saveNotes() {
  if (notes.value === (c.value.notes ?? '')) return
  try {
    await api.patch(`/staff/clients/${c.value.id}`, { notes: notes.value })
    c.value.notes = notes.value
    notify('Notes saved')
  } catch (e) {
    notify(e.message)
  }
}
const prescribe = () => { const id = c.value.id; close(); router.push({ path: '/prescriptions', query: { client: id } }) }
const chat = () => { close(); router.push('/chat') }
</script>

<template>
  <Transition name="slide">
    <div v-if="ui.drawerClient" class="drawer-bg" @click.self="close">
      <aside class="drawer">
        <button class="x" @click="close">✕</button>
        <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>
        <p v-else-if="!c" class="note">Loading…</p>
        <template v-if="c">
          <div class="avatar">{{ initials }}</div>
          <h2>{{ c.name }}</h2>
          <p class="note">{{ c.phone }}<template v-if="c.email"> · {{ c.email }}</template> · Joined {{ day(c.joined_at) }}</p>
          <div class="row" style="margin: 12px 0">
            <span v-if="c.primary_doctor" class="badge active">{{ c.primary_doctor.name }}</span>
            <span class="badge" :class="c.treated ? 'active' : 'pending'">{{ c.treated ? 'Chat unlocked' : 'First visit pending' }}</span>
            <span class="badge" :class="c.has_app ? 'active' : 'pending'">{{ c.has_app ? 'On the app' : 'No app yet' }}</span>
            <span v-if="loyalty?.rewards?.member" class="badge sent">{{ loyalty.rewards.tier?.name }} · {{ loyalty.rewards.points_balance.toLocaleString() }} pts</span>
          </div>
          <div class="grid g4" style="grid-template-columns: 1fr 1fr; margin: 14px 0">
            <div class="card stat"><div class="n">{{ c.appointments?.length ?? 0 }}</div><div class="l">Visits</div></div>
            <div v-if="money" class="card stat gold"><div class="n" style="font-size: 26px">{{ etb(c.total_spent ?? 0) }}</div><div class="l">Lifetime spend</div></div>
            <div v-else class="card stat gold"><div class="n" style="font-size: 26px">{{ c.preferred_branch?.name ?? '—' }}</div><div class="l">Branch</div></div>
          </div>

          <h3>Client history <small v-if="c.history" class="note">{{ c.history.source }} · recorded by {{ c.history.recorded_by }} · {{ day(c.history.updated_at) }}</small></h3>
          <div v-if="history" class="card" style="padding: 12px 16px; margin: 8px 0 16px">
            <div v-for="[k, label] in FIELDS" :key="k" class="row" style="justify-content: space-between; padding: 5px 0; flex-wrap: nowrap">
              <small class="note" style="flex-shrink: 0">{{ label }}</small>
              <input v-if="editable" v-model="history[k]" style="max-width: 60%; padding: 5px 8px" />
              <span v-else style="text-align: right" :style="{ color: k === 'allergies' && history[k] && !/none/i.test(history[k]) ? 'var(--bad)' : '' }">{{ history[k] || '—' }}</span>
            </div>
            <div v-if="editable" class="row" style="justify-content: flex-end; margin-top: 8px"><button class="btn gold sm" :disabled="saving" @click="saveHistory">Save history</button></div>
          </div>
          <button v-else-if="editable" class="btn ghost sm" style="margin: 8px 0 16px" @click="startHistory">+ Record history</button>
          <p v-else class="note" style="margin: 8px 0 16px">Reception hasn’t recorded a history yet.</p>

          <h3>Treatment timeline</h3>
          <ul class="timeline">
            <li v-for="a in c.appointments" :key="a.id">
              <b>{{ a.is_online ? '🎥 Online consultation' : a.service?.name }}</b><small>{{ a.date }} · {{ a.time }} · {{ a.status }}<template v-if="a.doctor"> · {{ a.doctor.name }}</template></small>
            </li>
            <li v-if="!c.appointments?.length"><small>No visits yet</small></li>
          </ul>

          <template v-if="money">
            <h3>Orders & payments</h3>
            <ul class="timeline">
              <li v-for="p in c.payments" :key="'p' + p.id"><b>{{ p.description }} — {{ etb(p.amount) }}</b><small>{{ p.method?.label ?? '—' }} · {{ p.status.replace('_', ' ') }}</small></li>
              <li v-for="o in c.orders" :key="'o' + o.id"><b>Order #{{ o.id }} — {{ etb(o.total) }}</b><small>{{ o.status?.label ?? o.status }}</small></li>
              <li v-if="!c.payments?.length && !c.orders?.length"><small>None yet</small></li>
            </ul>
          </template>

          <h3>Prescriptions</h3>
          <ul class="timeline">
            <li v-for="r in c.prescriptions" :key="r.id"><b>{{ r.items?.length ?? 0 }} item(s) — {{ r.status }}</b><small>{{ day(r.created_at) }} · {{ r.doctor?.name }}</small></li>
            <li v-if="!c.prescriptions?.length"><small>None yet</small></li>
          </ul>

          <h3>Private notes</h3>
          <textarea v-model="notes" rows="3" :readonly="!editable" placeholder="Allergies, preferences, follow-up reminders…" @blur="editable && saveNotes()"></textarea>
          <div class="row" style="margin-top: 14px">
            <button v-if="auth.can('prescriptions.create')" class="btn gold" @click="prescribe">+ Prescribe</button>
            <button v-if="auth.can('page.chat') && c.treated" class="btn ghost" @click="chat">Open chat</button>
            <button class="btn ghost" @click="close">Close</button>
          </div>
        </template>
      </aside>
    </div>
  </Transition>
</template>
