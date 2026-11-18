import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuth } from './stores/auth'
import { syncUser } from './store'
import './tailwind.css'
import './styles.css'
import './extras.css'

const app = createApp(App)
app.use(createPinia())

// Restore the session (GET /auth/me) before the first route is resolved.
const auth = useAuth()
watch(() => auth.user, syncUser, { immediate: true })
auth.bootstrap().finally(() => {
  app.use(router)
  app.mount('#app')
})
