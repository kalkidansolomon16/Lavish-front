<script setup>
// Gift cards — activate e-gift cards, sell, scan / look up, use at the visit, track and void/reissue.
// E-gift cards bought in the app wait under "To activate" once paid: open one (or scan its barcode), check it,
// activate it — the recipient then gets "your gift card is active, use it from … to …" by email / SMS.
// Staff never see a full code in lists ("•••• 7K2M"); the full code is shown once after a sale or reissue.
// Printed cards: managers create a batch (numbers + barcodes for the printer) or import numbers already
// printed; reception sells one by scanning its barcode (a USB scanner types the number + Enter).
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { etb, day, when } from '../fmt'
import { DESIGNS, printCards, cardFrontHtml, cardBackHtml, CARD_CSS, barcodeSvg, qrSvg, grouped, saveCards } from '../giftcardPrint'
import FilePicker from '../components/FilePicker.vue'
import PhoneInput from '../components/PhoneInput.vue'
import Pager from '../components/Pager.vue'
import CameraScanner from '../components/CameraScanner.vue'

const auth = useAuth()
const route = useRoute()
const rows = ref([])
const meta = ref({})
const status = ref('active')
const q = ref('')
const error = ref('')
const detail = ref(null)
const selling = ref(null)
const looking = ref(null)
const shown = ref(null) // { card, code } — code shown once
const voiding = ref(null)
const services = ref([])
const clients = ref([])

const STATUS = { awaiting_activation: 'To activate', active: 'Active', redeemed: 'Used up', expired: 'Expired', void: 'Voided', pending_payment: 'Awaiting payment', in_stock: 'Not sold yet' }
const BADGE = { active: 'paid', redeemed: 'completed', expired: 'declined', void: 'declined', pending_payment: 'pending', awaiting_activation: 'approved', in_stock: 'pending' }
const SOURCE = { app: 'Bought in the app', front_desk: 'Front desk', promo: 'Promotion', card_stock: 'Printed card' }
const tabs = computed(() => [...(auth.can('giftcards.activate') ? ['awaiting_activation'] : []), 'active', 'redeemed', 'expired', 'void', ''])
// "Active" lists the cards in use and the printed cards ready to be sold.
// "To activate" = e-gift cards bought in the app that are waiting for payment or for activation.
const statusParam = (s) => ({ active: 'active,in_stock', awaiting_activation: 'awaiting_activation,pending_payment' })[s] ?? (s || undefined)
const count = (s) => meta.value.counts?.[s] ?? 0
const pct = (c) => (c.initial_value ? (c.balance / c.initial_value) * 100 : 0)
const LEDGER = { issue: 'Issued', redeem: 'Spent', restore: 'Returned (booking cancelled / refunded)', void: 'Voided', reissue: 'Reissued', expire: 'Expired', adjust: 'Adjusted' }

async function load() {
  error.value = ''
  try {
    const res = await api.get('/staff/gift-cards', { status: statusParam(status.value), q: q.value || undefined, page: page.value, per_page: 10 })
    rows.value = res.data
    meta.value = res.meta
  } catch (e) {
    error.value = e.message
  }
}
let t
watch(q, () => { clearTimeout(t); t = setTimeout(load, 300) })
onMounted(async () => {
  if (route.query.tab === 'activate' && auth.can('giftcards.activate')) status.value = 'awaiting_activation'
  load()
  services.value = (await api.get('/catalog/services').catch(() => ({ data: [] }))).data.filter((s) => !s.is_online)
})

const open = async (id) => (detail.value = (await api.get(`/staff/gift-cards/${id}`)).data)

// ---- activate (e-gift cards bought in the app)
const activating = ref(null)
async function activate() {
  const c = detail.value
  const unpaid = c.status === 'pending_payment'
  const a = activating.value ?? {}
  if (unpaid && !a.method) { activating.value = { method: 'telebirr', error: '' }; return }
  if (!(await ask({
    title: `Activate ${c.label}?`,
    body: [`For ${c.recipient.name ?? 'the recipient'}${c.recipient.email ? ' · ' + c.recipient.email : ''}${c.recipient.phone ? ' · ' + c.recipient.phone : ''}`,
      `From ${c.from ?? '—'}`,
      unpaid ? `Payment will be recorded: ${a.method.replace('_', ' ')}.` : 'Paid ✓',
      'The recipient gets an email / SMS: “Your gift card is activated — use it from today until the expiry date.”'].join('\n'),
    ok: 'Activate card',
  }))) return
  try {
    detail.value = (await api.post(`/staff/gift-cards/${c.id}/activate`, unpaid ? { method: a.method } : {})).data
    activating.value = null
    notify(`Card activated — valid until ${day(detail.value.expires_at)}`)
    load()
  } catch (e) {
    activating.value = { ...(activating.value ?? {}), error: e.message }
  }
}

// ---- send the "your gift card is activated" message again
async function resend() {
  const c = detail.value
  if (!(await ask({ title: 'Send the message again?', body: `To ${[c.recipient.email, c.recipient.phone].filter(Boolean).join(' and ')}: “Your Lavish gift card is activated…” with the card number and the dates it can be used.`, ok: 'Send' }))) return
  try {
    detail.value = (await api.post(`/staff/gift-cards/${c.id}/resend`)).data
    notify('Message sent again')
  } catch (e) { notify(e.message) }
}

// ---- use the card at the visit
const using = ref(null)
const openUse = () => (using.value = { amount: detail.value.type === 'service' ? detail.value.balance : Math.min(detail.value.balance, 1000), service_id: detail.value.service?.id ?? services.value[0]?.id, note: '', error: '' })
function pickService() {
  const svc = services.value.find((x) => x.id === using.value.service_id)
  if (svc && detail.value.type !== 'service') using.value.amount = Math.min(detail.value.balance, svc.price)
}
async function useCard() {
  const u = using.value
  const c = detail.value
  const svc = services.value.find((x) => x.id === u.service_id)
  if (!(await ask({ title: `Use ${etb(u.amount)} from ${c.masked_code}?`, body: `${svc?.name ?? 'Treatment'}${u.note ? ' — ' + u.note : ''}\nLeft on the card after this: ${etb(c.balance - u.amount)}`, ok: 'Use card' }))) return
  try {
    detail.value = (await api.post(`/staff/gift-cards/${c.id}/use`, { amount: u.amount, service_id: u.service_id, note: u.note || undefined })).data
    using.value = null
    notify(`${etb(u.amount)} used · ${etb(detail.value.balance)} left`)
    load()
  } catch (e) { u.error = e.message }
}

