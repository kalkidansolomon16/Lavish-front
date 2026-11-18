<script setup>
// Payments — GET /staff/payments. No online gateway for now: clients pay by any means (Telebirr, CBE Birr,
// bank transfer, cash…) and upload the receipt in the app; reception checks it here, or records the payment
// at the desk (optionally attaching the receipt). Vouchers, points and gift cards go through Checkout.
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { exportCsv } from '../ui'
import { etb, day, when } from '../fmt'
import ClientLink from '../components/ClientLink.vue'
import CheckoutDialog from '../components/CheckoutDialog.vue'
import FilePicker from '../components/FilePicker.vue'
import Pager from '../components/Pager.vue'

const auth = useAuth()
const canCollect = computed(() => auth.can('payments.collect'))
const rows = ref([])
const meta = ref({ totals: {} })
const tab = ref('')
const q = ref('')
const page = ref(1)
const loading = ref(false)
const error = ref('')

const TABS = [['', 'All'], ['in_review', 'Receipts to check'], ['unpaid,failed', 'Unpaid'], ['paid', 'Paid'], ['refund_due', 'Refund due']]
const METHODS = [['cash', 'Cash'], ['telebirr', 'Telebirr'], ['cbe_birr', 'CBE Birr'], ['bank_transfer', 'Bank transfer'], ['card', 'Card']]
const STATUS = { unpaid: ['Unpaid', 'unpaid'], pending: ['Awaiting client', 'pending'], in_review: ['Receipt to check', 'pending'], paid: ['Paid', 'paid'], failed: ['Failed', 'declined'], refund_due: ['Refund due', 'declined'], refunded: ['Refunded', 'cancelled'], cancelled: ['Cancelled', 'cancelled'] }

