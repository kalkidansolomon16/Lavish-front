<script setup>
import { ref, computed } from 'vue'
import { state, notify, clientName, etb } from '../store'
import { ui, exportCsv, pushNotif } from '../ui'
import ClientLink from '../components/ClientLink.vue'

const sum = (st) => state.payments.filter((p) => p.status === st).reduce((t, p) => t + p.amount, 0)
const total = computed(() => sum('paid'))
const due = computed(() => sum('unpaid'))
const awaiting = computed(() => sum('awaiting'))

const CHAPA_METHODS = ['Telebirr', 'CBE Birr', 'M-Pesa', 'Visa / Mastercard']
const collect = ref(null) // payment being collected
const step = ref('choose') // choose | checkout | link | processing
const link = ref('')
const receipt = ref(null)

const open = (p) => { collect.value = p; step.value = 'choose'; link.value = '' }
const close = () => { collect.value = null }

function complete(p, method, viaChapa) {
  if (p.status === 'paid') return
  p.status = 'paid'
  p.method = viaChapa ? `Chapa · ${method}` : method
  p.txRef = viaChapa ? 'CHP-' + Math.random().toString(36).slice(2, 10).toUpperCase() : ''
  ui.revenue.at(-1).value += p.amount
  notify(viaChapa ? `Chapa confirmed ${etb(p.amount)} — ${p.txRef}` : 'Cash payment recorded')
}

function payAtDesk(method) {
  const p = collect.value
  step.value = 'processing'
  setTimeout(() => { complete(p, method, true); close() }, 2200)
}

function sendLink() {
  const p = collect.value
  link.value = `https://checkout.chapa.co/checkout/payment/LV-${p.id}`
  p.status = 'awaiting'
  step.value = 'link'
  // demo: Chapa webhook arrives a few seconds after the client pays in their app
  setTimeout(() => {
    if (p.status !== 'awaiting') return
    complete(p, CHAPA_METHODS[Math.floor(Math.random() * 3)], true)
    pushNotif(`Chapa webhook: ${clientName(p.clientId)} paid ${etb(p.amount)}`, ['reception', 'admin'], '/payments')
  }, 8000)
}

const cash = () => { complete(collect.value, 'Cash', false); close() }
const copy = () => { navigator.clipboard?.writeText(link.value); notify('Payment link copied') }
const print = () => window.print()
const exportAll = () =>
  exportCsv('lavish-payments', state.payments.map((p) => ({ Receipt: 'LV-' + p.id, Client: clientName(p.clientId), For: p.ref, Amount_ETB: p.amount, Method: p.method, Chapa_Ref: p.txRef || '', Status: p.status, Date: p.date })))
</script>