// ---- sell
async function searchClients(term) {
  clients.value = term.length < 2 ? [] : (await api.get('/staff/rewards/members', { q: term, per_page: 6 }).catch(() => ({ data: [] }))).data
}
function openSell() {
  selling.value = { type: 'monetary', amount: 2500, service_id: services.value[0]?.id, method: 'cash', delivery: 'print', design: 'classic',
    purchaser: null, purchaserTerm: '', purchaser_name: '', recipient_name: '', recipient_phone: '', recipient_email: '', message: '', deliver_at: '', reason: '', error: '' }
}
const sellValue = computed(() => (selling.value?.type === 'service' ? services.value.find((s) => s.id === selling.value.service_id)?.price : selling.value?.amount) ?? 0)
async function sell() {
  const s = selling.value
  const promo = s.type === 'promo'
  if (!(await ask({
    title: promo ? `Issue a free ${etb(s.amount)} promo card?` : `Sell a ${etb(sellValue.value)} gift card?`,
    body: [promo ? 'No payment is taken — this is a promotional card.' : `Payment: ${s.method.replace('_', ' ')} at the desk.`,
      `Delivery: ${{ print: 'printed card handed over now', sms: 'SMS to ' + s.recipient_phone, email: 'email to ' + s.recipient_email }[s.delivery]}${s.deliver_at ? ' on ' + day(s.deliver_at) : ''}`].join('\n'),
    ok: promo ? 'Issue card' : `Take ${etb(sellValue.value)}`,
  }))) return
  try {
    const body = {
      type: s.type, amount: s.type === 'service' ? undefined : s.amount, service_id: s.type === 'service' ? s.service_id : undefined,
      method: promo ? undefined : s.method, delivery: s.delivery, design: s.design, message: s.message || undefined,
      purchaser_client_id: s.purchaser?.id, purchaser_name: s.purchaser ? undefined : s.purchaser_name || undefined,
      recipient_name: s.recipient_name || undefined, recipient_phone: s.recipient_phone || undefined, recipient_email: s.recipient_email || undefined,
      deliver_at: s.deliver_at || undefined, reason: promo ? s.reason : undefined,
    }
    const res = await api.post('/staff/gift-cards', body)
    selling.value = null
    shown.value = { card: res.data, code: res.code }
    load()
  } catch (e) {
    s.error = e.message
  }
}

// ---- lookup
async function lookup() {
  const l = looking.value
  l.error = ''
  try {
    detail.value = (await api.post('/staff/gift-cards/lookup', { code: l.code })).data
    looking.value = null
  } catch (e) {
    l.error = e.status === 429 ? 'Too many lookups — wait a minute and try again.' : e.message
  }
}

// ---- void & reissue
async function doVoid() {
  const v = voiding.value
  if (!(await ask({ title: `Void card ${v.card.masked_code}?`, body: `${etb(v.card.balance)} left on it.\n${v.reissue ? 'The balance moves to a new card with a new code.' : 'The balance is cancelled.'}\nReason: ${v.reason}`, ok: v.reissue ? 'Void & reissue' : 'Void card', tone: 'danger' }))) return
  try {
    const res = await api.post(`/staff/gift-cards/${v.card.id}/void`, { reason: v.reason, reissue: v.reissue })
    voiding.value = null
    detail.value = res.data
    if (res.reissued) shown.value = { card: res.reissued, code: res.code, reissued: true }
    notify('Card voided')
    load()
  } catch (e) {
    v.error = e.message
  }
}
const popupBlocked = (ok) => ok || notify('Your browser blocked the print window — allow pop-ups for this site and try again.')
const cardFace = (card, code) => ({ code, to: card.recipient?.name ?? '', from: card.from ?? '', value: card.type === 'service' ? card.service?.name : etb(card.initial_value) })
const printShown = () => popupBlocked(printCards([cardFace(shown.value.card, shown.value.code)]))
const FRONT = cardFrontHtml()

