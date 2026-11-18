<script setup>
// Reception books a client who walks in or calls: client → intake questions → slot → SMS + app invite.
// POST /staff/appointments/walk-in (the booking is approved straight away).
import { ref, computed, watch, onMounted } from 'vue'
import { api } from '../api/http'
import { ask } from '../confirm'
import { notify } from '../store'
import { etb } from '../fmt'
import PhoneInput from './PhoneInput.vue'

const emit = defineEmits(['close', 'booked'])
const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10)

const step = ref(1)
const mode = ref('new')
const q = ref('')
const matches = ref([])
const picked = ref(null)
const client = ref({ name: '', phone: '', gender: 'Female' })
const h = ref({ source: 'Walk-in', concern: '', skin_type: 'Normal', allergies: '', medications: '', conditions: '', previous_treatments: '', pregnant: 'No' })
const services = ref([])
const branches = ref([])
const doctors = ref([])
const slots = ref([])
const appt = ref({ service_id: null, branch_id: null, date: tomorrow, time: '', doctor_id: null })
const sms = ref(true)
const invite = ref(true)
const busy = ref(false)
const error = ref('')

onMounted(async () => {
  const [s, b] = await Promise.all([api.get('/catalog/services', { online: 0 }), api.get('/catalog/branches')])
  services.value = s.data
  branches.value = b.data
  appt.value.service_id = services.value[0]?.id ?? null
  appt.value.branch_id = branches.value.find((x) => x.is_main)?.id ?? branches.value[0]?.id ?? null
})

let t
watch(q, (v) => {
  clearTimeout(t)
  t = setTimeout(async () => { matches.value = v.length < 2 ? [] : (await api.get('/staff/clients', { q: v, per_page: 6 }).catch(() => ({ data: [] }))).data }, 250)
})
function pick(c) {
  picked.value = c
  q.value = c.name
  if (c.history) h.value = { ...h.value, ...Object.fromEntries(Object.entries(c.history).filter(([k]) => k in h.value && c.history[k])) }
}

// Doctors who offer the treatment, then the free times of the chosen doctor on that day.
watch(() => appt.value.service_id, async (id) => {
  if (!id) return
  doctors.value = (await api.get('/catalog/doctors', { service_id: id }).catch(() => ({ data: [] }))).data
  appt.value.doctor_id = doctors.value[0]?.id ?? null
})
watch(() => [appt.value.doctor_id, appt.value.date, appt.value.service_id], async ([doc, date, svc]) => {
  slots.value = []
  if (!doc || !date || !svc) return
  slots.value = (await api.get('/catalog/availability', { service_id: svc, doctor_id: doc, date }).catch(() => ({ data: { slots: [] } }))).data.slots
  if (!slots.value.find((s) => s.time === appt.value.time && s.available)) appt.value.time = slots.value.find((s) => s.available)?.time ?? ''
})

const service = computed(() => services.value.find((s) => s.id === appt.value.service_id))
const doctor = computed(() => doctors.value.find((d) => d.id === appt.value.doctor_id))
const branch = computed(() => branches.value.find((b) => b.id === appt.value.branch_id))
const phone = computed(() => picked.value?.phone ?? client.value.phone)
const name = computed(() => picked.value?.name ?? client.value.name)
const okStep1 = computed(() => (mode.value === 'existing' ? !!picked.value : client.value.name.trim() && client.value.phone.replace(/\D/g, '').length >= 9))
const okStep3 = computed(() => service.value && doctor.value && appt.value.time)
const message = computed(() =>
  `Lavish Medical Spa: Hi ${name.value.split(' ')[0]}, your ${service.value?.name} with ${doctor.value?.name} is booked for ${appt.value.date} at ${appt.value.time}${branch.value ? ' at our ' + branch.value.name + ' branch' : ''}.` +
  (invite.value ? ' Get the Lavish app to manage bookings & chat with your doctor.' : ''))
const SOURCE = { 'Walk-in': 'walk_in', 'Phone call': 'phone_call', Referral: 'referral' }

