<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { state, doctorName, etb } from '../store'
import { ui } from '../ui'

const router = useRouter()
const c = computed(() => state.clients.find((x) => x.id === ui.drawerClient))
const mine = (list) => list.filter((x) => x.clientId === ui.drawerClient)
const spent = computed(() => mine(state.payments).filter((p) => p.status === 'paid').reduce((t, p) => t + p.amount, 0))
const initials = computed(() => c.value.name.split(' ').map((w) => w[0]).join(''))
const rxs = computed(() => state.prescriptions.filter((r) => r.clientId === ui.drawerClient))
const prescribe = () => { const id = ui.drawerClient; ui.drawerClient = null; router.push({ path: '/prescriptions', query: { client: id } }) }
const chat = () => { ui.drawerClient = null; router.push('/chat') }
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
          <div class="card stat gold"><div class="n" style="font-size: 26px">{{ etb(spent) }}</div><div class="l">Lifetime spend</div></div>
        </div>

        <h3>Treatment timeline</h3>
        <ul class="timeline">
          <li v-for="a in mine(state.appointments)" :key="a.id">
            <b>{{ a.service }}</b><small>{{ a.date }} · {{ a.time }} · {{ a.status }}</small>
          </li>
          <li v-if="!mine(state.appointments).length"><small>No visits yet</small></li>
        </ul>

        <h3>Orders & payments</h3>
        <ul class="timeline">
          <li v-for="p in mine(state.payments)" :key="'p' + p.id"><b>{{ p.ref }} — {{ etb(p.amount) }}</b><small>{{ p.method }} · {{ p.status }}</small></li>
          <li v-for="o in mine(state.orders)" :key="'o' + o.id"><b>Order #{{ o.id }} — {{ etb(o.total) }}</b><small>{{ o.status }}</small></li>
        </ul>

        <h3>Prescriptions</h3>
        <ul class="timeline">
          <li v-for="r in rxs" :key="r.id"><b>{{ r.items.length }} product(s) — {{ r.status }}</b><small>{{ r.date }} · {{ doctorName(r.doctorId) }}</small></li>
          <li v-if="!rxs.length"><small>None yet</small></li>
        </ul>

        <h3>Private notes</h3>
        <textarea v-model="c.note" rows="3" placeholder="Allergies, preferences, follow-up reminders…"></textarea>
        <div class="row" style="margin-top: 14px">
          <button v-if="state.user.role === 'doctor'" class="btn gold" @click="prescribe">+ Prescribe</button>
          <button v-if="state.user.role === 'doctor' && c.treated" class="btn ghost" @click="chat">Open chat</button>
          <button class="btn ghost" @click="ui.drawerClient = null">Close</button>
        </div>
      </aside>
    </div>
  </Transition>
</template>
