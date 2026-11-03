<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { state, doctorName, etb, can } from '../store'
import { ui } from '../ui'

const router = useRouter()
const c = computed(() => state.clients.find((x) => x.id === ui.drawerClient))
const mine = (list) => list.filter((x) => x.clientId === ui.drawerClient)
const spent = computed(() => mine(state.payments).filter((p) => p.status === 'paid').reduce((t, p) => t + p.amount, 0))
const initials = computed(() => c.value.name.split(' ').map((w) => w[0]).join(''))
const rxs = computed(() => state.prescriptions.filter((r) => r.clientId === ui.drawerClient))
const prescribe = () => { const id = ui.drawerClient; ui.drawerClient = null; router.push({ path: '/prescriptions', query: { client: id } }) }
const chat = () => { ui.drawerClient = null; router.push('/chat') }
const role = state.user.role
const editable = can('clients.history')
const FIELDS = [['concern', 'Main concern'], ['skinType', 'Skin type'], ['allergies', 'Allergies'], ['medications', 'Medications'], ['conditions', 'Medical conditions'], ['previous', 'Previous treatments'], ['pregnant', 'Pregnant / breastfeeding']]
const startHistory = () => (c.value.history = { source: 'Walk-in', concern: '', skinType: 'Normal', allergies: '', medications: '', conditions: '', previous: '', pregnant: 'No', recordedBy: state.user.name, date: new Date().toISOString().slice(0, 10) })
</script>

<template>
  <Transition name="slide">
    <div v-if="c" class="drawer-bg" @click.self="ui.drawerClient = null">
      <aside class="drawer">
        <button class="x" @click="ui.drawerClient = null">✕</button>
        <div class="avatar">{{ initials }}</div>
        <h2>{{ c.name }}</h2>
        <p class="note">{{ c.phone }} · Joined {{ c.joined }}</p>
        <div class="row" style="margin: 12px 0">
          <span class="badge active">{{ doctorName(c.doctorId) }}</span>
          <span class="badge" :class="c.treated ? 'active' : 'pending'">{{ c.treated ? 'Chat unlocked' : 'First visit pending' }}</span>
        </div>
        <div class="grid g4" style="grid-template-columns: 1fr 1fr; margin: 14px 0">
          <div class="card stat"><div class="n">{{ mine(state.appointments).length }}</div><div class="l">Visits</div></div>
          <div v-if="can('finance.revenue')" class="card stat gold"><div class="n" style="font-size: 26px">{{ etb(spent) }}</div><div class="l">Lifetime spend</div></div>
          <div v-else class="card stat gold"><div class="n" style="font-size: 26px">{{ c.app ? 'Yes' : 'No' }}</div><div class="l">On the mobile app</div></div>
        </div>

        <h3>Client history <small v-if="c.history" class="note">{{ c.history.source }} · recorded by {{ c.history.recordedBy }} · {{ c.history.date }}</small></h3>
        <div v-if="c.history" class="card" style="padding: 12px 16px; margin: 8px 0 16px">
          <div v-for="[k, label] in FIELDS" :key="k" class="row" style="justify-content: space-between; padding: 5px 0; flex-wrap: nowrap">
            <small class="note" style="flex-shrink: 0">{{ label }}</small>
            <input v-if="editable" v-model="c.history[k]" style="max-width: 60%; padding: 5px 8px" />
            <span v-else style="text-align: right" :style="{ color: k === 'allergies' && c.history[k] && !/none/i.test(c.history[k]) ? 'var(--bad)' : '' }">{{ c.history[k] || '—' }}</span>
          </div>
        </div>
        <button v-else-if="editable" class="btn ghost sm" style="margin: 8px 0 16px" @click="startHistory">+ Record history</button>
        <p v-else class="note" style="margin: 8px 0 16px">Reception hasn’t recorded a history yet.</p>

        <h3>Treatment timeline</h3>
        <ul class="timeline">
          <li v-for="a in mine(state.appointments)" :key="a.id">
            <b>{{ a.service }}</b><small>{{ a.date }} · {{ a.time }} · {{ a.status }}</small>
          </li>
          <li v-if="!mine(state.appointments).length"><small>No visits yet</small></li>
        </ul>

        <h3 v-if="can('finance.revenue')">Orders & payments</h3>
        <ul v-if="can('finance.revenue')" class="timeline">
          <li v-for="p in mine(state.payments)" :key="'p' + p.id"><b>{{ p.ref }} — {{ etb(p.amount) }}</b><small>{{ p.method }} · {{ p.status }}</small></li>
          <li v-for="o in mine(state.orders)" :key="'o' + o.id"><b>Order #{{ o.id }} — {{ etb(o.total) }}</b><small>{{ o.status }}</small></li>
        </ul>

        <h3>Prescriptions</h3>
        <ul class="timeline">
          <li v-for="r in rxs" :key="r.id"><b>{{ r.items.length }} item(s) — {{ r.status }}</b><small>{{ r.date }} · {{ doctorName(r.doctorId) }}</small></li>
          <li v-if="!rxs.length"><small>None yet</small></li>
        </ul>

        <h3>Private notes</h3>
        <textarea v-model="c.note" rows="3" placeholder="Allergies, preferences, follow-up reminders…"></textarea>
        <div class="row" style="margin-top: 14px">
          <button v-if="can('prescriptions.create')" class="btn gold" @click="prescribe">+ Prescribe</button>
          <button v-if="can('page.chat') && c.treated" class="btn ghost" @click="chat">Open chat</button>
          <button class="btn ghost" @click="ui.drawerClient = null">Close</button>
        </div>
      </aside>
    </div>
  </Transition>
</template>