async function book() {
  if (!(await ask({ title: 'Book this appointment?', body: `${name.value} · ${service.value.name}\n${appt.value.date} at ${appt.value.time} with ${doctor.value.name}${sms.value ? '\nAn SMS confirmation will be sent.' : ''}`, ok: 'Book' }))) return
  busy.value = true
  error.value = ''
  try {
    await api.post('/staff/appointments/walk-in', {
      ...(picked.value ? { client_id: picked.value.id } : { client: { name: client.value.name.trim(), phone: client.value.phone, gender: client.value.gender } }),
      source: SOURCE[h.value.source] ?? 'walk_in',
      history: h.value,
      service_id: appt.value.service_id, doctor_id: appt.value.doctor_id, branch_id: appt.value.branch_id,
      date: appt.value.date, time: appt.value.time, send_sms: sms.value, send_app_invite: invite.value,
    })
    notify(`${name.value} is booked — ${doctor.value.name} was notified`)
    emit('booked')
    emit('close')
  } catch (e) {
    error.value = e.message
    if (e.code === 'slot_taken' || e.code === 'doctor_busy') step.value = 3
  } finally {
    busy.value = false
  }
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
          <button :class="{ on: mode === 'new' }" @click="mode = 'new'; picked = null">New client (first visit)</button>
          <button :class="{ on: mode === 'existing' }" @click="mode = 'existing'">Existing client</button>
        </div>
        <template v-if="mode === 'new'">
          <label>Full name</label><input v-model="client.name" placeholder="e.g. Almaz Tesfaye" />
          <div class="qgrid">
            <div><label>Phone (the slot is sent here)</label><PhoneInput v-model="client.phone" /></div>
            <div><label>Gender</label><select v-model="client.gender"><option>Female</option><option>Male</option></select></div>
          </div>
          <label>How did they reach us?</label>
          <select v-model="h.source"><option>Walk-in</option><option>Phone call</option><option>Referral</option></select>
          <p class="note" style="margin-top: 8px">If this phone number already belongs to a client, the booking is added to their record.</p>
        </template>
        <template v-else>
          <label>Search by name or phone</label><input v-model="q" placeholder="Type at least 2 letters…" />
          <button v-for="c in matches" :key="c.id" class="pay-opt" style="width: 100%; margin-top: 8px; text-align: left" :class="{ on: picked?.id === c.id }" @click="pick(c)">
            <b>{{ c.name }}</b> <small class="note">{{ c.phone }} · {{ c.history ? 'history on file' : 'no history yet' }}</small>
          </button>
          <p v-if="q.length >= 2 && !matches.length" class="note" style="margin-top: 8px">No client found — use “New client”.</p>
        </template>
      </template>

      <template v-else-if="step === 2">
        <p class="note">Ask the client these questions. Their doctor sees the answers before the session.</p>
        <label>Main concern / reason for visit</label><textarea v-model="h.concern" rows="2" placeholder="e.g. Dark spots on cheeks"></textarea>
        <div class="qgrid">
          <div><label>Skin type</label><select v-model="h.skin_type"><option>Normal</option><option>Dry</option><option>Oily</option><option>Combination</option><option>Sensitive</option></select></div>
          <div><label>Pregnant or breastfeeding?</label><select v-model="h.pregnant"><option>No</option><option>Yes</option><option>Not applicable</option></select></div>
          <div><label>Allergies</label><input v-model="h.allergies" placeholder="Medicines, products, latex…" /></div>
          <div><label>Current medications</label><input v-model="h.medications" placeholder="Incl. creams & supplements" /></div>
          <div><label>Medical conditions</label><input v-model="h.conditions" placeholder="Diabetes, heart, skin disease…" /></div>
          <div><label>Previous aesthetic treatments</label><input v-model="h.previous_treatments" placeholder="What & when" /></div>
        </div>
      </template>

      <template v-else-if="step === 3">
        <label>Treatment</label>
        <select v-model.number="appt.service_id"><option v-for="s in services" :key="s.id" :value="s.id">{{ s.name }} — {{ etb(s.price) }} · {{ s.duration_minutes }} min</option></select>
        <div class="qgrid">
          <div><label>Branch</label><select v-model.number="appt.branch_id"><option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option></select></div>
          <div><label>Date</label><input v-model="appt.date" type="date" :min="new Date().toISOString().slice(0, 10)" /></div>
        </div>
        <label>Doctor</label>
        <select v-model.number="appt.doctor_id">
          <option v-for="d in doctors" :key="d.id" :value="d.id">{{ d.name }} · {{ d.specialty }} · {{ d.availability?.label }}</option>
        </select>
        <p v-if="!doctors.length" class="note" style="color: var(--bad)">No doctor offers this treatment yet. Give a doctor access and this treatment in Staff.</p>
        <label>Time</label>
        <div class="slots"><button v-for="s in slots" :key="s.time" type="button" :disabled="!s.available" :class="{ on: appt.time === s.time }" @click="appt.time = s.time">{{ s.time }}</button></div>
        <p v-if="doctor && !slots.some((s) => s.available)" class="note">{{ doctor.name }} has no free time that day — try another date or doctor.</p>
      </template>

      <template v-else>
        <div class="card" style="background: var(--bg)">
          <b>{{ name }}</b> · {{ phone }}<br />
          <span class="note">{{ service?.name }} · {{ appt.date }} {{ appt.time }} · {{ doctor?.name }} · {{ branch?.name }} · {{ etb(service?.price) }}</span>
        </div>
        <label class="row" style="color: var(--ink); margin-top: 14px"><input v-model="sms" type="checkbox" style="width: auto" /> Send the slot to the client by SMS</label>
        <label class="row" style="color: var(--ink)"><input v-model="invite" type="checkbox" style="width: auto" /> Include the Lavish app download link</label>
        <div v-if="sms" class="card" style="margin-top: 12px; border-left: 4px solid var(--gold)">
          <small class="note">SMS preview → {{ phone }}</small>
          <p style="margin-top: 4px">{{ message }}</p>
        </div>
        <p class="note" style="margin-top: 12px">💡 When the client signs up in the app with this phone number, this booking and their history are linked automatically.</p>
      </template>

      <p v-if="error" class="note" style="color: var(--bad); margin-top: 12px">{{ error }}</p>
      <div class="row" style="margin-top: 20px; justify-content: space-between">
        <button class="btn ghost" @click="step > 1 ? step-- : emit('close')">{{ step > 1 ? 'Back' : 'Cancel' }}</button>
        <button v-if="step < 4" class="btn gold" :disabled="(step === 1 && !okStep1) || (step === 3 && !okStep3)" @click="step++">Next</button>
        <button v-else class="btn gold" :disabled="busy" @click="book">{{ busy ? 'Booking…' : 'Book' + (sms ? ' & send SMS' : '') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slots { display: flex; flex-wrap: wrap; gap: 6px; }
.slots button { padding: 7px 12px; border-radius: 9px; border: 1px solid var(--line); background: #fff; cursor: pointer; font-variant-numeric: tabular-nums; }
.slots button.on { border-color: var(--dark); background: var(--dark); color: #fff; }
.slots button:disabled { opacity: .35; text-decoration: line-through; cursor: not-allowed; }
</style>
