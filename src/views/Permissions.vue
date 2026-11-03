<script setup>
// Role × permission matrix. Follows the hierarchy: you can only change roles below you,
// and only grant what you hold yourself. The CEO row is fixed at full access.
import { computed } from 'vue'
import { state, ROLES, can, canGrant, setPerm, resetPerms, rolePerms } from '../store'
import { PERMISSIONS, LEVEL, applies } from '../permissions'

const me = state.user.role
const roles = Object.keys(ROLES).sort((a, b) => LEVEL[a] - LEVEL[b])
const editable = computed(() => roles.filter((r) => LEVEL[r] > LEVEL[me]))
const has = (r, k) => rolePerms[r]?.includes(k)
const count = (r) => rolePerms[r]?.length ?? 0
function why(r, k) {
  if (!applies(k, r)) return 'Not used by this role'
  if (LEVEL[r] <= LEVEL[me]) return r === me ? 'Your own role — ask someone above you' : 'Higher in the hierarchy than you'
  if (!can(k)) return 'You don’t have this permission, so you can’t grant it'
  return ''
}
</script>

<template>
  <div class="head">
    <div>
      <h1>Permissions</h1>
      <p>Choose what each portal can see and do. You can only change roles below you
        (CEO → General Manager → Reception, E-commerce, Doctor, Lavish Academy), and only grant permissions you hold yourself.
        Changes apply the next time that person opens a page.</p>
    </div>
    <button v-if="editable.length" class="btn ghost" @click="resetPerms">Reset to defaults</button>
  </div>

  <div class="card" style="overflow-x: auto">
    <table class="perm-table">
      <thead>
        <tr>
          <th>Permission</th>
          <th v-for="r in roles" :key="r" :class="{ mine: r === me }">
            {{ ROLES[r].label }}<small>{{ count(r) }} granted{{ r === me ? ' · you' : '' }}</small>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="g in PERMISSIONS" :key="g.group">
          <tr class="grp"><td :colspan="roles.length + 1">{{ g.group }}</td></tr>
          <tr v-for="p in g.items" :key="p.key">
            <td>{{ p.label }}</td>
            <td v-for="r in roles" :key="r" class="cell" :class="{ mine: r === me }" :title="why(r, p.key)">
              <span v-if="!applies(p.key, r)" class="note">—</span>
              <input v-else-if="canGrant(r, p.key)" type="checkbox" :checked="has(r, p.key)" @change="setPerm(r, p.key, $event.target.checked)" />
              <span v-else :class="has(r, p.key) ? 'on' : 'off'">{{ has(r, p.key) ? '✓' : '·' }}</span>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <p class="note" style="margin-top: 12px">Checkbox = you can change it · ✓ / · = granted / not granted (locked for you; hover to see why) · — = doesn’t apply to that role.</p>
  </div>
</template>
