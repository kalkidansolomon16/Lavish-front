<script setup>
import { ref, computed } from 'vue'
import ClientLink from '../components/ClientLink.vue'
import { state, actions, clientName, etb, can, ORDER_FLOW, flowIndex, nextStep, orderOpen, trackingCode } from '../store'
import { exportCsv, pushNotif } from '../ui'

const canUpdate = can('orders.deliver')
const product = (id) => state.products.find((p) => p.id === id)
const client = (id) => state.clients.find((c) => c.id === id)
const short = (o) => orderOpen(o) && (o.lines ?? []).filter((l) => product(l.productId).stock < l.qty).map((l) => product(l.productId).name)
const stepOf = (key) => ORDER_FLOW.find((s) => s.key === key)
const statusLabel = (o) => (o.status === 'cancelled' ? 'Cancelled' : stepOf(o.status)?.label)
const badgeClass = (o) => ({ placed: 'new', confirmed: 'pending', preparing: 'pending', ready: 'pending', out: 'sent', delivered: 'delivered', cancelled: 'declined' })[o.status]

// Tabs per status, plus search by order number, tracking code, client name, email or phone.
const tab = ref('active')
const q = ref('')
const TABS = [['active', 'In progress'], ...ORDER_FLOW.map((s) => [s.key, s.label]), ['cancelled', 'Cancelled'], ['all', 'All']]
const inTab = (o, t) => t === 'all' || (t === 'active' ? orderOpen(o) : o.status === t)
const count = (t) => state.orders.filter((o) => inTab(o, t)).length
const rows = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return state.orders.filter((o) => inTab(o, tab.value)).filter((o) => {
    if (!needle) return true
    const c = client(o.clientId)
    return [String(o.id), trackingCode(o), c?.name, c?.email, c?.phone].some((v) => v?.toLowerCase().includes(needle))
  })
})

// Tracker modal
const track = ref(null)
const courier = ref({ name: '', phone: '' })
const email = ref(null)
const cancelling = ref(false)
const reason = ref('')
const openTrack = (o) => { track.value = o; courier.value = { ...(o.courier ?? { name: '', phone: '' }) }; cancelling.value = false }
const stamped = (o, key) => o.history?.find((h) => h.status === key)

function advance(o) {
  const step = nextStep(o)
  const low = actions.advanceOrder(o, step?.key === 'out' ? { courier: { ...courier.value } } : {})
  if (low === null) return
  low?.forEach((p) => pushNotif(`Low stock: ${p.name} — ${p.stock} left`, ['ecommerce', 'gm', 'ceo'], '/products'))
}
function cancel(o) {
  actions.cancelOrder(o, reason.value.trim())
  cancelling.value = false
  reason.value = ''
}
const exportAll = () => exportCsv('lavish-orders', state.orders.map((o) => ({ Order: o.id, Tracking: trackingCode(o), Client: clientName(o.clientId), Email: client(o.clientId)?.email ?? '', Items: o.items, Total_ETB: o.total, Payment: o.payment, Address: o.address, Status: statusLabel(o) })))
</script>

