<script setup>
// Product orders — GET /staff/orders. Each step (confirm → prepare → ready → out → delivered) emails the client
// and updates their order in the mobile app. Delivery deducts stock; pay-on-delivery is recorded as cash then.
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import PointsRequests from '../components/rewards/PointsRequests.vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { exportCsv } from '../ui'
import { etb, day, when } from '../fmt'
import ClientLink from '../components/ClientLink.vue'
import PhoneInput from '../components/PhoneInput.vue'
import Pager from '../components/Pager.vue'

const router = useRouter()
const auth = useAuth()
// E-commerce: shop points requests that reception sent (take the points off the client's order).
const view = ref(useRoute().query.tab === 'points' && auth.can('orders.points') ? 'points' : 'orders')
const canUpdate = computed(() => auth.can('orders.deliver'))
const FLOW = [
  { key: 'placed', label: 'Placed', icon: '🛍' }, { key: 'confirmed', label: 'Confirmed', icon: '✓' }, { key: 'preparing', label: 'Preparing', icon: '📦' },
  { key: 'ready', label: 'Ready', icon: '🏷' }, { key: 'out', label: 'Out for delivery', icon: '🚚' }, { key: 'delivered', label: 'Delivered', icon: '🏠' },
]
const idx = (s) => FLOW.findIndex((f) => f.key === s)
const badgeClass = (s) => ({ placed: 'new', confirmed: 'pending', preparing: 'pending', ready: 'pending', out: 'sent', delivered: 'delivered', cancelled: 'declined' })[s]
const TABS = [['open', 'In progress'], ...FLOW.map((s) => [s.key, s.label]), ['cancelled', 'Cancelled'], ['', 'All']]
const PAY = { paid: ['Paid', 'paid'], in_review: ['Receipt to check', 'pending'], unpaid: ['Not paid', 'unpaid'], pending: ['Not paid', 'unpaid'], failed: ['Not paid', 'unpaid'], cancelled: ['Cancelled', 'cancelled'], refund_due: ['Refund due', 'declined'], refunded: ['Refunded', 'cancelled'] }

const tab = ref('open')
const q = ref('')
const rows = ref([])
const meta = ref({})
const page = ref(1)
const error = ref('')
async function load(reset = true) {
  if (reset) page.value = 1
  try {
    const res = await api.get('/staff/orders', { status: tab.value || undefined, q: q.value || undefined, page: page.value, per_page: 40 })
    rows.value = res.data
    meta.value = res.meta
  } catch (e) {
    error.value = e.message
  }
}
let t
watch(q, () => { clearTimeout(t); t = setTimeout(load, 300) })
watch(tab, () => load())
onMounted(load)
const itemsText = (o) => (o.items ?? []).map((i) => `${i.name} ×${i.quantity}`).join(', ')
const replace = (o) => { const i = rows.value.findIndex((x) => x.id === o.id); if (i >= 0) rows.value[i] = o; if (track.value?.id === o.id) track.value = o }

// Tracker modal
const track = ref(null)
const courier = ref({ name: '', phone: '' })
const email = ref(null)
const cancelling = ref(false)
const reason = ref('')
async function openTrack(o) {
  track.value = o
  courier.value = { ...(o.courier ?? { name: '', phone: '' }) }
  cancelling.value = false
  track.value = (await api.get(`/staff/orders/${o.id}`)).data
}
const stamped = (o, key) => o.timeline?.find((s) => s.status === key)?.at

