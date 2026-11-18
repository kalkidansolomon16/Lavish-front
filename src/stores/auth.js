// Signed-in staff member, from the Lavish API.
// The server decides roles, permissions and visible pages (GET /auth/me) — the web only reads them.
import { defineStore } from 'pinia'
import { api, TOKEN_KEY, setUnauthenticatedHandler, setPasswordChangeHandler } from '../api/http'

export const useAuth = defineStore('auth', {
  state: () => ({
    user: null,          // UserResource: { id, name, roles, portal, level, permissions, pages, doctor_id, must_change_password, … }
    token: localStorage.getItem(TOKEN_KEY),
    ready: false,        // first /auth/me finished
  }),

  getters: {
    signedIn: (s) => !!s.user,
    needsNewPassword: (s) => !!s.user?.must_change_password,
    pages: (s) => s.user?.pages ?? [],
    portal: (s) => s.user?.portal ?? null,
    // home page after login (the dashboard)
    home: (s) => '/' + (s.user?.pages?.[0] ?? 'team'),
  },

  actions: {
    can(...keys) {
      return keys.some((k) => this.user?.permissions?.includes(k))
    },

    async login(login, password) {
      const res = await api.post('/auth/login', { login, password, app: 'web', device_name: navigator.userAgent.slice(0, 100) })
      this.setToken(res.token)
      this.user = res.user
      return res.user
    },

    async changePassword(current_password, password, password_confirmation) {
      const res = await api.post('/auth/password/change', { current_password, password, password_confirmation })
      this.user = res.user
    },

    /** Restores the session on page load. */
    async bootstrap() {
      setUnauthenticatedHandler(() => this.clear())
      // The server says this account must pick a new password first → show the password step on /login.
      setPasswordChangeHandler(() => { if (this.user) this.user = { ...this.user, must_change_password: true } })
      if (this.token) {
        try {
          this.user = (await api.get('/auth/me')).data
        } catch {
          this.clear()
        }
      }
      this.ready = true
    },

    async refresh() {
      this.user = (await api.get('/auth/me')).data
    },

    async logout() {
      try { await api.post('/auth/logout') } catch { /* already gone */ }
      this.clear()
    },

    setToken(token) {
      this.token = token
      localStorage.setItem(TOKEN_KEY, token)
    },

    clear() {
      this.user = null
      this.token = null
      localStorage.removeItem(TOKEN_KEY)
    },
  },
})
