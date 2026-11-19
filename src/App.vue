<script setup>
import { ask } from './confirm'
import { onMounted, onBeforeUnmount, watch, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { state } from './store'
import { ui, t } from './ui'
import { useAuth } from './stores/auth'
import { useNotifications } from './stores/notifications'
import { loading, api } from './api/http'
import Topbar from './components/Topbar.vue'
import ClientDrawer from './components/ClientDrawer.vue'
import CommandPalette from './components/CommandPalette.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'

const router = useRouter()
const auth = useAuth()
const notifications = useNotifications()
const inside = computed(() => auth.signedIn && !auth.needsNewPassword)

// "Loading" while page data is on its way, and for a moment after each page change (before its first
// request starts), so empty messages like "No news yet" don't flash before the data arrives.
const switching = ref(false)
let switchTimer
router.beforeEach(() => { switching.value = true; clearTimeout(switchTimer); switchTimer = setTimeout(() => (switching.value = false), 350) })
const busy = computed(() => loading.count > 0 || switching.value)

const out = async () => {
  if (!(await ask({ title: 'Sign out?', body: 'You will need your phone number or email and your password to sign in again.', ok: 'Sign out', tone: 'danger' }))) return
  await auth.logout()
  router.push('/login')
}

// Signed in → start the bell; signed out (also when the token expired) → back to login.
watch(inside, (on) => {
  if (on) notifications.start()
  else { notifications.stop(); router.push('/login') }
}, { immediate: true })

// Clients who finished a treatment and haven't paid: a bar on every page for staff who collect payments,
// so nobody leaves without paying. Checked every minute.
const owing = ref({ count: 0, today: 0, total: 0 })
let owingTimer
async function checkOwing() {
  if (!inside.value || !auth.can('payments.collect')) return (owing.value = { count: 0, today: 0, total: 0 })
  try { owing.value = (await api.get('/staff/payments/owing', {}, { background: true })).meta } catch { /* keep the last value */ }
}
watch(inside, (on) => {
  clearInterval(owingTimer)
  if (on) { checkOwing(); owingTimer = setInterval(checkOwing, 60000) }
}, { immediate: true })
router.afterEach((to) => { if (to.path === '/payments') checkOwing() })

const hotkey = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && inside.value) {
    e.preventDefault()
    ui.palette = !ui.palette
  }
}
onMounted(() => window.addEventListener('keydown', hotkey))
onBeforeUnmount(() => { window.removeEventListener('keydown', hotkey); clearInterval(owingTimer) })
</script>

<template>
  <div v-if="inside" class="shell" :class="{ 'is-loading': busy }">
    <div class="top-progress" :class="{ on: busy }"><i></i></div>
    <aside class="side">
      <div class="brand"><img src="/img/logo-white.png" alt="Lavish Medical Spa" /><small>{{ (auth.portal?.label ?? 'Staff').toUpperCase() }} PORTAL</small></div>
      <nav>
        <RouterLink v-for="n in auth.pages" :key="n" :to="'/' + n">{{ t(n) }}</RouterLink>
      </nav>
      <div class="me">
        <b>{{ auth.user.name }}</b>{{ auth.user.roles.map((r) => r.label).join(' · ') }}
        <br /><button @click="out">Sign out</button>
      </div>
    </aside>
    <main class="main">
      <Topbar />
      <RouterLink v-if="owing.count" to="/payments?tab=owing" class="owing-bar">
        <span class="ic">!</span>
        <span><b>{{ owing.count }} finished treatment{{ owing.count === 1 ? '' : 's' }} / delivered order{{ owing.count === 1 ? '' : 's' }} not paid</b> · ETB {{ Number(owing.total).toLocaleString() }}{{ owing.today ? ` · ${owing.today} today` : '' }} — collect before they leave</span>
        <span class="go">View & collect →</span>
      </RouterLink>
      <RouterView :key="state.user?.id" />
    </main>
    <ClientDrawer />
    <CommandPalette />
  </div>
  <RouterView v-else />
  <div v-if="state.toast" class="toast">{{ state.toast }}</div>
  <ConfirmDialog />
</template>

<style>
.owing-bar { display: flex; align-items: center; gap: 12px; margin: 0 0 16px; padding: 11px 14px; border-radius: 12px; background: #fdf0e6; border: 1px solid #f1cdb0; color: #8a4b12; font-size: 13.5px; text-decoration: none; }
.owing-bar .ic { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: #c86a1e; color: #fff; font-weight: 700; flex: none; }
.owing-bar .go { margin-left: auto; font-weight: 600; white-space: nowrap; }
</style>
