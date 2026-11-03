import { createRouter, createWebHashHistory } from 'vue-router'
import { state, nav } from './store'

const page = (name) => () => import(`./views/${name}.vue`)

const routes = [
  { path: '/login', component: page('Login'), meta: { public: true } },
  ...['dashboard', 'appointments', 'payments', 'clients', 'chat', 'products', 'orders', 'prescriptions', 'complaints', 'academy', 'staff', 'news', 'schedule', 'modules', 'students', 'team', 'permissions'].map((n) => ({
    path: `/${n}`,
    name: n,
    component: page(n[0].toUpperCase() + n.slice(1)),
  })),
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach((to) => {
  if (to.meta.public) return state.user ? '/' + nav()[0] : true
  if (!state.user) return '/login'
  if (!nav().includes(to.name)) return '/' + nav()[0]
})

export default router
