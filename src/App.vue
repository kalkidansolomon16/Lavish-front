<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { state, NAV, logout } from './store'
import { ui, t, startLive } from './ui'
import Topbar from './components/Topbar.vue'
import ClientDrawer from './components/ClientDrawer.vue'
import CommandPalette from './components/CommandPalette.vue'

const router = useRouter()
const out = () => { logout(); router.push('/login') }

const hotkey = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && state.user) {
    e.preventDefault()
    ui.palette = !ui.palette
  }
}
onMounted(() => { window.addEventListener('keydown', hotkey); startLive() })
onBeforeUnmount(() => window.removeEventListener('keydown', hotkey))
</script>

<template>
  <div v-if="state.user" class="shell">
    <aside class="side">
      <div class="brand"><img src="/img/logo-white.png" alt="Lavish Medical Spa" /><small>{{ state.user.label.toUpperCase() }} PORTAL</small></div>
      <nav>
        <RouterLink v-for="n in NAV[state.user.role]" :key="n" :to="'/' + n">{{ t(n) }}</RouterLink>
      </nav>
      <div class="me">
        <b>{{ state.user.name }}</b>{{ state.user.label }}
        <br /><button @click="out">Switch role / Sign out</button>
      </div>
    </aside>
    <main class="main">
      <Topbar />
      <RouterView />
    </main>
    <ClientDrawer />
    <CommandPalette />
  </div>
  <RouterView v-else />
  <div v-if="state.toast" class="toast">{{ state.toast }}</div>
</template>
