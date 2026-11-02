<script setup>
import ClientLink from '../components/ClientLink.vue'
import { state, actions, clientName } from '../store'
</script>

<template>
  <div class="head">
    <div>
      <h1>Complaints</h1>
      <p>Submitted by clients from the mobile app. The General Manager tracks each one to resolution.</p>
    </div>
  </div>
  <div class="grid">
    <div v-for="c in state.complaints" :key="c.id" class="card">
      <div class="row" style="justify-content: space-between">
        <h2>{{ c.subject }}</h2>
        <div class="row">
          <span class="badge" :class="c.priority">{{ c.priority }} priority</span>
          <span class="badge" :class="c.status">{{ c.status }}</span>
        </div>
      </div>
      <p class="note"><ClientLink :id="c.clientId" /> · {{ c.date }}</p>
      <p style="margin: 10px 0">{{ c.message }}</p>
      <label>Response to client</label>
      <input v-model="c.reply" placeholder="Write a reply…" />
      <div class="row" style="margin-top: 12px">
        <button class="btn ghost sm" :disabled="c.status === 'in-review'" @click="actions.updateComplaint(c, 'in-review')">Mark in review</button>
        <button class="btn gold sm" :disabled="c.status === 'resolved'" @click="actions.updateComplaint(c, 'resolved')">Resolve</button>
      </div>
    </div>
  </div>
</template>
