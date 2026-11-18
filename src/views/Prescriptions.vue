<script setup>
// Prescriptions — GET /staff/prescriptions (doctors: their own). The client sees a new prescription in the app
// at once; out-of-stock products can be re-suggested to the client when they're back.
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { etb, day } from '../fmt'
import ClientLink from '../components/ClientLink.vue'
import Pager from '../components/Pager.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const canPrescribe = computed(() => auth.can('prescriptions.create') && !!auth.user?.doctor_id)
const isDoctor = computed(() => canPrescribe.value && !auth.can('prescriptions.fulfil'))
const showPrice = computed(() => auth.can('finance.revenue') || auth.can('prescriptions.fulfil'))

const rows = ref([])
const products = ref([])
const patients = ref([])
const error = ref('')
async function load() {
  try {
    const res = await api.get('/staff/prescriptions', { page: page.value, per_page: 20 })
    rows.value = res.data
    meta.value = res.meta
  } catch (e) {
    error.value = e.message
  }
}
onMounted(async () => {
  load()
  if (canPrescribe.value) {
    const [p, c] = await Promise.all([api.get('/staff/products').catch(() => ({ data: [] })), api.get('/staff/clients', { per_page: 200 }).catch(() => ({ data: [] }))])
    products.value = p.data.filter((x) => x.active)
    patients.value = c.data
    if (route.query.client) openNew(+route.query.client)
  }
})

const total = (rx) => rx.items.reduce((s, i) => s + (i.product?.price ?? 0) * i.quantity, 0)
const itemName = (i) => i.custom_name ?? i.product?.name
const restocked = computed(() => rows.value.flatMap((rx) => rx.items.filter((i) => i.can_suggest).map((item) => ({ rx, item }))))
const stillWaiting = computed(() => rows.value.flatMap((rx) => rx.items.filter((i) => i.was_out_of_stock && !i.suggested_at && !i.product?.in_stock).map((item) => ({ rx, item }))))

// product_id 0 = "Other" — a medicine Lavish doesn't sell, typed in by the doctor.
const blankLine = () => ({ product_id: products.value.find((p) => p.in_stock)?.id ?? 0, custom_name: '', quantity: 1, instructions: '', remind: false, times: ['08:00'], days: 14 })
// Medicine reminders in the client's app: times of day + how many days.
const PRESETS = [['Morning', ['08:00']], ['Morning & night', ['08:00', '20:00']], ['3 times a day', ['08:00', '14:00', '20:00']], ['Night', ['21:00']]]
const reminderOf = (i) => (i.remind && i.times.filter(Boolean).length ? { reminder_times: [...new Set(i.times.filter(Boolean))], duration_days: +i.days || null } : {})
const reminderText = (r) => (r ? `⏰ ${r.times.join(', ')}${r.ends_on ? ' · until ' + r.ends_on : ' · no end date'}` : '')
const form = ref(null)
const openNew = (clientId = null) => (form.value = { client_id: clientId ?? patients.value[0]?.id, items: [blankLine()], note: '' })
const productOf = (id) => products.value.find((p) => p.id === id)
const patientName = (id) => patients.value.find((c) => c.id === id)?.name

async function save() {
  const f = form.value
  const items = f.items.filter((i) => i.product_id || i.custom_name.trim()).map((i) => (i.product_id
    ? { product_id: i.product_id, quantity: +i.quantity || 1, instructions: i.instructions || null, ...reminderOf(i) }
    : { custom_name: i.custom_name.trim(), quantity: +i.quantity || 1, instructions: i.instructions || null, ...reminderOf(i) }))
  if (!items.length || !f.client_id) return
  if (!(await ask({ title: 'Send this prescription?', body: `${items.length} item(s) for ${patientName(f.client_id)}.\nThey see it in the app right away; e-commerce is notified.`, ok: 'Send prescription' }))) return
  try {
    const rx = (await api.post('/staff/prescriptions', { client_id: f.client_id, note: f.note || null, items })).data
    rows.value.unshift(rx)
    form.value = null
    if (route.query.client) router.replace({ query: {} })
    notify('Prescription sent')
  } catch (e) {
    notify(e.message)
  }
}
async function suggest(rx, item) {
  if (!(await ask({ title: 'Send this suggestion?', body: `${rx.client?.name} is told ${itemName(item)} is back in stock (in their chat).`, ok: 'Send suggestion' }))) return
  try {
    const updated = (await api.post(`/staff/prescription-items/${item.id}/suggest`)).data
    rows.value = rows.value.map((r) => (r.id === updated.id ? updated : r))
    notify('Suggestion sent')
  } catch (e) {
    notify(e.message)
  }
}
async function fulfil(r) {
  if (!(await ask({ title: 'Create an order?', body: `An order is created from ${r.client?.name}’s prescription (in-stock Lavish products only) and appears in Orders.`, ok: 'Create order' }))) return
  try {
    const o = (await api.post(`/staff/prescriptions/${r.id}/fulfil`)).data
    r.status = 'ordered'
    notify(`Order #${o.id} created`)
  } catch (e) {
    notify(e.message)
  }
}
const view = ref(null)
const print = () => window.print()
const page = ref(1)
const meta = ref({})
</script>