// Confirm delivery only after the client tapped "I received my order" in the app — or with a reason.
const overriding = ref(null) // { o, reason, needReason, needMoney, collected, method, error }
const podOpen = (o) => o.payment_method?.value === 'pay_on_delivery' && ['unpaid', 'pending', 'failed'].includes(o.payment?.status)
async function confirmWithoutClient() {
  const ov = overriding.value
  if (ov.needReason && ov.reason.trim().length < 4) { ov.error = 'Write how you know the client received it (e.g. confirmed by phone).'; return }
  if (ov.needMoney && ov.collected === null) { ov.error = 'Did the courier collect the payment? Choose one.'; return }
  try {
    const res = await api.post(`/staff/orders/${ov.o.id}/advance`, {
      ...(ov.needReason ? { override_reason: ov.reason.trim() } : {}),
      ...(ov.needMoney ? { collected: ov.collected, method: ov.collected ? ov.method : undefined } : {}),
    })
    replace(res.data)
    res.meta?.low_stock?.forEach((p) => notify(`Low stock: ${p.name} — ${p.stock} left`))
    overriding.value = null
    notify(`Order #${ov.o.id}: delivered`)
    if (tab.value !== '' && tab.value !== 'open') load()
  } catch (e) { ov.error = e.message }
}
const waitingForClient = (o) => o.next_action?.status === 'delivered' && !o.received_at

