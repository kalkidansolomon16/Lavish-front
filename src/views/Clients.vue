<script setup>
import ClientLink from '../components/ClientLink.vue'
import { computed } from 'vue'
import { state, doctorName } from '../store'

const rows = computed(() =>
  state.clients.filter((c) => state.user.role !== 'doctor' || c.doctorId === state.user.doctorId),
)
</script>

<template>
  <div class="head">
    <div>
      <h1>{{ state.user.role === 'doctor' ? 'My clients' : 'Clients' }}</h1>
      <p>Clients registered through the mobile app.</p>
    </div>
  </div>
  <div class="card">
    <table>
      <thead><tr><th>Name</th><th>Phone</th><th>Doctor</th><th>Last treatment</th><th>Chat</th></tr></thead>
      <tbody>
        <tr v-for="c in rows" :key="c.id">
          <td><ClientLink :id="c.id" /><small>Joined {{ c.joined }}</small></td>
          <td>{{ c.phone }}</td>
          <td>{{ doctorName(c.doctorId) }}</td>
          <td>{{ c.lastTreatment }}</td>
          <td><span class="badge" :class="c.treated ? 'active' : 'pending'">{{ c.treated ? 'Unlocked' : 'After 1st treatment' }}</span></td>
        </tr>
        <tr v-if="!rows.length"><td colspan="5" class="empty">No clients yet</td></tr>
      </tbody>
    </table>
  </div>
</template>
