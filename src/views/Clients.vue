<script setup>
import ClientLink from '../components/ClientLink.vue'
import { computed } from 'vue'
import { state, actions, doctorName, can } from '../store'
import { ui } from '../ui'

const role = state.user.role
const isDoctor = role === 'doctor'
const rows = computed(() => state.clients.filter((c) => !isDoctor || c.doctorId === state.user.doctorId))
</script>

<template>
  <div class="head">
    <div>
      <h1>{{ isDoctor ? 'My patients' : 'Clients' }}</h1>
      <p v-if="isDoctor">Your patients and the history reception recorded for them. Click a name to open the full profile.</p>
      <p v-else>Clients from the mobile app and walk-ins. Help walk-in clients download the app and register.</p>
    </div>
  </div>
  <div class="card">
    <table>
      <thead><tr><th>Name</th><th>Phone</th><th>Doctor</th><th>History</th><th>Last treatment</th><th v-if="!isDoctor">Mobile app</th></tr></thead>
      <tbody>
        <tr v-for="c in rows" :key="c.id">
          <td><ClientLink :id="c.id" /><small>Joined {{ c.joined }}</small></td>
          <td>{{ c.phone }}</td>
          <td>{{ doctorName(c.doctorId) }}</td>
          <td>
            <a v-if="c.history" class="link" @click="ui.drawerClient = c.id">{{ c.history.concern || 'On file' }}</a>
            <button v-else-if="can('clients.history')" class="btn ghost sm" @click="ui.drawerClient = c.id">+ Record history</button>
            <span v-else class="note">Not recorded</span>
            <small v-if="c.history">{{ c.history.source }} · by {{ c.history.recordedBy }}</small>
          </td>
          <td>{{ c.lastTreatment }}</td>
          <td v-if="!isDoctor">
            <span v-if="c.app" class="badge active">Registered</span>
            <div v-else-if="can('clients.invite')" class="row">
              <button class="btn ghost sm" @click="actions.sendAppInvite(c)">{{ c.invited ? 'Resend link' : 'Send app link' }}</button>
              <button class="btn gold sm" @click="actions.markRegistered(c)">Helped register ✓</button>
            </div>
          </td>
        </tr>
        <tr v-if="!rows.length"><td colspan="6" class="empty">No clients yet</td></tr>
      </tbody>
    </table>
  </div>
</template>