// ---- printed gift cards (managers): make a batch → saved to a folder on the PC / tablet → print from the file
const stock = ref(null)   // { mode: 'generate' | 'import', count, batch, text, error, busy }
const openStock = () => (stock.value = { mode: 'generate', count: 50, batch: '', text: '', error: '', busy: false })
function readFile(f) {
  stock.value.file = f
  if (f) f.text().then((t) => (stock.value.text = t))
}
const importCodes = (t) => [...new Set((t.match(/[A-Za-z0-9][A-Za-z0-9-]{8,}[A-Za-z0-9]/g) ?? []).filter((x) => x.replace(/-/g, '').length >= 10 && !/^(batch|card_number|barcode|qr)/i.test(x)))]
async function saveStock() {
  const s = stock.value
  s.error = ''
  if (s.mode === 'generate') {
    if (!(await ask({ title: `Make ${s.count} printed gift cards?`, body: `Batch: ${s.batch || 'named by today’s date'}
Next you choose a folder on this computer: the cards (with their barcodes and QR codes) are saved there as a file you can open and print any time.
The cards have no value until they are sold at the desk.`, ok: 'Make & save cards' }))) return
    // Make the cards, then save the print file as a normal download (works in every browser; Chrome can be set to
    // ask which folder to save in).
    const batch = s.batch.trim() || `Batch ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
    s.busy = true
    try {
      const res = (await api.post('/staff/gift-cards/stock/generate', { count: s.count, batch })).data
      const saved = await saveCards(res.codes, res.batch)
      stock.value = null
      savedInfo.value = { ...saved, count: res.codes.length, batch: res.batch }
      status.value = 'active'
      load()
    } catch (e) { s.error = e.message } finally { if (stock.value) s.busy = false }
  } else {
    const codes = importCodes(s.text)
    if (!codes.length) { s.error = 'No card numbers found — paste one number per line (at least 10 letters/digits).'; return }
    if (!(await ask({ title: `Add ${codes.length} printed card${codes.length === 1 ? '' : 's'}?`, body: `Batch: ${s.batch || 'named by today’s date'}
First: ${codes[0]}${codes.length > 1 ? '\nLast: ' + codes[codes.length - 1] : ''}`, ok: 'Add cards' }))) return
    try {
      const r = (await api.post('/staff/gift-cards/stock/import', { codes, batch: s.batch || null })).data
      stock.value = null
      notify(`${r.added} cards added to ${r.batch}${r.skipped.length ? ` · ${r.skipped.length} skipped (already added or too short)` : ''}`)
      status.value = 'active'
      load()
    } catch (e) { s.error = e.message }
  }
}
// Save a batch's print file again (any time) — folder first, then the numbers from the server.
const savedInfo = ref(null) // { folder?, downloaded?, file, count, batch }
async function saveBatch(b) {
  try {
    const res = await api.get('/staff/gift-cards/stock/batch-codes', { batch: b.batch })
    if (!res.data.codes.length) { notify('These cards were made before card numbers were kept, so they can’t be saved again.'); return }
    const saved = await saveCards(res.data.codes, b.batch)
    savedInfo.value = { ...saved, count: res.data.codes.length, batch: b.batch, missing: res.meta.missing }
  } catch (e) { notify('Saving failed: ' + e.message) }
}

// One printed card: print it again from its detail
const printOne = (c) => popupBlocked(printCards([{ code: c.card_number, to: c.recipient?.name ?? '', from: c.from ?? '', value: c.status === 'in_stock' ? '' : c.type === 'service' ? c.service?.name : etb(c.initial_value) }], { title: `Gift card ${grouped(c.card_number)}` }))

// ---- sell a printed card (scan → amount → payment)
const physical = ref(null)
const scanInput = ref(null)
function openPhysical() {
  physical.value = { code: '', card: null, checking: false, type: 'monetary', amount: null, service_id: null, method: 'cash',
    purchaser: null, purchaserTerm: '', purchaser_name: '', recipient_name: '', recipient_phone: '', recipient_email: '', message: '', reason: '', error: '' }
  setTimeout(() => scanInput.value?.focus(), 50)
}
async function checkPhysical() {
  const p = physical.value
  p.error = ''
  p.card = null
  if (p.code.replace(/[^A-Za-z0-9]/g, '').length < 10) { p.error = 'Scan the barcode or type the full card number.'; return }
  p.checking = true
  try {
    p.card = (await api.post('/staff/gift-cards/lookup', { code: p.code })).data
    if (p.card.status !== 'in_stock') p.error = `This card was already sold — ${p.card.label}, ${etb(p.card.balance)} left (${STATUS[p.card.status]}).`
  } catch (e) {
    p.error = e.status === 404 ? 'This number isn’t in the system. Check the card, or ask a manager to add its batch under “Printed cards”.' : e.status === 429 ? 'Too many lookups — wait a minute.' : e.message
  } finally { p.checking = false }
}
const physValue = computed(() => (physical.value?.type === 'service' ? services.value.find((s) => s.id === physical.value.service_id)?.price : physical.value?.amount) ?? 0)
async function sellPhysical() {
  const p = physical.value
  if (p.card?.status !== 'in_stock') return checkPhysical()
  p.error = ''
  if (p.type === 'service' && !p.service_id) { p.error = 'Choose the treatment.'; return }
  if (p.type !== 'service' && !(p.amount >= 100)) { p.error = 'Type the amount (ETB 100 or more).'; return }
  if (!p.recipient_name.trim()) { p.error = 'Enter the recipient’s name.'; return }
  if (p.type === 'promo' && !p.reason.trim()) { p.error = 'Write why this free card is given (audit log).'; return }
  const promo = p.type === 'promo'
  if (!(await ask({
    title: `Activate card ${p.card.masked_code} — ${p.type === 'service' ? services.value.find((x) => x.id === p.service_id)?.name : etb(physValue.value)}?`,
    body: [promo ? 'Free promotional card — no payment.' : `Payment: ${p.method.replace('_', ' ')} at the desk.`, `For ${p.recipient_name}${p.recipient_email ? ' · ' + p.recipient_email : ''}${p.recipient_phone ? ' · ' + p.recipient_phone : ''}`,
      (p.recipient_email || p.recipient_phone) ? 'They get a message that the card is active, with the dates it can be used.' : ''].filter(Boolean).join('\n'),
    ok: promo ? 'Activate free card' : `Take ${etb(physValue.value)}`,
  }))) return
  try {
    const card = (await api.post('/staff/gift-cards/stock/sell', {
      code: p.code, type: p.type, amount: p.type !== 'service' ? p.amount : undefined, service_id: p.type === 'service' ? p.service_id : undefined,
      method: promo ? undefined : p.method, reason: promo ? p.reason.trim() : undefined,
      purchaser_client_id: p.purchaser?.id, purchaser_name: p.purchaser ? undefined : p.purchaser_name || undefined,
      recipient_name: p.recipient_name || undefined, recipient_phone: p.recipient_phone || undefined, recipient_email: p.recipient_email || undefined, message: p.message || undefined,
    })).data
    physical.value = null
    detail.value = card
    notify(`Card ${card.masked_code} is active — ${etb(card.balance)}`)
    load()
  } catch (e) { p.error = e.message }
}
function sellFromDetail(c) {
  detail.value = null
  openPhysical()
  physical.value.code = c.card_number ?? ''
  if (physical.value.code) checkPhysical()
}
// Camera scanning (laptop webcam, tablet or phone) for the card number
const camera = ref(null) // 'lookup' | 'sell'
function scanned(text) {
  const where = camera.value
  camera.value = null
  if (where === 'lookup' && looking.value) { looking.value.code = text; lookup() }
  if (where === 'sell' && physical.value) { physical.value.code = text; checkPhysical() }
}
const page = ref(1)
watch([status, q], () => (page.value = 1), { flush: 'sync' })
</script>

<template>
  <div class="head">
    <div>
      <h1>Gift cards</h1>
      <p>E-gift cards are bought by clients in the app — activate them here. Printed gift cards are sold at the desk. Scan a card at the visit to see everything about it and use it; it can be spent over several visits until its balance runs out.</p>
    </div>
    <div class="row" style="flex-wrap: nowrap; flex: none">
      <button class="btn" @click="looking = { code: '', error: '' }">⌁ Scan a gift card</button>
      <button v-if="auth.can('giftcards.stock')" class="btn ghost" @click="openStock">▤ Printed Gift Cards</button>
      <button v-if="auth.can('giftcards.sell')" class="btn gold" @click="openPhysical">Sell a Gift Card</button>
    </div>
  </div>

  <div class="grid g4" style="margin-bottom: 18px">
    <div class="card stat gold"><div class="n">{{ etb(meta.liability) }}</div><div class="l">Outstanding balance (liability)</div></div>
    <div v-if="auth.can('giftcards.activate')" class="card stat click" :class="{ warn: count('awaiting_activation') }" @click="status = 'awaiting_activation'; load()"><div class="n">{{ count('awaiting_activation') }}</div><div class="l">E-gift cards to activate</div></div>
    <div v-else class="card stat"><div class="n">{{ meta.total ?? rows.length }}</div><div class="l">{{ STATUS[status] ?? 'All' }} cards</div></div>
    <div class="card stat"><div class="n">{{ meta.in_stock ?? 0 }}</div><div class="l">Printed cards not sold yet</div></div>
    <div class="card note gc-help">Scan a card’s barcode or QR code (or type its number) to look it up, sell it or use it.</div>
  </div>

  <div class="row" style="gap: 8px; margin-bottom: 12px">
    <div class="tabs" style="margin: 0">
      <button v-for="s in tabs" :key="s" :class="{ on: status === s }" @click="status = s; load()">{{ STATUS[s] ?? 'All' }}<span v-if="s === 'awaiting_activation' && count(s)" class="cnt">{{ count(s) }}</span></button>
    </div>
    <input v-model="q" placeholder="Search name, phone or last 4 of the code" style="max-width: 300px; margin-left: auto" />
  </div>
  <p v-if="error" class="err">{{ error }}</p>
  <p v-if="status === 'awaiting_activation'" class="note" style="margin: 0 0 10px">E-gift cards bought in the app. <b>Awaiting payment</b>: the client hasn’t paid yet (or their receipt is being checked) — you can record the payment and activate in one step. <b>To activate</b>: paid — check the buyer, recipient and amount, then activate; the recipient is emailed / texted that it is active, with the dates it can be used.</p>

  <div v-if="false" class="card" style="margin-bottom: 12px">
    <h3 style="margin-top: 0">Printed batches</h3>
    <table>
      <thead><tr><th>Batch</th><th>Cards</th><th>Not sold</th><th>Created</th></tr></thead>
      <tbody><tr v-for="b in meta.batches" :key="b.batch"><td><b>{{ b.batch }}</b></td><td>{{ b.total }}</td><td>{{ b.unsold }}</td><td>{{ day(b.created_at) }}</td></tr></tbody>
    </table>
  </div>

  <div class="card">
    <table>
      <thead><tr><th>Card</th><th>Balance</th><th>For</th><th>From</th><th>Status</th><th>Valid</th></tr></thead>
      <tbody>
        <tr v-for="c in rows" :key="c.id" class="click" @click="open(c.id)">
          <td><span v-if="c.card_number" class="mini-bc" v-html="barcodeSvg(c.card_number, { height: 22, width: 1 })"></span><span v-else class="mini" :style="{ background: `linear-gradient(135deg, ${DESIGNS[c.design]?.[0]}, ${DESIGNS[c.design]?.[1]})` }"></span><b>{{ c.card_number ? grouped(c.card_number) : c.masked_code }}</b><small>{{ c.status === 'in_stock' ? 'Printed card · not sold yet' + (c.batch ? ' · ' + c.batch : '') : c.label }}</small></td>
          <td v-if="c.status === 'in_stock'"><span class="note">Not sold yet</span></td><td v-else><b>{{ etb(c.balance) }}</b><small>of {{ etb(c.initial_value) }}</small><div v-if="c.status !== 'in_stock'" class="meter"><i :style="{ width: pct(c) + '%' }"></i></div></td>
          <td>{{ c.recipient.name ?? '—' }}<small>{{ c.recipient.phone }}</small></td>
          <td>{{ c.from ?? '—' }}<small>{{ SOURCE[c.source] }}{{ c.batch ? ' · ' + c.batch : '' }}</small></td>
          <td><span class="badge" :class="BADGE[c.status]">{{ STATUS[c.status] }}</span><small v-if="c.used && c.status !== 'in_stock'">{{ etb(c.used) }} used</small></td>
          <td><template v-if="c.activated_at">{{ day(c.activated_at) }} –<br /></template>{{ day(c.expires_at) }}</td>
        </tr>
        <tr v-if="!rows.length"><td colspan="6" class="empty">No gift cards</td></tr>
      </tbody>
    </table>
    <Pager :meta="meta" label="cards" @go="(n) => { page = n; load() }" />
  </div>

  <!-- Card detail -->
  <div v-if="detail" class="drawer-bg" @click.self="detail = null">
    <aside class="drawer gc-drawer">
      <button class="btn ghost sm" style="float: right" @click="detail = null">✕</button>
      <div class="gcard" :style="{ background: `linear-gradient(135deg, ${DESIGNS[detail.design]?.[0]}, ${DESIGNS[detail.design]?.[1]})` }">
        <img src="/img/logo-white.png" alt="" />
        <span class="v">{{ detail.type === 'service' ? detail.service?.name : etb(detail.balance) }}</span>
        <span class="c">{{ detail.masked_code }}</span>
      </div>
      <div v-if="detail.card_number" class="codes">
        <div class="bc-big" v-html="barcodeSvg(detail.card_number, { height: 54, width: 1.6 })"></div>
        <div class="qr-big" v-html="qrSvg(detail.card_number)"></div>
        <div class="num">{{ grouped(detail.card_number) }}</div>
        <button class="btn ghost sm" @click="printOne(detail)">🖨 Print this card</button>
      </div>
      <div class="kvs">
        <div><span>Status</span><b><span class="badge" :class="BADGE[detail.status]">{{ detail.status === 'in_stock' ? 'Printed card — not sold yet' : STATUS[detail.status] }}</span></b></div>
        <div><span>Card</span><b>{{ detail.physical ? 'Printed card' + (detail.batch ? ' · ' + detail.batch : '') : { app: 'E-gift card (bought in the app)', front_desk: 'Sold at the front desk', promo: 'Promotional card' }[detail.source] ?? 'Gift card' }}</b></div>
        <div><span>Amount the giver paid</span><b>{{ detail.type === 'service' ? detail.service?.name + ' · ' : '' }}{{ etb(detail.initial_value) }}</b></div>
        <div><span>Left on the card</span><b>{{ etb(detail.balance) }}<template v-if="detail.used"> · {{ etb(detail.used) }} used</template></b></div>
        <div v-if="detail.status !== 'in_stock'" class="meter-row"><div class="meter wide"><i :style="{ width: pct(detail) + '%' }"></i></div></div>
        <div><span>For (recipient)</span><b>{{ detail.recipient.name ?? '—' }}<small v-if="detail.recipient.phone || detail.recipient.email">{{ [detail.recipient.phone, detail.recipient.email].filter(Boolean).join(' · ') }}</small><small v-if="detail.recipient_client">Lavish client: {{ detail.recipient_client.name }}</small></b></div>
        <div><span>From (giver)</span><b>{{ detail.from ?? '—' }}<small v-if="detail.purchaser">{{ [detail.purchaser.phone, detail.purchaser.email].filter(Boolean).join(' · ') }}</small></b></div>
        <div v-if="detail.payment_status"><span>Payment</span><b>{{ { paid: 'Paid ✓', unpaid: 'Not paid yet', pending: 'Receipt waiting to be checked', failed: 'Failed' }[detail.payment_status] ?? detail.payment_status }}</b></div>
        <div><span>Valid</span><b>{{ detail.activated_at ? 'from ' + day(detail.activated_at) + ' to ' + day(detail.expires_at) : detail.expires_at ? 'until ' + day(detail.expires_at) : 'from activation, for the card’s validity' }}</b></div>
        <div v-if="detail.activated_by"><span>Activated by</span><b>{{ detail.activated_by }} · {{ when(detail.activated_at) }}</b></div>
        <div v-if="detail.message"><span>Message</span><b>“{{ detail.message }}”</b></div>
        <div><span>Delivery</span><b>{{ { print: 'Printed card', sms: 'SMS', email: 'Email' }[detail.delivery] }} · {{ detail.delivered_at ? 'sent ' + when(detail.delivered_at) : detail.deliver_at ? 'scheduled ' + day(detail.deliver_at) : 'not sent yet' }}</b></div>
        <div v-if="detail.sold_by"><span>Sold by</span><b>{{ detail.sold_by }}</b></div>
      </div>
      <div class="gc-acts">
        <template v-if="['awaiting_activation', 'pending_payment'].includes(detail.status) && auth.can('giftcards.activate') && detail.source === 'app'">
          <div v-if="activating && detail.status === 'pending_payment'" class="act-box">
            <label>Not paid yet — how was it paid?</label>
            <select v-model="activating.method"><option value="telebirr">Telebirr</option><option value="cbe_birr">CBE Birr</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option></select>
          </div>
          <button class="btn gold" @click="activate">{{ detail.status === 'pending_payment' ? (activating ? 'Record payment & activate' : 'Activate (record payment)…') : 'Activate card' }}</button>
          <p v-if="activating?.error" class="err">{{ activating.error }}</p>
        </template>
        <button v-if="detail.status === 'active' && detail.balance > 0 && auth.can('giftcards.use')" class="btn gold" @click="openUse">Use for a treatment…</button>
      </div>
      <template v-if="detail.status === 'active' || detail.messages?.length">
        <h3>Message to the recipient</h3>
        <p v-if="!detail.messages?.length" class="note">{{ detail.recipient.email || detail.recipient.phone ? 'Not sent yet.' : 'No recipient email or phone on this card.' }}</p>
        <div v-for="(m, i) in detail.messages" :key="i" class="led">
          <span class="grow"><b>{{ m.channel === 'email' ? '✉ Email' : '💬 SMS' }} to {{ m.to }}</b><small>{{ when(m.at) }}<template v-if="m.error"> · {{ m.error }}</template></small></span>
          <span class="badge" :class="{ sent: 'paid', failed: 'declined', not_set_up: 'pending' }[m.status]">{{ { sent: 'Sent', failed: 'Failed', not_set_up: m.channel === 'email' ? 'Email not set up' : 'SMS not set up' }[m.status] }}</span>
        </div>
        <p v-if="detail.messages?.some((m) => m.status === 'not_set_up')" class="note">The server isn’t connected to {{ detail.messages.some((m) => m.status === 'not_set_up' && m.channel === 'email') ? 'email' : 'SMS' }} yet, so this message didn’t leave Lavish. Ask the developer to add the email (SMTP) / AfroMessage settings.</p>
        <button v-if="detail.status === 'active' && (detail.recipient.email || detail.recipient.phone) && auth.can('giftcards.activate', 'giftcards.sell')" class="btn ghost sm" style="margin-top: 6px" @click="resend">↻ Send the message again</button>
      </template>
      <h3>History</h3>
      <p v-if="!detail.ledger?.length" class="note">Nothing yet — the card’s value appears here when it is activated, then every use.</p>
      <div v-for="l in detail.ledger" :key="l.id" class="led">
        <span class="grow"><b>{{ LEDGER[l.type] ?? l.type }}</b><small>{{ when(l.created_at) }}<template v-if="l.reason"> · {{ l.reason }}</template><template v-if="l.by"> · {{ l.by }}</template></small></span>
        <span class="amt"><b :class="l.amount >= 0 ? 'pos' : 'neg'">{{ l.amount >= 0 ? '+' : '−' }}{{ etb(Math.abs(l.amount)) }}</b><small>{{ etb(l.balance_after) }} left</small></span>
      </div>
      <button v-if="detail.status === 'in_stock' && auth.can('giftcards.sell')" class="btn gold" style="margin-top: 16px" @click="sellFromDetail(detail)">Sell this card…</button>
      <button v-if="auth.can('giftcards.void') && ['active', 'redeemed', 'expired', 'in_stock'].includes(detail.status)" class="btn danger" style="margin-top: 16px" @click="voiding = { card: detail, reason: '', reissue: true, error: '' }">Void (lost / stolen card)…</button>
    </aside>
  </div>

  <!-- Use at the visit -->
  <div v-if="using" class="modal-bg" style="z-index: 40" @click.self="using = null">
    <form class="modal" @submit.prevent="useCard">
      <h2>Use {{ detail.masked_code }}</h2>
      <p class="note">{{ detail.label }} · {{ etb(detail.balance) }} left · valid until {{ day(detail.expires_at) }}</p>
      <label>Treatment</label>
      <select v-model="using.service_id" :disabled="detail.type === 'service'" @change="pickService"><option v-for="x in services" :key="x.id" :value="x.id">{{ x.name }} — {{ etb(x.price) }}</option></select>
      <label>Amount from the card (ETB)</label>
      <input v-model.number="using.amount" type="number" min="1" :max="detail.balance" required :disabled="detail.type === 'service'" />
      <small class="note">{{ detail.type === 'service' ? 'A treatment card covers its treatment in full.' : `Up to ${etb(detail.balance)}. If the treatment costs more, take the rest as a normal payment.` }}</small>
      <label>Note (optional)</label><input v-model="using.note" maxlength="255" placeholder="e.g. Dr. Meron · Bole branch" />
      <p v-if="using.error" class="err">{{ using.error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 14px"><button type="button" class="btn ghost" @click="using = null">Cancel</button><button class="btn gold">Use {{ etb(using.amount) }}</button></div>
    </form>
  </div>

  <!-- Sell -->
  <div v-if="selling" class="modal-bg" @click.self="selling = null">
    <form class="modal" style="width: min(640px, 95vw); max-height: 92vh; overflow: auto" @submit.prevent="sell">
      <h2>Sell a gift card</h2>
      <div class="seg">
        <button type="button" :class="{ on: selling.type === 'monetary' }" @click="selling.type = 'monetary'">Amount</button>
        <button type="button" :class="{ on: selling.type === 'service' }" @click="selling.type = 'service'">A treatment</button>
        <button v-if="auth.can('giftcards.promo')" type="button" :class="{ on: selling.type === 'promo' }" @click="selling.type = 'promo'">Free promo card</button>
      </div>
      <template v-if="selling.type !== 'service'">
        <label>Amount (ETB)</label>
        <div class="row" style="gap: 6px; flex-wrap: wrap">
          <button v-for="a in [1000, 2500, 5000, 10000]" :key="a" type="button" class="btn sm" :class="selling.amount === a ? '' : 'ghost'" @click="selling.amount = a">{{ etb(a) }}</button>
          <input v-model.number="selling.amount" type="number" min="100" step="50" required style="width: 140px" />
        </div>
      </template>
      <template v-else>
        <label>Treatment</label>
        <select v-model="selling.service_id"><option v-for="s in services" :key="s.id" :value="s.id">{{ s.name }} — {{ etb(s.price) }}</option></select>
      </template>
      <div class="grid g2">
        <div v-if="selling.type !== 'promo'">
          <label>Buyer (client)</label>
          <input v-model="selling.purchaserTerm" placeholder="Search by name or phone" @input="searchClients(selling.purchaserTerm); selling.purchaser = null" />
          <div v-if="clients.length && !selling.purchaser" class="sugg-list"><button v-for="c in clients" :key="c.client.id" type="button" @click="selling.purchaser = c.client; selling.purchaserTerm = c.client.name; clients = []">{{ c.client.name }} <small>{{ c.client.phone }}</small></button></div>
          <small class="note">{{ selling.purchaser ? 'Linked to ' + selling.purchaser.name : 'Optional — leave empty for a walk-in buyer' }}</small>
        </div>
        <div v-if="selling.type !== 'promo'"><label>Paid with</label>
          <select v-model="selling.method"><option value="cash">Cash</option><option value="card">Card</option><option value="telebirr">Telebirr</option><option value="cbe_birr">CBE Birr</option><option value="bank_transfer">Bank transfer</option></select></div>
        <div><label>Recipient name</label><input v-model="selling.recipient_name" /></div>
        <div><label>Delivery</label><select v-model="selling.delivery"><option value="print">Printed card (now)</option><option value="sms">SMS</option><option value="email">Email</option></select></div>
        <div v-if="selling.delivery === 'sms'"><label>Recipient phone</label><PhoneInput v-model="selling.recipient_phone" required /></div>
        <div v-if="selling.delivery === 'email'"><label>Recipient email</label><input v-model="selling.recipient_email" type="email" required /></div>
        <div v-if="selling.delivery !== 'print'"><label>Send on (optional)</label><input v-model="selling.deliver_at" type="date" /></div>
      </div>
      <label>Design</label>
      <div class="designs"><button v-for="(c, k) in DESIGNS" :key="k" type="button" :class="{ on: selling.design === k }" :style="{ background: `linear-gradient(135deg, ${c[0]}, ${c[1]})` }" :title="k" @click="selling.design = k"></button></div>
      <label>Message (optional)</label><input v-model="selling.message" maxlength="300" />
      <template v-if="selling.type === 'promo'"><label>Reason (audit log)</label><input v-model="selling.reason" required placeholder="e.g. Valentine’s campaign winner" /></template>
      <p v-if="selling.error" class="err">{{ selling.error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 16px"><button type="button" class="btn ghost" @click="selling = null">Cancel</button><button class="btn gold">{{ selling.type === 'promo' ? 'Issue card' : `Sell · ${etb(sellValue)}` }}</button></div>
    </form>
  </div>

  <!-- Code shown once -->
  <div v-if="shown" class="modal-bg">
    <div class="modal print-card" style="width: min(480px, 95vw); text-align: center; max-height: 94vh; overflow: auto">
      <h2>{{ shown.reissued ? 'New card issued' : 'Gift card ready' }}</h2>
      <component :is="'style'">{{ CARD_CSS }}</component>
      <div class="card-preview">
        <div v-html="FRONT"></div>
        <div v-html="cardBackHtml(cardFace(shown.card, shown.code))"></div>
      </div>
      <p class="note" style="margin-top: 8px">Valid until {{ day(shown.card.expires_at) }}</p>
      <p class="note">This is the only time the full code is shown. {{ shown.card.delivery === 'print' ? 'Print it or write it on the card now.' : 'It was also sent to the recipient.' }}</p>
      <div class="row" style="justify-content: center; gap: 8px; margin-top: 12px"><button class="btn ghost" @click="printShown">🖨 Print card</button><button class="btn gold" @click="shown = null">Done</button></div>
    </div>
  </div>

  <!-- Lookup -->
  <div v-if="looking" class="modal-bg" @click.self="looking = null">
    <form class="modal" @submit.prevent="lookup">
      <h2>Scan a gift card</h2>
      <p class="note">Scan the barcode (on the printed card, or in the client’s app / email), or type the full code. You’ll see who it is for, who gave it, the amount, what is left, the dates it can be used and every use.</p>
      <input v-model="looking.code" class="codein" required autofocus placeholder="XXXX-XXXX-XXXX-XXXX" />
      <button type="button" class="btn ghost" style="width: 100%; margin-top: 8px" @click="camera = 'lookup'">📷 Scan with camera</button>
      <p v-if="looking.error" class="err">{{ looking.error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 14px"><button type="button" class="btn ghost" @click="looking = null">Cancel</button><button class="btn gold">Look up</button></div>
    </form>
  </div>

  <!-- Printed cards: create a batch or import numbers (managers) -->
  <div v-if="stock" class="modal-bg" @click.self="stock = null">
    <form class="modal" style="width: min(600px, 95vw); max-height: 92vh; overflow: auto" @submit.prevent="saveStock">
      <h2>Printed Gift Cards</h2>
      <p class="note">Make hard-copy cards with a barcode and QR code. The cards are saved as a file on this computer (Downloads, or the folder you pick) — open it and print whenever you need. A card holds no value until it is sold at the desk.</p>
      <div class="seg">
        <button type="button" :class="{ on: stock.mode === 'generate' }" @click="stock.mode = 'generate'">New cards</button>
        <button type="button" :class="{ on: stock.mode === 'import' }" @click="stock.mode = 'import'">Cards already printed</button>
      </div>
      <template v-if="stock.mode === 'generate'">
        <label>How many cards</label><input v-model.number="stock.count" type="number" min="1" max="1000" required />
        <p class="note">Lavish creates secure random numbers. The print-ready cards (and a list of the numbers for a printing company) are saved as one file.</p>
      </template>
      <template v-else>
        <label>Card numbers <small class="note">— one per line, or a CSV from the printer</small></label>
        <textarea v-model="stock.text" rows="6" placeholder="4006381333931&#10;4006381333948&#10;…" style="font-family: ui-monospace, monospace"></textarea>
        <div style="margin-top: 8px"><FilePicker :model-value="stock.file ?? null" accept=".csv,.txt" compact title="Or upload the printer’s CSV" hint="CSV or text file · up to 5 MB" @update:model-value="readFile" /></div>
        <p class="note">{{ importCodes(stock.text).length }} numbers found. Numbers must be at least 10 letters/digits — short, sequential numbers are easy to guess, so prefer “New numbers”.</p>
      </template>
      <label>Batch name</label><input v-model="stock.batch" maxlength="40" placeholder="e.g. Genna 2027 · Printer order 12" />
      <p v-if="stock.error" class="err">{{ stock.error }}</p>
      <div v-if="meta.batches?.length" style="margin-top: 14px">
        <h3 style="margin: 0 0 6px">Batches</h3>
        <table><thead><tr><th>Batch</th><th>Cards</th><th>Not sold</th><th>Made</th><th></th></tr></thead>
          <tbody><tr v-for="b in meta.batches" :key="b.batch"><td><b>{{ b.batch }}</b></td><td>{{ b.total }}</td><td>{{ b.unsold }}</td><td>{{ day(b.created_at) }}</td>
            <td><button type="button" class="btn ghost sm" @click="saveBatch(b)">⬇ Save cards</button></td></tr></tbody></table>
      </div>
      <div class="row" style="justify-content: flex-end; margin-top: 16px"><button type="button" class="btn ghost" @click="stock = null">Cancel</button><button class="btn gold" :disabled="stock.busy">{{ stock.mode === 'generate' ? `Print ${stock.count || 0} gift cards…` : 'Add cards' }}</button></div>
    </form>
  </div>

  <!-- Where the printed cards were saved -->
  <div v-if="savedInfo" class="modal-bg" style="z-index: 46" @click.self="savedInfo = null">
    <div class="modal" style="width: min(520px, 95vw)">
      <h2>✓ {{ savedInfo.count }} gift cards saved</h2>
      <p>Saved as <b>“{{ savedInfo.file }}”</b> — in your <b>Downloads</b> folder, or in the folder you picked if your browser asked.</p>
      <ul class="files"><li>Open the file (double-click) and press <b>🖨 Print</b> — front and back of every card, with barcode and QR code.</li>
        <li>The last page lists all the card numbers (for a printing company).</li></ul>
      <p v-if="savedInfo.missing" class="note">{{ savedInfo.missing }} older card(s) in this batch were made before numbers were kept and are not in the file.</p>
      <p class="note">You can save them again any time: Printed Gift Cards → “⬇ Save cards” next to the batch.<br />Want to choose the folder each time? In Chrome: ⋮ → Settings → Downloads → turn on “Ask where to save each file before downloading”.</p>
      <div class="row" style="justify-content: flex-end; margin-top: 12px"><button class="btn gold" @click="savedInfo = null">OK</button></div>
    </div>
  </div>

  <CameraScanner v-if="camera" title="Scan the gift card" @scanned="scanned" @close="camera = null" />

  <!-- Sell a printed card -->
  <div v-if="physical" class="modal-bg" @click.self="physical = null">
    <form class="modal" style="width: min(620px, 95vw); max-height: 92vh; overflow: auto" @submit.prevent="sellPhysical">
      <h2>Sell a Gift Card</h2>
      <p class="note">Scan the barcode or QR code on the back of the printed card (or type its number).</p>
      <div class="row" style="gap: 8px; flex-wrap: nowrap">
        <input ref="scanInput" v-model="physical.code" class="codein" style="margin: 0" placeholder="Scan or type the card number" @keydown.enter.prevent="checkPhysical" @change="checkPhysical" />
        <button type="button" class="btn ghost" :disabled="physical.checking" @click="checkPhysical">Check</button>
        <button type="button" class="btn ghost" title="Scan with the camera" @click="camera = 'sell'">📷 Camera</button>
      </div>
      <p v-if="physical.card?.status === 'in_stock'" class="ok">✓ Blank card {{ physical.card.masked_code }}{{ physical.card.batch ? ' · ' + physical.card.batch : '' }} — ready to sell</p>
      <template v-if="physical.card?.status === 'in_stock'">
        <div class="seg">
          <button type="button" :class="{ on: physical.type === 'monetary' }" @click="physical.type = 'monetary'">Amount</button>
          <button type="button" :class="{ on: physical.type === 'service' }" @click="physical.type = 'service'">A treatment</button>
          <button v-if="auth.can('giftcards.promo')" type="button" :class="{ on: physical.type === 'promo' }" @click="physical.type = 'promo'">Promo (free)</button>
        </div>
        <template v-if="physical.type !== 'service'">
          <label>Amount (ETB)</label>
          <input v-model.number="physical.amount" type="number" min="100" step="50" placeholder="Type the amount" style="width: 220px" />
        </template>
        <template v-else>
          <label>Treatment</label>
          <select v-model="physical.service_id"><option :value="null" disabled>Choose a treatment…</option><option v-for="s in services" :key="s.id" :value="s.id">{{ s.name }} — {{ etb(s.price) }}</option></select>
        </template>
        <div class="grid g2">
          <div v-if="physical.type !== 'promo'"><label>Paid with</label>
            <select v-model="physical.method"><option value="cash">Cash</option><option value="card">Card</option><option value="telebirr">Telebirr</option><option value="cbe_birr">CBE Birr</option><option value="bank_transfer">Bank transfer</option></select></div>
          <div v-if="physical.type !== 'promo'"><label>Buyer name (optional)</label><input v-model="physical.purchaser_name" placeholder="Who is buying it" /></div>
          <div><label>Recipient name</label><input v-model="physical.recipient_name" placeholder="Who the card is for" /></div>
          <div><label>Recipient phone (optional)</label><PhoneInput v-model="physical.recipient_phone" /></div>
          <div><label>Recipient email (optional)</label><input v-model="physical.recipient_email" type="email" /></div>
          <div><label>Message (optional)</label><input v-model="physical.message" maxlength="300" placeholder="e.g. Happy birthday!" /></div>
          <div v-if="physical.type === 'promo'"><label>Reason (audit log)</label><input v-model="physical.reason" maxlength="255" placeholder="e.g. Raffle winner" /></div>
        </div>
      </template>
      <p v-if="physical.card?.status === 'in_stock'" class="note">The card is active from today. If you enter the recipient’s phone or email, they get a message with the dates it can be used.</p>
      <p v-if="physical.error" class="err">{{ physical.error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 16px"><button type="button" class="btn ghost" @click="physical = null">Cancel</button><button class="btn gold" :disabled="physical.card?.status !== 'in_stock'">{{ physical.type === 'promo' ? 'Activate free card' : physValue ? `Activate · ${etb(physValue)}` : 'Activate' }}</button></div>
    </form>
  </div>

  <!-- Void -->
  <div v-if="voiding" class="modal-bg" style="z-index: 40" @click.self="voiding = null">
    <form class="modal" @submit.prevent="doVoid">
      <h2>Void {{ voiding.card.masked_code }}</h2>
      <p class="note">Use this when a card is lost or stolen. The old code stops working immediately.</p>
      <label class="chk"><input v-model="voiding.reissue" type="checkbox" /> Move the {{ etb(voiding.card.balance) }} balance to a new card</label>
      <label>Reason (audit log)</label><input v-model="voiding.reason" required minlength="4" placeholder="e.g. Client lost the printed card" />
      <p v-if="voiding.error" class="err">{{ voiding.error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 14px"><button type="button" class="btn ghost" @click="voiding = null">Cancel</button><button class="btn danger">Void card</button></div>
    </form>
  </div>
</template>

<style scoped>
td small { display: block; color: var(--muted); font-size: 12px; }
tr.click { cursor: pointer; }
tr.click:hover td { background: #faf9f8; }
.mini { display: inline-block; width: 28px; height: 18px; border-radius: 4px; vertical-align: middle; margin-right: 8px; }
.meter { width: 90px; height: 4px; border-radius: 99px; background: #eee; margin-top: 4px; overflow: hidden; }
.meter i { display: block; height: 100%; background: var(--dark); }
.gc-help { display: flex; align-items: center; font-size: 12.5px; }
.card-preview { display: grid; gap: 10px; justify-items: center; margin: 12px 0 4px; }
.card-preview :deep(.lv-card) { box-shadow: 0 10px 24px -14px rgba(0, 0, 0, .45); text-align: left; }
.stat.click { cursor: pointer; }
.stat.warn { border-color: #e7c99a; background: #fdf6ea; }
.tabs .cnt { display: inline-block; min-width: 18px; margin-left: 6px; padding: 0 5px; border-radius: 99px; background: var(--gold, #b8956a); color: #fff; font-size: 11px; line-height: 18px; }
.gc-acts { display: grid; gap: 8px; margin-top: 14px; }
.act-box select { width: 100%; }
.meter.wide { width: 100%; height: 6px; }
.meter-row { border-top: 0 !important; padding-top: 0 !important; }
.kvs small { display: block; color: var(--muted); font-size: 12px; font-weight: 400; }
.amt { text-align: right; }
.amt small { display: block; color: var(--muted); font-size: 11.5px; }
.gcard .bc { display: block; background: #fff; border-radius: 6px; padding: 6px 8px; width: fit-content; }
.gcard .bc :deep(svg) { display: block; max-width: 100%; }
.ok { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: #e6f3ef; color: var(--teal-deep); font-size: 13px; }
.made-list { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
.made-list code { padding: 6px 8px; border-radius: 6px; background: #f3f2f0; font-size: 13px; }
.made-list small { grid-column: span 2; color: var(--muted); }
textarea { width: 100%; }
.gc-drawer { width: min(440px, 95vw); }
.gcard { position: relative; display: flex; flex-direction: column; justify-content: space-between; aspect-ratio: 1.6; padding: 18px 20px; border-radius: 16px; color: #fff; box-shadow: 0 20px 40px -20px rgba(0, 0, 0, .5); margin: 10px 0 16px; text-align: left; }
.gcard img { width: 90px; }
.gcard .v { font: 500 28px 'EB Garamond', serif; }
.gcard .c { font-size: 12px; letter-spacing: 2px; opacity: .85; }
.gcard .code { font: 600 22px ui-monospace, monospace; letter-spacing: 2px; }
.gcard.big { margin: 14px auto; }
.kvs > div { display: flex; justify-content: space-between; gap: 14px; padding: 7px 0; border-top: 1px solid #f0efed; font-size: 13.5px; }
.kvs span { color: var(--muted); }
.kvs b { font-weight: 500; text-align: right; }
h3 { margin: 18px 0 6px; }
.led { display: flex; gap: 10px; align-items: center; padding: 8px 0; border-top: 1px solid #f0efed; }
.led b { display: block; font-weight: 500; font-size: 13.5px; }
.led small { color: var(--muted); font-size: 12px; }
.grow { flex: 1; }
.pos { color: var(--teal-deep); font-weight: 500; }
.neg { color: var(--bad); font-weight: 500; }
label { display: block; font-size: 13px; margin: 10px 0 4px; }
.chk { display: flex; gap: 8px; align-items: center; }
.chk input { width: auto; }
.seg { display: inline-flex; gap: 4px; padding: 4px; border-radius: 12px; background: #f3f2f0; margin-top: 6px; }
.seg button { padding: 7px 14px; border: 0; border-radius: 9px; background: none; cursor: pointer; font-size: 13px; }
.seg button.on { background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .1); color: var(--teal-deep); }
.designs { display: flex; gap: 8px; }
.designs button { width: 54px; height: 34px; border-radius: 8px; border: 2px solid transparent; cursor: pointer; }
.designs button.on { border-color: var(--ink); box-shadow: 0 0 0 2px #fff inset; }
.sugg-list { display: grid; border: 1px solid var(--line); border-radius: 10px; margin-top: 4px; overflow: hidden; }
.sugg-list button { padding: 8px 10px; border: 0; background: #fff; text-align: left; cursor: pointer; }
.sugg-list button:hover { background: #f6f5f4; }
.sugg-list small { color: var(--muted); }
.codein { width: 100%; margin-top: 10px; font: 600 18px ui-monospace, monospace; letter-spacing: 2px; text-transform: uppercase; text-align: center; }
.err { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: #f8e7e5; color: var(--bad); font-size: 13px; }
@media print { body * { visibility: hidden; } .print-card, .print-card * { visibility: visible; } .print-card { position: fixed; inset: 0; } .print-card .btn, .print-card .note { display: none; } }
.mini-bc { display: inline-block; vertical-align: middle; margin-right: 8px; background: #fff; padding: 2px 3px; border-radius: 3px; border: 1px solid var(--line); }
.mini-bc :deep(svg) { height: 18px; width: auto; max-width: 70px; display: block; }
.codes { display: grid; justify-items: center; gap: 8px; margin: 6px 0 14px; padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: #fff; }
.codes .bc-big :deep(svg) { max-width: 100%; height: 54px; display: block; }
.codes .qr-big { width: 120px; height: 120px; }
.codes .qr-big :deep(svg) { width: 100%; height: 100%; }
.codes .num { font: 600 15px ui-monospace, monospace; letter-spacing: 1.5px; }
.files { margin: 8px 0; padding-left: 18px; font-size: 13.5px; }
.files li { margin: 4px 0; }
</style>
