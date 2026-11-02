<script setup>
import { state, actions, courseTitle, etb } from '../store'
</script>

<template>
  <div class="head">
    <div>
      <h1>Lavish Academy</h1>
      <p>Students register in the mobile app and take their courses with the CTO.</p>
    </div>
  </div>

  <div class="grid g4" style="margin-bottom: 20px">
    <div v-for="c in state.courses" :key="c.id" class="card">
      <h2>{{ c.title }}</h2>
      <p class="note">{{ c.weeks }} weeks · {{ etb(c.price) }}</p>
    </div>
  </div>

  <div class="card">
    <h2 style="margin-bottom: 10px">Students</h2>
    <table>
      <thead><tr><th>Student</th><th>Course</th><th>Progress</th><th>Message</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="s in state.students" :key="s.id">
          <td>{{ s.name }}</td>
          <td>{{ courseTitle(s.courseId) }}</td>
          <td style="width: 150px">
            <div style="background: var(--line); border-radius: 9px; height: 7px">
              <div :style="{ width: s.progress + '%', background: 'var(--gold)', height: '7px', borderRadius: '9px' }"></div>
            </div>
            <small>{{ s.progress }}%</small>
          </td>
          <td>{{ s.msg || '—' }}</td>
          <td><span class="badge" :class="s.status">{{ s.status }}</span></td>
          <td class="row">
            <template v-if="s.status === 'pending'">
              <button class="btn gold sm" @click="actions.decideStudent(s, true)">Enrol</button>
              <button class="btn danger sm" @click="actions.decideStudent(s, false)">Decline</button>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