<template>
  <div class="head">
    <div>
      <h1>Product orders</h1>
      <p>Move each order through the delivery tracker. Every step emails the client and updates their order in the mobile app.</p>
    </div>
    <div class="row">
      <input v-model="q" placeholder="Search order no., client, email or phone…" style="width: 300px" />
      <button class="btn ghost" @click="exportAll">⬇ Export CSV</button>
    </div>
  </div>

  <div class="tabs" style="flex-wrap: wrap">
    <button v-for="[k, label] in TABS" :key="k" :class="{ on: tab === k }" @click="tab = k">{{ label }} · {{ count(k) }}</button>
  </div>

  <div class="card">
    <table>
      <thead><tr><th>Order</th><th>Client</th><th>Items</th><th>Total</th><th>Payment</th><th style="width: 230px">Delivery tracker</th><th></th></tr></thead>
      <tbody>
        <tr v-for="o in rows" :key="o.id">
          <td>#{{ o.id }}<small>{{ trackingCode(o) }} · {{ o.date }}</small></td>
          <td><ClientLink :id="o.clientId" /><small>{{ client(o.clientId)?.email }}</small></td>
          <td>
            {{ o.items }}
            <small v-if="short(o)?.length" style="color: var(--bad)">⚠ Not enough stock: {{ short(o).join(', ') }}</small>
          </td>
          <td>{{ etb(o.total) }}</td>
          <td>
            <span class="badge" :class="o.payment === 'paid' ? 'paid' : 'unpaid'">{{ o.payment === 'paid' ? 'paid' : 'not paid' }}</span>
            <small>{{ o.method || '—' }}</small>
            <button v-if="o.payment !== 'paid' && o.status !== 'cancelled' && canUpdate" class="btn ghost sm" style="margin-top: 4px" @click="actions.markOrderPaid(o)">Mark paid</button>
          </td>
          <td>
            <span class="badge" :class="badgeClass(o)">{{ statusLabel(o) }}</span>
            <div v-if="o.status !== 'cancelled'" class="o-bar">
              <i v-for="(s, i) in ORDER_FLOW" :key="s.key" :class="{ on: i <= flowIndex(o.status) }" :title="s.label"></i>
            </div>
            <small v-if="o.emails?.length">✉ {{ o.emails.length }} email(s) sent</small>
          </td>
          <td class="row" style="flex-wrap: nowrap">
            <button v-if="canUpdate && nextStep(o) && nextStep(o).key !== 'out'" class="btn gold sm" @click="advance(o)">{{ nextStep(o).next }}</button>
            <button v-else-if="canUpdate && nextStep(o)" class="btn gold sm" @click="openTrack(o)">{{ nextStep(o).next }}…</button>
            <button class="btn ghost sm" @click="openTrack(o)">Track</button>
          </td>
        </tr>
        <tr v-if="!rows.length"><td colspan="7" class="empty">No orders here</td></tr>
      </tbody>
    </table>
  </div>

  <!-- delivery tracker -->
  <div v-if="track" class="modal-bg" @click.self="track = null">
    <div class="modal" style="width: min(760px, 96vw); max-height: 92vh; overflow: auto">
      <div class="row" style="justify-content: space-between; align-items: flex-start">
        <div>
          <h2>Order #{{ track.id }}</h2>
          <p class="note">Tracking code <b>{{ trackingCode(track) }}</b> · {{ clientName(track.clientId) }} · {{ client(track.clientId)?.email }} · {{ client(track.clientId)?.phone }}</p>
        </div>
        <span class="badge" :class="badgeClass(track)">{{ statusLabel(track) }}</span>
      </div>

      <div v-if="track.status !== 'cancelled'" class="o-track">
        <div v-for="(s, i) in ORDER_FLOW" :key="s.key" class="o-step" :class="{ done: i <= flowIndex(track.status), now: i === flowIndex(track.status) }">
          <span class="o-dot">{{ i <= flowIndex(track.status) ? '✓' : s.icon }}</span>
          <b>{{ s.label }}</b>
          <small>{{ stamped(track, s.key)?.at ?? '—' }}</small>
        </div>
      </div>
      <p v-else class="card" style="background: #f6dedb; margin-top: 14px">Cancelled{{ track.history.at(-1)?.note ? ': ' + track.history.at(-1).note : '' }}</p>

      <div class="grid g2" style="margin-top: 16px; gap: 14px">
        <div class="card" style="background: var(--bg)">
          <h3>Delivery</h3>
          <p class="note" style="margin-top: 6px">{{ track.address }}</p>
          <p class="note">{{ track.items }} · <b>{{ etb(track.total) }}</b> · {{ track.method }} ({{ track.payment === 'paid' ? 'paid' : 'not paid' }})</p>
          <template v-if="canUpdate && nextStep(track)?.key === 'out'">
            <label>Courier name</label><input v-model="courier.name" placeholder="e.g. Yared Bekele" />
            <label>Courier phone</label><input v-model="courier.phone" placeholder="+251 …" />
          </template>
          <p v-else-if="track.courier" class="note" style="margin-top: 8px">🚚 Courier: <b>{{ track.courier.name }}</b> {{ track.courier.phone }}</p>
        </div>

        <div class="card" style="background: var(--bg)">
          <h3>Status history</h3>
          <ul class="o-hist">
            <li v-for="(h, i) in [...track.history].reverse()" :key="i">
              <b>{{ h.status === 'cancelled' ? 'Cancelled' : stepOf(h.status).label }}</b>
              <small>{{ h.at }} · {{ h.by }}{{ h.note ? ' · ' + h.note : '' }}</small>
            </li>
          </ul>
        </div>
      </div>

      <div class="card" style="margin-top: 14px">
        <div class="row" style="justify-content: space-between">
          <h3>Emails to {{ client(track.clientId)?.email }}</h3>
          <button v-if="canUpdate && track.emails?.length" class="btn ghost sm" @click="actions.resendOrderEmail(track)">Resend latest</button>
        </div>
        <div v-for="(e, i) in [...(track.emails ?? [])].reverse()" :key="i" class="alert-row">
          <span>✉ <b>{{ e.subject }}</b><small class="note" style="display: block">{{ e.at }}{{ e.resent ? ' · re-sent' : '' }}</small></span>
          <button class="btn ghost sm" @click="email = e">View</button>
        </div>
      </div>

      <div v-if="cancelling" class="card" style="margin-top: 14px">
        <label style="margin-top: 0">Reason (included in the email to the client)</label>
        <input v-model="reason" placeholder="e.g. Product out of stock — we’ll contact you about a replacement" />
        <div class="row" style="margin-top: 10px; justify-content: flex-end">
          <button class="btn ghost sm" @click="cancelling = false">Keep order</button>
          <button class="btn danger sm" @click="cancel(track)">Cancel order & email client</button>
        </div>
      </div>

      <div class="row" style="margin-top: 18px; justify-content: space-between">
        <button v-if="canUpdate && orderOpen(track) && !cancelling" class="btn danger" @click="cancelling = true">Cancel order</button>
        <span v-else></span>
        <div class="row">
          <button class="btn ghost" @click="track = null">Close</button>
          <button v-if="canUpdate && nextStep(track)" class="btn gold" @click="advance(track)">{{ nextStep(track).next }} & email client</button>
        </div>
      </div>
    </div>
  </div>

  <!-- email preview -->
  <div v-if="email" class="modal-bg" @click.self="email = null">
    <div class="modal email-prev">
      <p class="note">To: {{ email.to }} · {{ email.at }}</p>
      <h2>{{ email.subject }}</h2>
      <div class="mail">
        <img src="/img/logo-white.png" alt="Lavish" />
        <p>{{ email.body }}</p>
      </div>
      <div class="row" style="margin-top: 16px; justify-content: flex-end"><button class="btn gold" @click="email = null">Close</button></div>
    </div>
  </div>
</template>