<template>
  <div class="head">
    <div>
      <h1>Prescriptions</h1>
      <p v-if="isDoctor">Prescribe Lavish products or outside medicines. The client sees it instantly in the mobile app.</p>
      <p v-else>Products prescribed by doctors. Turn a prescription into an order for delivery.</p>
    </div>
    <button v-if="canPrescribe" class="btn gold" @click="openNew()">+ New prescription</button>
  </div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>

  <div v-if="canPrescribe && (restocked.length || stillWaiting.length)" class="card" style="margin-bottom: 16px">
    <h2>Back in stock</h2>
    <p class="note">Products your patients wanted while they were out of stock. Send a suggestion and it arrives in their chat in the app.</p>
    <div v-for="{ rx, item } in restocked" :key="'r' + item.id" class="alert-row">
      <span><b>{{ rx.client?.name }}</b> · {{ itemName(item) }} <span class="badge delivered">Available now</span><small class="note" style="display: block">Prescribed {{ day(rx.created_at) }}</small></span>
      <button class="btn gold sm" @click="suggest(rx, item)">Send suggestion</button>
    </div>
    <div v-for="{ rx, item } in stillWaiting" :key="'w' + item.id" class="alert-row">
      <span><b>{{ rx.client?.name }}</b> · {{ itemName(item) }} <span class="badge pending">Still out of stock</span></span>
      <span class="note">You’ll be notified when it arrives</span>
    </div>
  </div>

  <div class="grid">
    <div v-for="r in rows" :key="r.id" class="card">
      <div class="row" style="justify-content: space-between">
        <div>
          <h2><ClientLink :id="r.client?.id" :name="r.client?.name" /></h2>
          <p class="note">{{ r.doctor?.name }} · {{ day(r.created_at) }}</p>
        </div>
        <div class="row">
          <span class="badge" :class="r.status === 'ordered' ? 'delivered' : 'pending'">{{ r.status === 'ordered' ? 'Order created' : 'Sent to client' }}</span>
          <span v-if="showPrice" class="serif" style="font-size: 22px">{{ etb(total(r)) }}</span>
        </div>
      </div>
      <table style="margin-top: 10px">
        <tbody>
          <tr v-for="i in r.items" :key="i.id">
            <td>{{ itemName(i) }} <b>×{{ i.quantity }}</b>
              <small v-if="i.is_custom">Outside medicine — buy at a pharmacy</small>
              <small v-else-if="i.was_out_of_stock && !i.suggested_at">Was out of stock</small>
              <small v-else-if="i.suggested_at">Back in stock — patient told ✓</small></td>
            <td class="note">{{ i.instructions || '—' }}<template v-if="i.reminder"><br />{{ reminderText(i.reminder) }}</template></td>
          </tr>
        </tbody>
      </table>
      <p v-if="r.note" class="note" style="margin-top: 8px">“{{ r.note }}”</p>
      <div class="row" style="margin-top: 12px">
        <button class="btn ghost sm" @click="view = r">View / print</button>
        <button v-if="auth.can('prescriptions.fulfil') && r.status === 'sent' && r.items.some((i) => i.product?.in_stock)" class="btn gold sm" @click="fulfil(r)">Create order</button>
      </div>
    </div>
    <p v-if="!rows.length" class="empty card">No prescriptions yet</p>
    <Pager :meta="meta" label="prescriptions" @go="(n) => { page = n; load() }" />
  </div>

  <div v-if="form" class="modal-bg" @click.self="form = null">
    <form class="modal" style="width: min(620px, 94vw); max-height: 90vh; overflow: auto" @submit.prevent="save">
      <h2>New prescription</h2>
      <label>Patient</label>
      <select v-model.number="form.client_id" required><option v-for="c in patients" :key="c.id" :value="c.id">{{ c.name }} · {{ c.phone }}</option></select>
      <p v-if="!patients.length" class="note">You have no patients yet — they appear once reception assigns you a booking.</p>

      <label>Products</label>
      <div v-for="(line, i) in form.items" :key="i" class="rx-line">
        <div class="rx-pick">
          <select v-model.number="line.product_id">
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}{{ p.in_stock ? '' : ' (out of stock)' }}</option>
            <option :value="0">Other — not a Lavish product…</option>
          </select>
          <input v-if="line.product_id === 0" v-model="line.custom_name" placeholder="Medicine name & strength" required />
          <small v-else-if="productOf(line.product_id) && !productOf(line.product_id).in_stock" class="note">Out of stock — you’ll be able to suggest it when it’s back</small>
        </div>
        <input v-model.number="line.quantity" type="number" min="1" max="20" style="width: 70px" />
        <input v-model="line.instructions" placeholder="Dosage / how to use" />
        <button type="button" class="btn danger sm" :disabled="form.items.length === 1" @click="form.items.splice(i, 1)">✕</button>
        <div class="rx-remind">
          <label class="chk"><input v-model="line.remind" type="checkbox" /> Remind the patient in the app</label>
          <template v-if="line.remind">
            <div class="row" style="gap: 6px; flex-wrap: wrap">
              <button v-for="[l, t] in PRESETS" :key="l" type="button" class="btn ghost sm" @click="line.times = [...t]">{{ l }}</button>
            </div>
            <div class="row" style="gap: 6px; flex-wrap: wrap; margin-top: 8px; align-items: center">
              <span v-for="(t, k) in line.times" :key="k" class="time-pill"><input v-model="line.times[k]" type="time" required /><button v-if="line.times.length > 1" type="button" @click="line.times.splice(k, 1)">✕</button></span>
              <button v-if="line.times.length < 6" type="button" class="btn ghost sm" @click="line.times.push('12:00')">+ time</button>
              <span class="note" style="margin-left: 8px">for</span>
              <input v-model.number="line.days" type="number" min="1" max="365" style="width: 70px" /><span class="note">days (empty = until they stop it)</span>
            </div>
          </template>
        </div>
      </div>
      <button type="button" class="btn ghost sm" style="margin-top: 8px" @click="form.items.push(blankLine())">+ Add product</button>

      <label>Note to patient</label>
      <textarea v-model="form.note" rows="2" placeholder="Care advice, follow-up…"></textarea>

      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button type="button" class="btn ghost" @click="form = null">Cancel</button>
        <button class="btn gold">Send to patient</button>
      </div>
    </form>
  </div>

  <div v-if="view" class="modal-bg" @click.self="view = null">
    <div class="modal">
      <div class="receipt">
        <img src="/img/logo-white.png" alt="Lavish" class="rlogo" />
        <hr />
        <p><b>Prescription</b> Rx-{{ view.id }}<br /><span class="note">{{ day(view.created_at) }}</span></p>
        <p>Patient: <b>{{ view.client?.name }}</b></p>
        <p v-for="i in view.items" :key="i.id">• {{ itemName(i) }} ×{{ i.quantity }}<br /><span class="note">{{ i.instructions }}</span><template v-if="i.reminder"><br /><span class="note">{{ reminderText(i.reminder) }}</span></template></p>
        <p v-if="view.note" class="note">{{ view.note }}</p>
        <hr />
        <p class="note">Prescribed by {{ view.doctor?.name }}</p>
      </div>
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button class="btn ghost" @click="view = null">Close</button>
        <button class="btn gold" @click="print">🖨 Print</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rx-remind { flex-basis: 100%; padding: 6px 0 4px; }
.rx-remind .chk { display: flex; gap: 8px; align-items: center; margin: 2px 0 8px; color: var(--ink); }
.rx-remind .chk input { width: auto; }
.time-pill { display: inline-flex; align-items: center; gap: 2px; border: 1px solid var(--line); border-radius: 99px; padding: 2px 4px 2px 8px; background: #fff; }
.time-pill input { border: 0; padding: 4px; width: 104px; }
.time-pill button { border: 0; background: none; color: var(--muted); cursor: pointer; }
</style>