<template>
  <div class="head">
    <div>
      <h1>Payments</h1>
      <p>Collect treatment payments through Chapa (Telebirr, CBE Birr, cards) or record cash at the desk.</p>
    </div>
    <button class="btn ghost" @click="exportAll">⬇ Export CSV</button>
  </div>

  <div class="grid g4" style="margin-bottom: 20px">
    <div class="card stat gold"><div class="n">{{ etb(total) }}</div><div class="l">Collected</div></div>
    <div class="card stat"><div class="n">{{ etb(awaiting) }}</div><div class="l">Awaiting client (Chapa link sent)</div></div>
    <div class="card stat"><div class="n">{{ etb(due) }}</div><div class="l">Not yet requested</div></div>
    <div class="card gateway">
      <span class="live">● connected</span>
      <b class="serif" style="font-size: 22px">Chapa</b>
      <small class="note">Payment gateway · sandbox mode<br />Confirmations arrive automatically via webhook</small>
    </div>
  </div>

  <div class="card">
    <table>
      <thead><tr><th>Client</th><th>For</th><th>Amount</th><th>Method</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="p in state.payments" :key="p.id">
          <td><ClientLink :id="p.clientId" /><small>{{ p.date }}</small></td>
          <td>{{ p.ref }}</td>
          <td>{{ etb(p.amount) }}</td>
          <td>{{ p.status === 'paid' ? p.method : '—' }}<small v-if="p.txRef">Ref {{ p.txRef }}</small></td>
          <td><span class="badge" :class="p.status">{{ p.status === 'awaiting' ? 'awaiting client' : p.status }}</span></td>
          <td class="row">
            <button v-if="p.status === 'unpaid'" class="btn gold sm" @click="open(p)">Collect payment</button>
            <button v-else-if="p.status === 'awaiting'" class="btn ghost sm" @click="open(p)">View link</button>
            <button v-else class="btn ghost sm" @click="receipt = p">Receipt</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-if="collect" class="modal-bg" @click.self="step !== 'processing' && close()">
    <div class="modal" style="width: min(520px, 94vw)">
      <h2>Collect payment</h2>
      <p class="note">{{ clientName(collect.clientId) }} · {{ collect.ref }}</p>
      <p class="serif" style="font-size: 36px; margin: 8px 0 16px">{{ etb(collect.amount) }}</p>

      <template v-if="step === 'choose'">
        <button class="pay-opt chapa" @click="sendLink">
          <b>📲 Send Chapa payment link</b><span>Client pays from their phone (mobile app or SMS link). Confirms automatically.</span>
        </button>
        <button class="pay-opt chapa" @click="step = 'checkout'">
          <b>💳 Chapa checkout at the desk</b><span>Client chooses Telebirr, CBE Birr, M-Pesa or card on this screen.</span>
        </button>
        <button class="pay-opt" @click="cash">
          <b>💵 Cash received</b><span>Record a cash payment taken at reception.</span>
        </button>
      </template>

      <template v-else-if="step === 'checkout'">
        <p class="note" style="margin-bottom: 8px">Client selects a payment method (Chapa secure checkout)</p>
        <div class="methods">
          <button v-for="m in CHAPA_METHODS" :key="m" @click="payAtDesk(m)">{{ m }}</button>
        </div>
        <button class="btn ghost sm" style="margin-top: 14px" @click="step = 'choose'">← Back</button>
      </template>

      <template v-else-if="step === 'processing'">
        <div class="processing"><div class="spinner"></div><p>Waiting for Chapa to confirm…</p></div>
      </template>

      <template v-else>
        <div class="linkbox">
          <small class="note">Payment link sent to the client's phone and mobile app</small>
          <code>{{ link }}</code>
          <div class="row" style="margin-top: 8px"><button class="btn ghost sm" @click="copy">Copy link</button></div>
        </div>
        <p class="note" style="margin: 14px 0"><span class="live">●</span> Waiting for the client to pay… this page updates automatically when Chapa sends the confirmation.</p>
        <div class="row" style="justify-content: flex-end"><button class="btn ghost" @click="close">Close</button></div>
      </template>
    </div>
  </div>

  <div v-if="receipt" class="modal-bg" @click.self="receipt = null">
    <div class="modal">
      <div class="receipt">
        <img src="/img/logo-white.png" alt="Lavish" class="rlogo" />
        <p class="note" style="text-align: center">Ultra Luxury in Science and Beauty</p>
        <hr />
        <p><b>Receipt</b> LV-{{ receipt.id }}<br /><span class="note">{{ receipt.date }}</span></p>
        <p>Client: <b>{{ clientName(receipt.clientId) }}</b></p>
        <p>{{ receipt.ref }}</p>
        <p class="serif" style="font-size: 30px">{{ etb(receipt.amount) }}</p>
        <p class="note">Paid via {{ receipt.method }}<span v-if="receipt.txRef"> · Ref {{ receipt.txRef }}</span></p>
        <p style="text-align: center; margin-top: 16px" class="note">Thank you for choosing Lavish ✿</p>
      </div>
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button class="btn ghost" @click="receipt = null">Close</button>
        <button class="btn gold" @click="print">🖨 Print receipt</button>
      </div>
    </div>
  </div>
</template>
