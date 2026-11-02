<script setup>
// Reception books a client who walks in or calls: client → intake questions → slot → SMS + app invite.
import { ref, computed } from 'vue'
import { state, actions, suggestDoctors, etb } from '../store'
import { pushNotif } from '../ui'

const emit = defineEmits(['close'])
const PRICES = { 'Signature HydraFacial': 4500, 'PRP Skin Rejuvenation': 9000, 'Morpheus8 & Microneedling': 12000, 'Advanced Dermatology Treatments': 3500, 'Botox & Dermal Fillers': 18500, 'HIFU Face & Neck Lift': 15000, 'Hair Restoration Solutions': 45000, 'Body Contouring & Skin Tightening': 20000 }
const TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00']
const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10)

const step = ref(1)
const mode = ref('new')
const q = ref('')
const clientId = ref(null)
const client = ref({ name: '', phone: '+251 ', gender: 'Female' })
const h = ref({ source: 'Walk-in', concern: '', skinType: 'Normal', allergies: '', medications: '', conditions: '', previous: '', pregnant: 'No' })
const appt = ref({ service: 'Signature HydraFacial', date: tomorrow, time: '10:00', doctorId: null })
const sms = ref(true)
const invite = ref(true)

const matches = computed(() => (q.value.length < 2 ? [] : state.clients.filter((c) => (c.name + c.phone).toLowerCase().includes(q.value.toLowerCase())).slice(0, 5)))
const picked = computed(() => state.clients.find((c) => c.id === clientId.value))
const phone = computed(() => picked.value?.phone ?? client.value.phone)
const name = computed(() => picked.value?.name ?? client.value.name)
const ranked = computed(() => suggestDoctors({ clientId: clientId.value, service: appt.value.service, date: appt.value.date, time: appt.value.time }).filter((r) => r.doctor.access === 'active'))
const doctor = computed(() => state.doctors.find((d) => d.id === (appt.value.doctorId ?? ranked.value[0]?.doctor.id)))
const okStep1 = computed(() => (mode.value === 'existing' ? !!picked.value : client.value.name.trim() && client.value.phone.trim().length > 8))
const message = computed(() =>
  `Lavish Medical Spa: Hi ${name.value.split(' ')[0]}, your ${appt.value.service} with ${doctor.value?.name} is booked for ${appt.value.date} at ${appt.value.time}.` +
  (invite.value ? ' Get the Lavish app to manage bookings & chat with your doctor: lavish.et/app' : ''))

function pick(c) {
  clientId.value = c.id
  q.value = c.name
  if (c.history) h.value = { ...h.value, ...c.history }
}
function book() {
  const { a } = actions.walkIn({
    clientId: mode.value === 'existing' ? clientId.value : null,
    client: client.value, history: h.value, sms: sms.value, invite: invite.value,
    appt: { ...appt.value, doctorId: doctor.value.id, price: PRICES[appt.value.service] },
  })
  pushNotif(`${name.value} — ${a.service} on ${a.date} ${a.time} was booked at reception`, ['doctor'], '/appointments', a.doctorId)
  emit('close')
}
</script>

