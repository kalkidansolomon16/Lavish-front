<script setup>
import { ask } from './confirm'
import { onMounted, onBeforeUnmount, watch, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { state } from './store'
import { ui, t } from './ui'
import { useAuth } from './stores/auth'
import { useNotifications } from './stores/notifications'
import { loading } from './api/http'
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

const hotkey = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && inside.value) {
    e.preventDefault()
    ui.palette = !ui.palette
  }
}
onMounted(() => window.addEventListener('keydown', hotkey))
onBeforeUnmount(() => window.removeEventListener('keydown', hotkey))
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
      <RouterView :key="state.user?.id" />
    </main>
    <ClientDrawer />
    <CommandPalette />
  </div>
  <RouterView v-else />
  <div v-if="state.toast" class="toast">{{ state.toast }}</div>
  <ConfirmDialog />
</template>