async function load(reset = true) {
  if (reset) page.value = 1
  loading.value = true
  error.value = ''
  try {
    const res = await api.get('/staff/payments', { status: tab.value || undefined, q: q.value || undefined, page: page.value, per_page: 30 })
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
onMounted(load)
const more = () => { page.value++; load(false) }
const hasMore = computed(() => meta.value.current_page < meta.value.last_page)
const replace = (p) => { const i = rows.value.findIndex((x) => x.id === p.id); if (i >= 0) rows.value[i] = { ...rows.value[i], ...p }; load() }

// ---- record a payment at the desk
const recording = ref(null)
function openRecord(p) { recording.value = { p, method: 'cash', reference: '', file: null, error: '', busy: false } }
async function record() {
  const r = recording.value
  const label = METHODS.find((m) => m[0] === r.method)[1]
  if (!(await ask({ title: `Record ${etb(r.p.due_amount)} paid by ${label}?`, body: `${r.p.client?.name} · ${r.p.description}${r.reference ? '\nReference: ' + r.reference : ''}${r.file ? '\nReceipt: ' + r.file.name : ''}`, ok: 'Record payment' }))) return
  r.busy = true
  try {
    const fd = new FormData()
    fd.append('method', r.method)
    if (r.reference) fd.append('reference', r.reference)
    if (r.file) fd.append('receipt', r.file)
    const res = await api.post(`/staff/payments/${r.p.id}/record`, fd)
    recording.value = null
    notify('Payment recorded')
    replace(res.data)
  } catch (e) {
    r.error = e.message
  } finally {
    r.busy = false
  }
}

// ---- check a receipt the client uploaded
const checking = ref(null)
const openCheck = (p) => (checking.value = { p, receipt: p.receipt, reason: '', rejecting: false, error: '' })
async function accept() {
  const c = checking.value
  if (!(await ask({ title: 'Accept this receipt?', body: `${c.p.client?.name} · ${c.p.description}\n${c.receipt.method?.label} · ${etb(c.receipt.amount)}${c.receipt.reference ? ' · Ref ' + c.receipt.reference : ''}\n\nThe bill is marked paid and the client is told.`, ok: 'Accept & mark paid' }))) return
  try {
    const res = await api.post(`/staff/payments/${c.p.id}/receipts/${c.receipt.id}/accept`)
    checking.value = null
    notify('Receipt accepted — payment recorded')
    replace(res.data)
  } catch (e) {
    c.error = e.message
  }
}
async function reject() {
  const c = checking.value
  if (c.reason.trim().length < 4) return
  if (!(await ask({ title: 'Reject this receipt?', body: `The client is told: “${c.reason.trim()}” and can upload a new one.`, ok: 'Reject', tone: 'danger' }))) return
  try {
    const res = await api.post(`/staff/payments/${c.p.id}/receipts/${c.receipt.id}/reject`, { reason: c.reason.trim() })
    checking.value = null
    notify('Receipt rejected — the client was told')
    replace(res.data)
  } catch (e) {
    c.error = e.message
  }
}

// ---- refunds, vouchers/gift cards, receipt print
async function refunded(p) {
  if (!(await ask({ title: 'Mark as refunded?', body: `${p.client?.name} · ${p.description} · ${etb(p.amount)}\nConfirm you gave the money back. Points it earned are removed and gift card money is returned to the card.`, ok: 'Mark refunded', tone: 'danger' }))) return
  try {
    replace((await api.post(`/staff/payments/${p.id}/refund`)).data)
    notify('Marked as refunded')
  } catch (e) {
    notify(e.message)
  }
}
const checkout = ref(null)
const printing = ref(null)
const print = () => window.print()

const exportAll = () => exportCsv('lavish-payments', rows.value.map((p) => ({
  Receipt: 'LV-' + p.id, Client: p.client?.name ?? '', Phone: p.client?.phone ?? '', For: p.description, Amount_ETB: p.amount,
  Discounts_ETB: p.discount_amount, Gift_card_ETB: p.gift_card_amount, Paid_in_money_ETB: p.status === 'paid' ? p.due_amount : 0,
  Method: p.method?.label ?? '', Reference: p.provider_reference ?? '', Status: p.status, Paid_at: p.paid_at ?? '', Created: p.created_at,
})))
</script>

<template>
  <div class="head">
    <div>
      <h1>Payments</h1>
      <p>Clients pay by Telebirr, CBE Birr, bank transfer or cash and upload their receipt in the app — check it here, or record a payment taken at the desk.</p>
    </div>
    <button class="btn ghost" @click="exportAll">⬇ Export CSV</button>
  </div>

  <div class="grid g4" style="margin-bottom: 20px">
    <div class="card stat gold"><div class="n">{{ etb(meta.totals.paid) }}</div><div class="l">Collected</div></div>
    <button class="card stat" style="text-align: left; cursor: pointer" :class="{ alert: meta.totals.receipts_to_check }" @click="tab = 'in_review'; load()"><div class="n">{{ meta.totals.receipts_to_check ?? 0 }}</div><div class="l">Receipts to check</div></button>
    <div class="card stat"><div class="n">{{ etb(meta.totals.outstanding) }}</div><div class="l">Not paid yet</div></div>
    <div class="card stat"><div class="n">{{ etb(meta.totals.refund_due) }}</div><div class="l">Refunds to give back</div></div>
  </div>

  <div class="row" style="gap: 8px; margin-bottom: 12px">
    <div class="tabs" style="margin: 0"><button v-for="[k, l] in TABS" :key="k" :class="{ on: tab === k }" @click="tab = k; load()">{{ l }}</button></div>
    <input v-model="q" placeholder="Search client name or phone" style="max-width: 280px; margin-left: auto" />
  </div>
  <p v-if="error" class="err">{{ error }}</p>

  <div class="card">
    <table>
      <thead><tr><th>Client</th><th>For</th><th>Amount</th><th>Method</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="p in rows" :key="p.id">
          <td><ClientLink :id="p.client?.id" :name="p.client?.name" /><small>{{ day(p.created_at) }}</small></td>
          <td>{{ p.description }}<small>{{ { appointment: 'Treatment', order: 'Shop order', gift_card: 'Gift card' }[p.payable?.type] ?? '' }}</small></td>
          <td>{{ etb(p.amount) }}<small v-if="p.discount_amount || p.gift_card_amount">{{ etb(p.due_amount) }} in money<template v-if="p.discount_amount"> · −{{ etb(p.discount_amount) }} rewards</template><template v-if="p.gift_card_amount"> · −{{ etb(p.gift_card_amount) }} gift card</template></small></td>
          <td>{{ p.method?.label ?? '—' }}<small v-if="p.provider_reference">Ref {{ p.provider_reference }}</small><small v-else-if="p.receipt?.reference && p.status === 'in_review'">Ref {{ p.receipt.reference }}</small></td>
          <td><span class="badge" :class="STATUS[p.status]?.[1]">{{ STATUS[p.status]?.[0] ?? p.status }}</span><small v-if="p.receipt?.status === 'rejected' && p.status === 'unpaid'" style="color: var(--bad)">Receipt rejected</small></td>
          <td class="row" style="justify-content: flex-end">
            <template v-if="canCollect">
              <button v-if="p.status === 'in_review'" class="btn gold sm" @click="openCheck(p)">Check receipt</button>
              <template v-else-if="['unpaid', 'failed', 'pending'].includes(p.status)">
                <button class="btn gold sm" @click="openRecord(p)">Record payment</button>
                <button v-if="p.payable?.type !== 'gift_card'" class="btn ghost sm" title="Vouchers, points or a gift card" @click="checkout = p">Rewards / gift card</button>
              </template>
              <button v-else-if="p.status === 'refund_due' && auth.can('payments.refund')" class="btn danger sm" @click="refunded(p)">Mark refunded</button>
            </template>
            <button v-if="p.status === 'paid'" class="btn ghost sm" @click="printing = p">Receipt</button>
          </td>
        </tr>
        <tr v-if="!rows.length && !loading"><td colspan="6" class="empty">No payments{{ tab ? ' here' : ' yet' }}</td></tr>
      </tbody>
    </table>
    <Pager :meta="meta" label="payments" @go="(n) => { page = n; load(false) }" />
  </div>

  <!-- Record a payment -->
  <div v-if="recording" class="modal-bg" @click.self="recording = null">
    <form class="modal" style="width: min(520px, 94vw)" @submit.prevent="record">
      <h2>Record payment</h2>
      <p class="note">{{ recording.p.client?.name }} · {{ recording.p.description }}</p>
      <p class="serif" style="font-size: 36px; margin: 8px 0 12px">{{ etb(recording.p.due_amount) }}</p>
      <label>Paid with</label>
      <div class="methods"><button v-for="[k, l] in METHODS" :key="k" type="button" :class="{ on: recording.method === k }" @click="recording.method = k">{{ l }}</button></div>
      <template v-if="recording.method !== 'cash'"><label>Transaction / slip reference (optional)</label><input v-model="recording.reference" placeholder="e.g. FT2611AB34" /></template>
      <label>Receipt <small class="note">(optional)</small></label>
      <FilePicker v-model="recording.file" accept="image/*,application/pdf" compact title="Attach the receipt" hint="Photo or PDF of the slip · up to 5 MB" />
      <p v-if="recording.error" class="err">{{ recording.error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 16px"><button type="button" class="btn ghost" @click="recording = null">Cancel</button><button class="btn gold" :disabled="recording.busy">{{ recording.busy ? 'Saving…' : 'Record payment' }}</button></div>
    </form>
  </div>

  <!-- Check a receipt -->
  <div v-if="checking" class="modal-bg" @click.self="checking = null">
    <div class="modal" style="width: min(620px, 95vw); max-height: 92vh; overflow: auto">
      <h2>Check receipt</h2>
      <p class="note">{{ checking.p.client?.name }} · {{ checking.p.description }} · uploaded {{ when(checking.receipt.created_at) }}</p>
      <div class="rc-grid">
        <a v-if="checking.receipt.file" :href="checking.receipt.file.url" target="_blank" rel="noopener" class="rc-file">
          <img v-if="checking.receipt.file.is_image" :src="checking.receipt.file.url" alt="Receipt" />
          <span v-else>📄 {{ checking.receipt.file.name }}<small>Open PDF</small></span>
        </a>
        <dl class="kv">
          <dt>Bill</dt><dd><b>{{ etb(checking.p.due_amount) }}</b></dd>
          <dt>Client says paid</dt><dd :style="{ color: checking.receipt.amount !== checking.p.due_amount ? 'var(--bad)' : '' }">{{ etb(checking.receipt.amount) }}</dd>
          <dt>Method</dt><dd>{{ checking.receipt.method?.label }}</dd>
          <dt>Reference</dt><dd>{{ checking.receipt.reference ?? '—' }}</dd>
          <dt v-if="checking.receipt.note">Note</dt><dd v-if="checking.receipt.note">{{ checking.receipt.note }}</dd>
        </dl>
      </div>
      <p class="note">Check the amount and reference in the Telebirr / bank statement before accepting.</p>
      <template v-if="checking.rejecting">
        <label>Why is it rejected? (sent to the client)</label>
        <input v-model="checking.reason" placeholder="e.g. The amount doesn’t match the bill" />
      </template>
      <p v-if="checking.error" class="err">{{ checking.error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 16px">
        <button class="btn ghost" @click="checking = null">Close</button>
        <button v-if="!checking.rejecting" class="btn danger" @click="checking.rejecting = true">Reject…</button>
        <button v-else class="btn danger" :disabled="checking.reason.trim().length < 4" @click="reject">Reject receipt</button>
        <button class="btn gold" @click="accept">Accept & mark paid</button>
      </div>
    </div>
  </div>

  <!-- Printable receipt -->
  <div v-if="printing" class="modal-bg" @click.self="printing = null">
    <div class="modal">
      <div class="receipt">
        <img src="/img/logo-white.png" alt="Lavish" class="rlogo" />
        <p class="note" style="text-align: center">Ultra Luxury in Science and Beauty</p>
        <hr />
        <p><b>Receipt</b> LV-{{ printing.id }}<br /><span class="note">{{ when(printing.paid_at) }}</span></p>
        <p>Client: <b>{{ printing.client?.name }}</b></p>
        <p>{{ printing.description }}</p>
        <p class="serif" style="font-size: 30px">{{ etb(printing.amount) }}</p>
        <p v-if="printing.discount_amount" class="note">Lavish Rewards −{{ etb(printing.discount_amount) }}</p>
        <p v-if="printing.gift_card_amount" class="note">Gift card −{{ etb(printing.gift_card_amount) }}</p>
        <p class="note">Paid {{ etb(printing.due_amount) }} via {{ printing.method?.label }}<span v-if="printing.provider_reference"> · Ref {{ printing.provider_reference }}</span></p>
        <p style="text-align: center; margin-top: 16px" class="note">Thank you for choosing Lavish ✿</p>
      </div>
      <p v-if="printing.receipt?.file" class="note" style="margin-top: 10px">Client’s receipt: <a class="link" :href="printing.receipt.file.url" target="_blank" rel="noopener">{{ printing.receipt.file.name }}</a></p>
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button class="btn ghost" @click="printing = null">Close</button>
        <button class="btn gold" @click="print">🖨 Print receipt</button>
      </div>
    </div>
  </div>

  <CheckoutDialog v-if="checkout" :bill="checkout" :client-name="checkout.client?.name" @close="checkout = null" @paid="load()" />
</template>

<style scoped>
td small { display: block; color: var(--muted); font-size: 12px; }
.stat.alert { border-color: var(--gold); box-shadow: 0 0 0 2px rgba(203, 165, 144, .35) inset; }
label { display: block; font-size: 13px; margin: 12px 0 4px; }
.methods { display: flex; flex-wrap: wrap; gap: 6px; }
.methods button { padding: 8px 14px; border-radius: 10px; border: 1px solid var(--line); background: #fff; cursor: pointer; }
.methods button.on { border-color: var(--dark); background: #e8f3f2; color: var(--teal-deep); font-weight: 500; }
.rc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 14px 0; align-items: start; }
.rc-file { display: grid; place-items: center; min-height: 220px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #f6f5f4; text-align: center; }
.rc-file img { width: 100%; max-height: 420px; object-fit: contain; }
.rc-file small { display: block; color: var(--muted); }
.kv { display: grid; grid-template-columns: 120px 1fr; gap: 8px 10px; margin: 0; font-size: 14px; }
.kv dt { color: var(--muted); }
.kv dd { margin: 0; }
.err { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: #f8e7e5; color: var(--bad); font-size: 13px; }
</style>