<template>
  <div class="modal-bg" @click.self="emit('close')">
    <div class="modal" style="width: min(640px, 95vw); max-height: 92vh; overflow: auto">
      <h2>Walk-in / phone booking</h2>
      <p class="note">Step {{ step }} of 4 · {{ ['Client', 'Client history', 'Choose a slot', 'Confirm & send SMS'][step - 1] }}</p>
      <div class="steps-bar"><span v-for="i in 4" :key="i" :class="{ on: i <= step }"></span></div>

      <template v-if="step === 1">
        <div class="tabs">
          <button :class="{ on: mode === 'new' }" @click="mode = 'new'">New client (first visit)</button>
          <button :class="{ on: mode === 'existing' }" @click="mode = 'existing'">Existing client</button>
        </div>
        <template v-if="mode === 'new'">
          <label>Full name</label><input v-model="client.name" placeholder="e.g. Almaz Tesfaye" />
          <div class="qgrid">
            <div><label>Phone (the slot is sent here)</label><input v-model="client.phone" /></div>
            <div><label>Gender</label><select v-model="client.gender"><option>Female</option><option>Male</option></select></div>
          </div>
          <label>How did they reach us?</label>
          <select v-model="h.source"><option>Walk-in</option><option>Phone call</option><option>Referral</option></select>
        </template>
        <template v-else>
          <label>Search by name or phone</label><input v-model="q" placeholder="Type at least 2 letters…" />
          <button v-for="c in matches" :key="c.id" class="pay-opt" style="width: 100%; margin-top: 8px; text-align: left" :class="{ on: clientId === c.id }" @click="pick(c)">
            <b>{{ c.name }}</b> <small class="note">{{ c.phone }} · {{ c.history ? 'history on file' : 'no history yet' }}</small>
          </button>
        </template>
      </template>

      <template v-else-if="step === 2">
        <p class="note">Ask the client these questions. Their doctor sees the answers before the session.</p>
        <label>Main concern / reason for visit</label><textarea v-model="h.concern" rows="2" placeholder="e.g. Dark spots on cheeks"></textarea>
        <div class="qgrid">
          <div><label>Skin type</label><select v-model="h.skinType"><option>Normal</option><option>Dry</option><option>Oily</option><option>Combination</option><option>Sensitive</option></select></div>
          <div><label>Pregnant or breastfeeding?</label><select v-model="h.pregnant"><option>No</option><option>Yes</option><option>Not applicable</option></select></div>
          <div><label>Allergies</label><input v-model="h.allergies" placeholder="Medicines, products, latex…" /></div>
          <div><label>Current medications</label><input v-model="h.medications" placeholder="Incl. creams & supplements" /></div>
          <div><label>Medical conditions</label><input v-model="h.conditions" placeholder="Diabetes, heart, skin disease…" /></div>
          <div><label>Previous aesthetic treatments</label><input v-model="h.previous" placeholder="What & when" /></div>
        </div>
      </template>

      <template v-else-if="step === 3">
        <label>Treatment</label>
        <select v-model="appt.service"><option v-for="(p, s) in PRICES" :key="s" :value="s">{{ s }} — {{ etb(p) }}</option></select>
        <div class="qgrid">
          <div><label>Date</label><input v-model="appt.date" type="date" /></div>
          <div><label>Time</label><select v-model="appt.time"><option v-for="t in TIMES" :key="t">{{ t }}</option></select></div>
        </div>
        <label>Doctor</label>
        <select v-model="appt.doctorId">
          <option :value="null">✨ Best match — {{ ranked[0]?.doctor.name }}</option>
          <option v-for="r in ranked" :key="r.doctor.id" :value="r.doctor.id" :disabled="!r.available">{{ r.doctor.name }} · {{ r.doctor.specialty }}{{ r.available ? '' : ' (unavailable)' }}</option>
        </select>
      </template>

      <template v-else>
        <div class="card" style="background: var(--bg)">
          <b>{{ name }}</b> · {{ phone }}<br />
          <span class="note">{{ appt.service }} · {{ appt.date }} {{ appt.time }} · {{ doctor?.name }} · {{ etb(PRICES[appt.service]) }}</span>
        </div>
        <label class="row" style="color: var(--ink); margin-top: 14px"><input v-model="sms" type="checkbox" style="width: auto" /> Send the slot to the client by SMS</label>
        <label class="row" style="color: var(--ink)"><input v-model="invite" type="checkbox" style="width: auto" /> Include the Lavish app download link</label>
        <div v-if="sms" class="card" style="margin-top: 12px; border-left: 4px solid var(--gold)">
          <small class="note">SMS preview → {{ phone }}</small>
          <p style="margin-top: 4px">{{ message }}</p>
        </div>
        <p class="note" style="margin-top: 12px">💡 Offer to help them install the app and register now — mark them as registered from the Clients page.</p>
      </template>

      <div class="row" style="margin-top: 20px; justify-content: space-between">
        <button class="btn ghost" @click="step > 1 ? step-- : emit('close')">{{ step > 1 ? 'Back' : 'Cancel' }}</button>
        <button v-if="step < 4" class="btn gold" :disabled="step === 1 && !okStep1" @click="step++">Next</button>
        <button v-else class="btn gold" @click="book">Book{{ sms ? ' & send SMS' : '' }}</button>
      </div>
    </div>
  </div>
</template>
