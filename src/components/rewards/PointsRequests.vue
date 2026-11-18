<script setup>
// Members' requests to use points (sent from the app: Rewards → Use my points).
// Reception (rewards.requests): treatment → take it off the client's treatment bill; shop → send to e-commerce;
// other → mark done with a note; or reject. E-commerce (orders.points) sees shop requests sent to them and takes
// the points off the client's shop order. Points are taken only when a request is completed.
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../../api/http'
import { useAuth } from '../../stores/auth'
import { ask } from '../../confirm'
import { notify } from '../../store'
import { etb, pts, when } from '../../fmt'
import Pager from '../Pager.vue'

const auth = useAuth()
const reception = computed(() => auth.can('rewards.requests'))
const STATUS = { pending: 'New', forwarded: 'With e-commerce', completed: 'Done', rejected: 'Not approved', cancelled: 'Cancelled by client' }
const BADGE = { pending: 'new', forwarded: 'pending', completed: 'paid', rejected: 'declined', cancelled: 'cancelled' }
const KIND = { shop: '🛍 Shop products', treatment: '✦ Treatment', other: '• Other' }
const TABS = computed(() => [['open', reception.value ? 'To handle' : 'To take off orders'], ['completed', 'Done'], ['rejected', 'Not approved'], ...(reception.value ? [['cancelled', 'Cancelled']] : [])])

const status = ref('open')
const kind = ref('')
const q = ref('')
const rows = ref([])
const meta = ref({})
const page = ref(1)
const error = ref('')
const open = ref(null) // { request, bills, history, point_value_etb, payment_id, note, reason, mode, error }

async function load() {
  error.value = ''
  try {
    const res = await api.get('/staff/rewards/requests', { status: status.value, kind: kind.value || undefined, q: q.value || undefined, page: page.value, per_page: 20 })
    rows.value = res.data
    meta.value = res.meta
  } catch (e) { error.value = e.message }
}
let t
watch(q, () => { clearTimeout(t); t = setTimeout(() => { page.value = 1; load() }, 300) })
watch([status, kind], () => { page.value = 1; load() })
onMounted(load)

async function show(r) {
  const d = (await api.get(`/staff/rewards/requests/${r.id}`)).data
  open.value = { ...d, payment_id: d.bills[0]?.id ?? null, note: '', reason: '', mode: d.request.kind === 'other' || !d.bills.length ? 'note' : 'bill', error: '' }
}
const req = computed(() => open.value?.request)
const bill = computed(() => open.value?.bills.find((b) => b.id === open.value.payment_id))
const takeOff = computed(() => (bill.value ? Math.min(bill.value.due_amount ?? bill.value.amount, req.value.value_etb) : req.value?.value_etb))
const canComplete = computed(() => req.value && (reception.value || req.value.status === 'forwarded'))

async function complete() {
  const o = open.value
  const r = o.request
  const useBill = o.mode === 'bill' && bill.value
  if (!useBill && !o.note.trim()) { o.error = 'Write how the points were used (or choose a bill).'; return }
  if (!(await ask({
    title: `Use ${pts(r.points)} for ${r.client.name}?`,
    body: useBill ? `${etb(takeOff.value)} off “${bill.value.description}”.\nThe points are taken from the client’s balance now.` : `Note: ${o.note.trim()}\nThe points are taken from the client’s balance now.`,
    ok: 'Use points',
  }))) return
  try {
    await api.post(`/staff/rewards/requests/${r.id}/complete`, useBill ? { payment_id: bill.value.id, note: o.note.trim() || undefined } : { note: o.note.trim() })
    notify(`${r.client.name}: points used`)
    open.value = null
    load()
  } catch (e) { o.error = e.message }
}
async function forward() {
  const o = open.value
  if (!(await ask({ title: 'Send to e-commerce?', body: `${o.request.client.name} wants ${pts(o.request.points)} (${etb(o.request.value_etb)}) off a shop order.\nThe e-commerce team is notified and takes it off the order.`, ok: 'Send' }))) return
  try {
    await api.post(`/staff/rewards/requests/${o.request.id}/forward`, { note: o.note.trim() || undefined })
    notify('Sent to e-commerce')
    open.value = null
    load()
  } catch (e) { o.error = e.message }
}
async function reject() {
  const o = open.value
  if (o.reason.trim().length < 3) { o.error = 'Write a short reason — the client sees it.'; return }
  if (!(await ask({ title: 'Not approve this request?', body: `The client is told: “${o.reason.trim()}”. Their points are free again.`, ok: 'Not approve', tone: 'danger' }))) return
  try {
    await api.post(`/staff/rewards/requests/${o.request.id}/reject`, { reason: o.reason.trim() })
    notify('Request not approved')
    open.value = null
    load()
  } catch (e) { o.error = e.message }
}
</script>

