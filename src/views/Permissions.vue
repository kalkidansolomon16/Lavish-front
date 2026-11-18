<script setup>
// Role × permission matrix — GET /staff/permissions. The server decides what each person may change:
// only roles below you, and only permissions you hold yourself. The CEO row is fixed at full access.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'

const auth = useAuth()
const m = ref(null)
const error = ref('')
const myRoles = computed(() => auth.user?.roles?.map((r) => r.key) ?? [])
onMounted(async () => {
  try {
    m.value = (await api.get('/staff/permissions')).data
  } catch (e) {
    error.value = e.message
  }
})

const has = (r, k) => r.granted.includes(k)
const editable = (r, k) => r.editable.includes(k)
const applies = (p, r) => !p.only || p.only.includes(r.key)
const anyEditable = computed(() => m.value?.roles.some((r) => r.editable.length))
function why(r, p) {
  if (!applies(p, r)) return 'Not used by this role'
  if (editable(r, p.key)) return ''
  if (myRoles.value.includes(r.key)) return 'Your own role — ask someone above you'
  if (r.level <= (auth.user?.level ?? 0)) return 'Higher in the hierarchy than you'
  return 'You don’t have this permission, so you can’t grant it'
}
async function toggle(r, p, e) {
  const on = e.target.checked
  if (!(await ask({ title: on ? 'Grant this permission?' : 'Remove this permission?', body: `${r.label}: ${p.label}\nApplies the next time they open a page.`, ok: on ? 'Grant' : 'Remove', tone: on ? 'primary' : 'danger' }))) { e.target.checked = !on; return }
  try {
    m.value = (await api.put(`/staff/permissions/${r.key}/${p.key}`, { granted: on })).data
  } catch (err) {
    e.target.checked = !on
    notify(err.message)
  }
}
async function reset() {
  if (!(await ask({ title: 'Reset all permissions?', body: 'Every role you manage goes back to the default permissions. Your custom changes are lost.', ok: 'Reset to defaults', tone: 'danger' }))) return
  try {
    const res = await api.post('/staff/permissions/reset')
    m.value = res.data
    notify(res.message)
  } catch (e) {
    notify(e.message)
  }
}
</script>

<template>
  <div class="head">
    <div>
      <h1>Permissions</h1>
      <p>Choose what each portal can see and do. You can only change roles below you
        (CEO → General Manager → Reception, E-commerce, Doctor, Nurse, Lavish Academy), and only grant permissions you hold yourself. Each page has its own “view” permission plus separate add, edit and delete permissions.
        Changes apply the next time that person opens a page.</p>
    </div>
    <button v-if="anyEditable" class="btn ghost" @click="reset">Reset to defaults</button>
  </div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>

  <div v-if="m" class="card" style="overflow-x: auto">
    <table class="perm-table">
      <thead>
        <tr>
          <th>Permission</th>
          <th v-for="r in m.roles" :key="r.key" :class="{ mine: myRoles.includes(r.key) }">{{ r.label }}<small>{{ r.granted.length }} granted{{ myRoles.includes(r.key) ? ' · you' : '' }}</small></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="g in m.groups" :key="g.group">
          <tr class="grp"><td :colspan="m.roles.length + 1">{{ g.group }}</td></tr>
          <tr v-for="p in g.items" :key="p.key">
            <td>{{ p.label }}</td>
            <td v-for="r in m.roles" :key="r.key" class="cell" :class="{ mine: myRoles.includes(r.key) }" :title="why(r, p)">
              <span v-if="!applies(p, r)" class="note">—</span>
              <input v-else-if="editable(r, p.key)" type="checkbox" :checked="has(r, p.key)" @change="toggle(r, p, $event)" />
              <span v-else :class="has(r, p.key) ? 'on' : 'off'">{{ has(r, p.key) ? '✓' : '·' }}</span>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <p class="note" style="margin-top: 12px">Checkbox = you can change it · ✓ / · = granted / not granted (locked for you; hover to see why) · — = doesn’t apply to that role.</p>
  </div>
</template>
