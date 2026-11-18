import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuth } from './stores/auth'

const page = (name) => () => import(`./views/${name}.vue`)

const routes = [
  { path: '/login', component: page('Login'), meta: { public: true } },
  ...['dashboard', 'appointments', 'payments', 'rewards', 'giftcards', 'clients', 'chat', 'treatments', 'products', 'orders', 'prescriptions', 'complaints', 'academy', 'staff', 'news', 'schedule', 'modules', 'students', 'team', 'permissions'].map((n) => ({
    path: `/${n}`,
    name: n,
    component: page(n[0].toUpperCase() + n.slice(1)),
  })),
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

const router = createRouter({ history: createWebHashHistory(), routes })

// Signed out → /login. A temporary password must be replaced first (handled on /login).
// Pages the server didn't grant (user.pages) redirect to the user's home.
router.beforeEach((to) => {
  const auth = useAuth()
  if (to.meta.public) return auth.signedIn && !auth.needsNewPassword ? auth.home : true
  if (!auth.signedIn || auth.needsNewPassword) return '/login'
  if (!auth.pages.includes(to.name)) return auth.home
})

export default router