<template>
  <div class="row" style="gap: 8px; margin-bottom: 12px; flex-wrap: wrap">
    <div class="tabs" style="margin: 0">
      <button v-for="[k, label] in TABS" :key="k" :class="{ on: status === k }" @click="status = k">{{ label }}<span v-if="k === 'open' && meta.open" class="cnt">{{ meta.open }}</span></button>
    </div>
    <select v-if="reception" v-model="kind" style="width: 170px"><option value="">All kinds</option><option value="treatment">Treatment</option><option value="shop">Shop products</option><option value="other">Other</option></select>
    <input v-model="q" placeholder="Search client name or phone" style="max-width: 260px; margin-left: auto" />
  </div>
  <p class="note" style="margin: 0 0 10px">{{ reception
    ? 'Members ask to use their points in the app. Treatment: take them off the client’s bill. Shop: send to e-commerce. Other: write what was given. The points are taken only when you complete a request.'
    : 'Reception sends you shop requests. Take the points off the client’s shop order (or note how you gave the discount).' }}</p>
  <p v-if="error" class="err">{{ error }}</p>

  <div class="card">
    <table>
      <thead><tr><th>Client</th><th>Wants</th><th>Points</th><th>Their note</th><th>Status</th><th>Asked</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id" class="click" @click="show(r)">
          <td><b>{{ r.client.name }}</b><small>{{ r.client.phone }} · {{ pts(r.client.points_balance) }} now</small></td>
          <td>{{ KIND[r.kind] }}</td>
          <td><b>{{ pts(r.points_used ?? r.points) }}</b><small>{{ etb(r.discount_etb ?? r.value_etb) }}</small></td>
          <td class="clip">{{ r.note ?? '—' }}<small v-if="r.staff_note">Lavish: {{ r.staff_note }}</small></td>
          <td><span class="badge" :class="BADGE[r.status]">{{ STATUS[r.status] }}</span><small v-if="r.handled_by">{{ r.handled_by }}</small><small v-else-if="r.forwarded_by">sent by {{ r.forwarded_by }}</small></td>
          <td>{{ when(r.created_at) }}</td>
        </tr>
        <tr v-if="!rows.length"><td colspan="6" class="empty">{{ status === 'open' ? 'No requests waiting' : 'Nothing here' }}</td></tr>
      </tbody>
    </table>
    <Pager :meta="meta" label="requests" @go="(n) => { page = n; load() }" />
  </div>

  <div v-if="open" class="drawer-bg" @click.self="open = null">
    <aside class="drawer pr-drawer">
      <button class="btn ghost sm" style="float: right" @click="open = null">✕</button>
      <span class="eyebrow">{{ KIND[req.kind] }}</span>
      <h2 style="margin: 4px 0">{{ req.client.name }}</h2>
      <p class="note">{{ req.client.phone }}</p>

      <div class="pr-hero">
        <div><b>{{ pts(req.points) }}</b><span>asked · worth {{ etb(req.value_etb) }}</span></div>
        <div><b>{{ pts(req.client.points_balance) }}</b><span>balance now</span></div>
      </div>
      <div class="kvs">
        <div><span>Status</span><b><span class="badge" :class="BADGE[req.status]">{{ STATUS[req.status] }}</span></b></div>
        <div><span>Client’s note</span><b>{{ req.note ?? '—' }}</b></div>
        <div><span>Asked</span><b>{{ when(req.created_at) }}</b></div>
        <div v-if="req.forwarded_at"><span>Sent to e-commerce</span><b>{{ when(req.forwarded_at) }}{{ req.forwarded_by ? ' · ' + req.forwarded_by : '' }}</b></div>
        <div v-if="req.handled_at"><span>{{ req.status === 'completed' ? 'Done' : 'Answered' }}</span><b>{{ when(req.handled_at) }}{{ req.handled_by ? ' · ' + req.handled_by : '' }}</b></div>
        <div v-if="req.status === 'completed'"><span>Used</span><b>{{ pts(req.points_used) }} · {{ etb(req.discount_etb) }}{{ req.bill ? ' off ' + req.bill.description : '' }}</b></div>
        <div v-if="req.staff_note"><span>Lavish note</span><b>{{ req.staff_note }}</b></div>
      </div>

      <template v-if="['pending', 'forwarded'].includes(req.status)">
        <!-- Shop requests: reception sends them on; e-commerce completes them -->
        <template v-if="req.kind === 'shop' && req.status === 'pending' && reception">
          <h3>Send to e-commerce</h3>
          <p class="note">The e-commerce team takes the points off this client’s shop order.</p>
          <label>Note for e-commerce (optional)</label><input v-model="open.note" maxlength="255" placeholder="e.g. For the sunscreen order" />
          <button class="btn gold" style="margin-top: 10px; width: 100%" @click="forward">Send to e-commerce</button>
        </template>
        <template v-else-if="canComplete">
          <h3>Use the points</h3>
          <div class="seg">
            <button type="button" :class="{ on: open.mode === 'bill' }" :disabled="!open.bills.length" @click="open.mode = 'bill'">Take off a bill</button>
            <button type="button" :class="{ on: open.mode === 'note' }" @click="open.mode = 'note'">Given another way</button>
          </div>
          <template v-if="open.mode === 'bill'">
            <label>{{ req.kind === 'shop' ? 'Shop order' : 'Treatment bill' }}</label>
            <select v-model="open.payment_id"><option v-for="b in open.bills" :key="b.id" :value="b.id">{{ b.description }} — {{ etb(b.due_amount ?? b.amount) }} to pay</option></select>
            <p class="ok">{{ etb(takeOff) }} comes off the bill<template v-if="takeOff < req.value_etb"> — the bill is smaller, so only part of the points are used and the rest stay with the client</template>.</p>
            <label>Note (optional)</label><input v-model="open.note" maxlength="255" />
          </template>
          <template v-else>
            <p v-if="!open.bills.length" class="note">This client has no unpaid {{ req.kind === 'shop' ? 'shop order' : req.kind === 'treatment' ? 'treatment bill' : 'bill' }}. Write how the points were used.</p>
            <label>How were the points used?</label><input v-model="open.note" maxlength="255" :placeholder="req.kind === 'other' ? 'e.g. Free LED session added to today’s visit' : 'e.g. ETB 500 off at the counter, receipt #2231'" />
          </template>
          <button class="btn gold" style="margin-top: 12px; width: 100%" @click="complete">Use {{ pts(req.points) }}</button>
        </template>
        <h3>Not approve</h3>
        <input v-model="open.reason" maxlength="255" placeholder="Reason the client will see" />
        <button class="btn ghost danger-t" style="margin-top: 8px; width: 100%" @click="reject">Not approve</button>
        <p v-if="open.error" class="err">{{ open.error }}</p>
      </template>

      <h3>Recent points</h3>
      <div v-for="h in open.history" :key="h.id" class="hist">
        <span class="grow"><b>{{ h.description }}</b><small>{{ when(h.created_at) }}<template v-if="h.by"> · {{ h.by }}</template></small></span>
        <span class="amt"><b :class="h.points > 0 ? 'pos' : 'neg'">{{ h.points > 0 ? '+' : '' }}{{ h.points.toLocaleString() }}</b><small v-if="h.balance_after != null">{{ h.balance_after.toLocaleString() }} left</small></span>
      </div>
    </aside>
  </div>
