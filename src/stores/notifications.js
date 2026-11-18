// The bell: GET /notifications, refreshed every 30 s while signed in.
import { defineStore } from 'pinia'
import { api } from '../api/http'

const POLL_MS = 30000

export const useNotifications = defineStore('notifications', {
  state: () => ({ items: [], unread: 0, timer: null }),

  actions: {
    async load() {
      const res = await api.get('/notifications', { per_page: 20 }, { background: true })
      this.items = res.data
      this.unread = res.meta.unread
    },
    start() {
      this.stop()
      this.load().catch(() => {})
      this.timer = setInterval(() => this.load().catch(() => {}), POLL_MS)
    },
    stop() {
      clearInterval(this.timer)
      this.timer = null
      this.items = []
      this.unread = 0
    },
    async read(n) {
      if (n.read) return
      n.read = true
      this.unread = Math.max(0, this.unread - 1)
      await api.post(`/notifications/${n.id}/read`).catch(() => {})
    },
    async readAll() {
      this.items.forEach((n) => (n.read = true))
      this.unread = 0
      await api.post('/notifications/read-all').catch(() => {})
    },
  },
})

// "5 min ago" style labels.
export function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
