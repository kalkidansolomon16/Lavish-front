<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { state, actions, doctorName, clientName, etb } from '../store'
import { pushNotif } from '../ui'
import ClientLink from '../components/ClientLink.vue'

const route = useRoute()
const role = state.user.role
const isDoctor = role === 'doctor'
const docId = state.user.doctorId

const rows = computed(() => state.prescriptions.filter((r) => !isDoctor || r.doctorId === docId))
const myClients = computed(() => state.clients.filter((c) => c.doctorId === docId))
const productOf = (id) => state.products.find((p) => p.id === id)
const total = (rx) => rx.items.reduce((t, i) => t + (productOf(i.productId)?.price ?? 0) * i.qty, 0)

const blankLine = () => ({ productId: state.products.find((p) => p.stock > 0)?.id, qty: 1, instructions: '' })
const blank = () => ({ clientId: +route.query.client || myClients.value[0]?.id, items: [blankLine()], note: '' })
const form = ref(blank())
const open = ref(!!route.query.client && isDoctor)
const view = ref(null)
const print = () => window.print()

const formTotal = computed(() => form.value.items.reduce((t, i) => t + (productOf(i.productId)?.price ?? 0) * i.qty, 0))

function save() {
  const rx = { clientId: form.value.clientId, doctorId: docId, note: form.value.note, items: form.value.items.filter((i) => i.productId).map((i) => ({ ...i, qty: +i.qty || 1 })) }
  if (!rx.items.length) return
  actions.addPrescription(rx)
  pushNotif(`${state.user.name} prescribed ${rx.items.length} product(s) for ${clientName(rx.clientId)}`, ['ecommerce', 'ceo'], '/prescriptions')
  open.value = false
  form.value = blank()
}
</script>

<template>
  <div class="head">
    <div>
      <h1>Prescriptions</h1>
      <p v-if="isDoctor">Prescribe products from the Lavish catalogue. The client sees it instantly in the mobile app.</p>
      <p v-else>Products prescribed by doctors. Turn a prescription into an order for delivery.</p>
    </div>
    <button v-if="isDoctor" class="btn gold" @click="open = true">+ New prescription</button>
  </div>

  <div class="grid">
    <div v-for="r in rows" :key="r.id" class="card">
      <div class="row" style="justify-content: space-between">
        <div>
          <h2><ClientLink :id="r.clientId" /></h2>
          <p class="note">{{ doctorName(r.doctorId) }} · {{ r.date }}</p>
        </div>
        <div class="row">
          <span class="badge" :class="r.status === 'ordered' ? 'delivered' : 'pending'">{{ r.status === 'ordered' ? 'Order created' : 'Sent to client' }}</span>
          <span class="serif" style="font-size: 22px">{{ etb(total(r)) }}</span>
        </div>
      </div>
      <table style="margin-top: 10px">
        <tbody>
          <tr v-for="i in r.items" :key="i.productId">
            <td>{{ productOf(i.productId)?.name }} <b>×{{ i.qty }}</b></td>
            <td class="note">{{ i.instructions || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="r.note" class="note" style="margin-top: 8px">“{{ r.note }}”</p>
      <div class="row" style="margin-top: 12px">
        <button class="btn ghost sm" @click="view = r">View / print</button>
        <button v-if="!isDoctor && r.status === 'sent'" class="btn gold sm" @click="actions.fulfillPrescription(r)">Create order</button>
      </div>
    </div>
    <p v-if="!rows.length" class="empty card">No prescriptions yet</p>
  </div>

  <div v-if="open" class="modal-bg" @click.self="open = false">
    <form class="modal" style="width: min(620px, 94vw); max-height: 90vh; overflow: auto" @submit.prevent="save">
      <h2>New prescription</h2>
      <label>Patient</label>
      <select v-model.number="form.clientId">
        <option v-for="c in myClients" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>

      <label>Products</label>
      <div v-for="(line, i) in form.items" :key="i" class="rx-line">
        <select v-model.number="line.productId">
          <option v-for="p in state.products" :key="p.id" :value="p.id" :disabled="p.stock === 0">{{ p.name }} — {{ etb(p.price) }}{{ p.stock === 0 ? ' (out of stock)' : '' }}</option>
        </select>
        <input v-model.number="line.qty" type="number" min="1" style="width: 70px" />
        <input v-model="line.instructions" placeholder="Dosage / how to use" />
        <button type="button" class="btn danger sm" :disabled="form.items.length === 1" @click="form.items.splice(i, 1)">✕</button>
      </div>
      <button type="button" class="btn ghost sm" style="margin-top: 8px" @click="form.items.push(blankLine())">+ Add product</button>

      <label>Note to patient</label>
      <textarea v-model="form.note" rows="2" placeholder="Care advice, follow-up…"></textarea>

      <div class="row" style="margin-top: 18px; justify-content: space-between">
        <span class="serif" style="font-size: 22px">Total {{ etb(formTotal) }}</span>
        <div class="row">
          <button type="button" class="btn ghost" @click="open = false">Cancel</button>
          <button class="btn gold">Send to patient</button>
        </div>
      </div>
    </form>
  </div>

  <div v-if="view" class="modal-bg" @click.self="view = null">
    <div class="modal">
      <div class="receipt">
        <img src="/img/logo-white.png" alt="Lavish" class="rlogo" />
        <hr />
        <p><b>Prescription</b> Rx-{{ view.id }}<br /><span class="note">{{ view.date }}</span></p>
        <p>Patient: <b>{{ clientName(view.clientId) }}</b></p>
        <p v-for="i in view.items" :key="i.productId">
          • {{ productOf(i.productId)?.name }} ×{{ i.qty }}<br /><span class="note">{{ i.instructions }}</span>
        </p>
        <p v-if="view.note" class="note">{{ view.note }}</p>
        <hr />
        <p class="note">Prescribed by {{ doctorName(view.doctorId) }}</p>
      </div>
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button class="btn ghost" @click="view = null">Close</button>
        <button class="btn gold" @click="print">🖨 Print</button>
      </div>
    </div>
  </div>
</template>