</template>

<style scoped>
td small { display: block; color: var(--muted); font-size: 12px; }
tr.click { cursor: pointer; }
tr.click:hover td { background: #faf9f8; }
.clip { max-width: 260px; }
.tabs .cnt { display: inline-block; min-width: 18px; margin-left: 6px; padding: 0 5px; border-radius: 99px; background: var(--gold, #b8956a); color: #fff; font-size: 11px; line-height: 18px; }
.pr-drawer { width: min(460px, 95vw); }
.eyebrow { font-size: 11px; letter-spacing: 2px; color: var(--muted); text-transform: uppercase; }
.pr-hero { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0; }
.pr-hero > div { padding: 14px; border-radius: 14px; background: linear-gradient(135deg, #0a7379, #064e52); color: #fff; }
.pr-hero > div + div { background: #f3f2f0; color: var(--ink); }
.pr-hero b { display: block; font: 500 24px 'EB Garamond', serif; }
.pr-hero span { font-size: 12px; opacity: .85; }
.kvs > div { display: flex; justify-content: space-between; gap: 14px; padding: 7px 0; border-top: 1px solid #f0efed; font-size: 13.5px; }
.kvs span { color: var(--muted); }
.kvs b { font-weight: 500; text-align: right; }
h3 { margin: 18px 0 6px; }
label { display: block; font-size: 13px; margin: 10px 0 4px; }
select, input { width: 100%; }
.seg { display: inline-flex; gap: 4px; padding: 4px; border-radius: 12px; background: #f3f2f0; }
.seg button { padding: 7px 14px; border: 0; border-radius: 9px; background: none; cursor: pointer; font-size: 13px; }
.seg button.on { background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .1); color: var(--teal-deep); }
.seg button:disabled { opacity: .4; cursor: not-allowed; }
.ok { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: #e6f3ef; color: var(--teal-deep); font-size: 13px; }
.hist { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid #f0efed; }
.hist b { font-weight: 500; font-size: 13px; }
.hist small { display: block; color: var(--muted); font-size: 11.5px; }
.grow { flex: 1; min-width: 0; }
.amt { text-align: right; }
.pos { color: var(--teal-deep); }
.neg { color: var(--bad); }
.danger-t { color: var(--bad); border-color: #ecc8c3; }
.err { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: #f8e7e5; color: var(--bad); font-size: 13px; }
</style>