async function advance(o) {
  const step = o.next_action
  if (step.status === 'delivered' && (!o.received_at || podOpen(o))) {
    return (overriding.value = { o, reason: '', needReason: !o.received_at, needMoney: podOpen(o), collected: null, method: 'cash', error: '' })
  }
  if (step.needs_courier && track.value?.id !== o.id) return openTrack(o)
  if (step.needs_courier && !courier.value.name.trim()) return notify('Add the courier’s name first')
  if (!(await ask({ title: `${step.label}?`, body: `Order #${o.id} for ${o.client?.name}.\nThe client gets an email and an app notification.${step.status === 'delivered' ? '\nStock is deducted now.' : ''}`, ok: step.label }))) return
  try {
    const res = await api.post(`/staff/orders/${o.id}/advance`, step.needs_courier ? { courier: courier.value } : {})
    replace(res.data)
    res.meta?.low_stock?.forEach((p) => notify(`Low stock: ${p.name} — ${p.stock} left`))
    notify(`Order #${o.id}: ${res.data.status_label}`)
    if (tab.value !== '' && tab.value !== 'open') load()
  } catch (e) {
    notify(e.message)
  }
}
async function cancel(o) {
  if (!(await ask({ title: 'Cancel this order?', body: `Order #${o.id} for ${o.client?.name} · ${etb(o.total)}.\nThe client is emailed${reason.value.trim() ? ': “' + reason.value.trim() + '”' : ''}.`, ok: 'Cancel order', cancel: 'Keep order', tone: 'danger' }))) return
  try {
    replace((await api.post(`/staff/orders/${o.id}/cancel`, { reason: reason.value.trim() || null })).data)
    cancelling.value = false
    reason.value = ''
    notify('Order cancelled')
  } catch (e) {
    notify(e.message)
  }
}
const paying = ref(null)
async function markPaid() {
  const { o, method } = paying.value
  if (!(await ask({ title: 'Mark as paid?', body: `Order #${o.id} for ${o.client?.name} · ${etb(o.payment?.due_amount ?? o.total)} by ${method.replace('_', ' ')}.`, ok: 'Mark paid' }))) return
  try {
    replace((await api.post(`/staff/orders/${o.id}/mark-paid`, { method })).data)
    paying.value = null
    notify('Payment recorded')
  } catch (e) {
    notify(e.message)
  }
}
async function resend(o) {
  if (!(await ask({ title: 'Resend the latest email?', body: `${o.client?.name} gets the latest order update again.`, ok: 'Resend' }))) return
  try {
    await api.post(`/staff/orders/${o.id}/resend-email`)
    openTrack(o)
    notify('Email sent again')
  } catch (e) {
    notify(e.message)
  }
}
const exportAll = () => exportCsv('lavish-orders', rows.value.map((o) => ({ Order: o.id, Tracking: o.tracking_code, Client: o.client?.name, Email: o.client?.email ?? '', Phone: o.client?.phone, Items: itemsText(o), Total_ETB: o.total, Payment: o.payment?.status, Method: o.payment_method.label, Address: o.delivery_address, Status: o.status_label, Date: o.created_at })))
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

  <div v-if="auth.can('orders.points')" class="seg-top">
    <button :class="{ on: view === 'orders' }" @click="view = 'orders'">Orders</button>
    <button :class="{ on: view === 'points' }" @click="view = 'points'">Clients’ points</button>
  </div>
  <PointsRequests v-if="view === 'points'" />
  <template v-else>
  <div class="tabs" style="flex-wrap: wrap">
    <button v-for="[k, label] in TABS" :key="k" :class="{ on: tab === k }" @click="tab = k">{{ label }}</button>
  </div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>

  <div class="card">
    <table>
      <thead><tr><th>Order</th><th>Client</th><th>Items</th><th>Total</th><th>Payment</th><th style="width: 230px">Delivery tracker</th><th></th></tr></thead>
      <tbody>
        <tr v-for="o in rows" :key="o.id">
          <td>#{{ o.id }}<small>{{ o.tracking_code }} · {{ day(o.created_at) }}</small></td>
          <td><ClientLink :id="o.client?.id" :name="o.client?.name" /><small>{{ o.client?.phone }}</small></td>
          <td>{{ itemsText(o) }}<small v-if="o.prescription_id">From prescription #{{ o.prescription_id }}</small></td>
          <td>{{ etb(o.total) }}<small>incl. delivery {{ etb(o.delivery_fee) }}</small></td>
          <td>
            <span class="badge" :class="PAY[o.payment?.status]?.[1]">{{ PAY[o.payment?.status]?.[0] ?? '—' }}</span>
            <small>{{ o.payment_method.label }}</small>
            <button v-if="o.payment?.status === 'in_review' && auth.can('payments.collect')" class="btn ghost sm" style="margin-top: 4px" @click="router.push('/payments')">Check receipt</button>
            <button v-else-if="['unpaid', 'pending', 'failed'].includes(o.payment?.status) && o.status !== 'cancelled' && canUpdate" class="btn ghost sm" style="margin-top: 4px" @click="paying = { o, method: 'cash' }">Mark paid</button>
          </td>
          <td>
            <span class="badge" :class="badgeClass(o.status)">{{ o.status_label }}</span>
            <div v-if="o.status !== 'cancelled'" class="o-bar"><i v-for="(s, i) in FLOW" :key="s.key" :class="{ on: i <= idx(o.status) }" :title="s.label"></i></div>
            <small v-if="o.received_at" class="rcv ok">✓ Client confirmed receipt {{ when(o.received_at) }}</small>
            <small v-else-if="o.received_override" class="rcv">Confirmed by staff: {{ o.received_override }}</small>
            <small v-else-if="waitingForClient(o)" class="rcv wait">⏳ Waiting for the client to confirm in the app</small>
          </td>
          <td class="row" style="flex-wrap: nowrap">
            <button v-if="canUpdate && o.next_action" class="btn sm" :class="waitingForClient(o) ? 'ghost' : 'gold'" @click="advance(o)">{{ waitingForClient(o) ? 'Confirm without client…' : o.next_action.label }}{{ o.next_action.needs_courier ? '…' : '' }}</button>
            <button class="btn ghost sm" @click="openTrack(o)">Track</button>
          </td>
        </tr>
        <tr v-if="!rows.length"><td colspan="7" class="empty">No orders here</td></tr>
      </tbody>
    </table>
    <Pager :meta="meta" label="orders" @go="(n) => { page = n; load(false) }" />
  </div>
  </template>

  <!-- delivery tracker -->
  <div v-if="track" class="modal-bg" @click.self="track = null">
    <div class="modal" style="width: min(760px, 96vw); max-height: 92vh; overflow: auto">
      <div class="row" style="justify-content: space-between; align-items: flex-start">
        <div>
          <h2>Order #{{ track.id }}</h2>
          <p class="note">Tracking code <b>{{ track.tracking_code }}</b> · {{ track.client?.name }} · {{ track.client?.email }} · {{ track.client?.phone }}</p>
        </div>
        <span class="badge" :class="badgeClass(track.status)">{{ track.status_label }}</span>
      </div>

      <div v-if="track.status !== 'cancelled'" class="o-track">
        <div v-for="(s, i) in FLOW" :key="s.key" class="o-step" :class="{ done: i <= idx(track.status), now: i === idx(track.status) }">
          <span class="o-dot">{{ i <= idx(track.status) ? '✓' : s.icon }}</span>
          <b>{{ s.label }}</b>
          <small>{{ stamped(track, s.key) ? when(stamped(track, s.key)) : '—' }}</small>
        </div>
      </div>
      <p v-else class="card" style="background: #f6dedb; margin-top: 14px">Cancelled{{ track.cancel_reason ? ': ' + track.cancel_reason : '' }}</p>

      <div class="grid g2" style="margin-top: 16px; gap: 14px">
        <div class="card" style="background: var(--bg)">
          <h3>Delivery</h3>
          <p class="note" style="margin-top: 6px">{{ track.delivery_address }}<template v-if="track.delivery_note"> · {{ track.delivery_note }}</template><template v-if="track.contact_phone"> · ☎ {{ track.contact_phone }}</template></p>
          <p class="note">{{ itemsText(track) }} · <b>{{ etb(track.total) }}</b> · {{ track.payment_method.label }} ({{ PAY[track.payment?.status]?.[0] }})</p>
          <template v-if="canUpdate && track.next_action?.needs_courier">
            <label>Courier name</label><input v-model="courier.name" placeholder="e.g. Yared Bekele" />
            <label>Courier phone</label><PhoneInput v-model="courier.phone" />
          </template>
          <p v-else-if="track.courier" class="note" style="margin-top: 8px">🚚 Courier: <b>{{ track.courier.name }}</b> {{ track.courier.phone }}</p>
        </div>
        <div class="card" style="background: var(--bg)">
          <h3>Status history</h3>
          <ul class="o-hist">
            <li v-for="(h, i) in [...(track.history ?? [])].reverse()" :key="i">
              <b>{{ h.status === 'cancelled' ? 'Cancelled' : FLOW[idx(h.status)]?.label }}</b>
              <small>{{ when(h.at) }} · {{ h.by }}{{ h.note ? ' · ' + h.note : '' }}</small>
            </li>
          </ul>
        </div>
      </div>

      <div class="card" style="margin-top: 14px">
        <div class="row" style="justify-content: space-between">
          <h3>Emails to {{ track.client?.email ?? 'the client' }}</h3>
          <button v-if="canUpdate && track.emails?.length" class="btn ghost sm" @click="resend(track)">Resend latest</button>
        </div>
        <div v-for="(e, i) in [...(track.emails ?? [])].reverse()" :key="i" class="alert-row">
          <span>✉ <b>{{ e.subject }}</b><small class="note" style="display: block">{{ when(e.at) }} · {{ e.status }}</small></span>
          <button class="btn ghost sm" @click="email = e">View</button>
        </div>
        <p v-if="!track.emails?.length" class="note">{{ track.client?.email ? 'No emails yet.' : 'This client has no email address — they follow the order in the app.' }}</p>
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
        <button v-if="auth.can('orders.cancel') && track.next_action && !cancelling" class="btn danger" @click="cancelling = true">Cancel order</button>
        <span v-else></span>
        <div class="row">
          <button class="btn ghost" @click="track = null">Close</button>
          <button v-if="canUpdate && track.next_action" class="btn" :class="waitingForClient(track) ? 'ghost' : 'gold'" @click="advance(track)">{{ waitingForClient(track) ? 'Confirm without client…' : track.next_action.label + ' & email client' }}</button>
        </div>
      </div>
      <p v-if="waitingForClient(track)" class="note" style="margin-top: 10px">⏳ Waiting for {{ track.client?.name }} to tap “I received my order” in the app. You’ll get a notification — then confirm the delivery.</p>
      <p v-else-if="track.received_at && track.next_action?.status === 'delivered'" class="note" style="margin-top: 10px; color: var(--teal-deep)">✓ {{ track.client?.name }} confirmed they received it {{ when(track.received_at) }}. Confirm the delivery.</p>
    </div>
  </div>

  <div v-if="overriding" class="modal-bg" style="z-index: 45" @click.self="overriding = null">
    <form class="modal" @submit.prevent="confirmWithoutClient">
      <h2>Confirm delivery of order #{{ overriding.o.id }}</h2>
      <p class="note">{{ overriding.o.client?.name }} · {{ etb(overriding.o.total) }} · {{ overriding.o.payment_method?.label }}</p>
      <template v-if="overriding.needReason">
        <p class="note" style="margin-top: 10px">⏳ The client hasn’t tapped “I received my order” in the app yet. If you know they received it, write how — it is saved with the order.</p>
        <label class="lbl">How do you know?</label>
        <input v-model="overriding.reason" minlength="4" maxlength="255" placeholder="e.g. Client confirmed by phone · courier photo" style="width: 100%" />
      </template>
      <p v-else class="note" style="margin-top: 10px; color: var(--teal-deep)">✓ The client confirmed they received it {{ when(overriding.o.received_at) }}.</p>
      <template v-if="overriding.needMoney">
        <label class="lbl">Pay on delivery — did the courier collect {{ etb(overriding.o.payment?.due_amount ?? overriding.o.total) }}?</label>
        <div class="row" style="gap: 8px">
          <button type="button" class="btn sm" :class="overriding.collected === true ? 'gold' : 'ghost'" @click="overriding.collected = true">Yes, collected</button>
          <button type="button" class="btn sm" :class="overriding.collected === false ? 'danger' : 'ghost'" @click="overriding.collected = false">Not paid yet</button>
        </div>
        <select v-if="overriding.collected" v-model="overriding.method" style="width: 100%; margin-top: 8px">
          <option value="cash">Cash</option><option value="telebirr">Telebirr</option><option value="cbe_birr">CBE Birr</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option>
        </select>
        <p v-if="overriding.collected === false" class="note" style="margin-top: 6px">The order is marked delivered but stays <b>unpaid</b>: it shows under Payments → Finished, not paid, and the client is asked to pay.</p>
      </template>
      <p v-if="overriding.error" class="note" style="color: var(--bad)">{{ overriding.error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 14px"><button type="button" class="btn ghost" @click="overriding = null">Cancel</button><button class="btn gold">Confirm delivery</button></div>
    </form>
  </div>

  <!-- mark paid -->
  <div v-if="paying" class="modal-bg" @click.self="paying = null">
    <form class="modal" @submit.prevent="markPaid">
      <h2>Mark order #{{ paying.o.id }} paid</h2>
      <p class="note">{{ paying.o.client?.name }} · {{ etb(paying.o.payment?.due_amount ?? paying.o.total) }}</p>
      <label>Paid with</label>
      <select v-model="paying.method"><option value="cash">Cash</option><option value="telebirr">Telebirr</option><option value="cbe_birr">CBE Birr</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option></select>
      <div class="row" style="justify-content: flex-end; margin-top: 16px"><button type="button" class="btn ghost" @click="paying = null">Cancel</button><button class="btn gold">Mark paid</button></div>
    </form>
  </div>

  <!-- email preview -->
  <div v-if="email" class="modal-bg" @click.self="email = null">
    <div class="modal email-prev">
      <p class="note">To: {{ email.to }} · {{ when(email.at) }}</p>
      <h2>{{ email.subject }}</h2>
      <div class="mail"><img src="/img/logo-white.png" alt="Lavish" /><p style="white-space: pre-line">{{ email.body }}</p></div>
      <div class="row" style="margin-top: 16px; justify-content: flex-end"><button class="btn gold" @click="email = null">Close</button></div>
    </div>
  </div>
</template>

<style scoped>
td small { display: block; color: var(--muted); font-size: 12px; }
label { display: block; font-size: 13px; margin: 10px 0 4px; }
.seg-top { display: inline-flex; gap: 4px; padding: 4px; border-radius: 12px; background: #f3f2f0; margin-bottom: 14px; }
.seg-top button { padding: 8px 16px; border: 0; border-radius: 9px; background: none; cursor: pointer; font-size: 13.5px; }
.seg-top button.on { background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .1); color: var(--teal-deep); }
.rcv { display: block; margin-top: 4px; font-size: 11.5px; color: var(--muted); }
.rcv.ok { color: var(--teal-deep); }
.rcv.wait { color: #a2581a; }
.lbl { display: block; margin: 14px 0 6px; font-size: 13px; }
</style>
