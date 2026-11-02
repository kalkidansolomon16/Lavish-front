// Prototype-only UI state: language, notifications, simulated live events, CSV export.
import { reactive } from 'vue'
import { state, notify, clientName, doctorName } from './store'

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

export const ui = reactive({
  lang: 'en',
  drawerClient: null,
  palette: false,
  bell: false,
  revenue: [
    { label: 'Mon', value: 21500 },
    { label: 'Tue', value: 33000 },
    { label: 'Wed', value: 18500 },
    { label: 'Thu', value: 41200 },
    { label: 'Fri', value: 38800 },
    { label: 'Sat', value: 52000 },
    { label: 'Today', value: 4500 },
  ],
  branches: [
    { label: 'Addis – Bole', value: 86 },
    { label: 'Addis – Kazanchis', value: 64 },
    { label: 'Hawassa', value: 41 },
  ],
  notifications: [
    { id: 1, text: 'Frehiwot Kebede submitted a complaint about redness after filler', roles: ['cto', 'admin'], time: '2h ago', read: false, to: '/complaints' },
    { id: 2, text: 'New order #9002 placed from the mobile app', roles: ['admin', 'seller'], time: '3h ago', read: false, to: '/orders' },
    { id: 3, text: 'Mulu Desta requested HIFU Face & Neck Lift', roles: ['reception', 'admin'], time: '5h ago', read: true, to: '/appointments' },
  ],
})

const T = {
  dashboard: 'ዳሽቦርድ', appointments: 'ቀጠሮዎች', payments: 'ክፍያዎች', clients: 'ደንበኞች', chat: 'ውይይት',
  products: 'ምርቶች', orders: 'ትዕዛዞች', complaints: 'ቅሬታዎች', prescriptions: 'ማዘዣዎች', academy: 'አካዳሚ', staff: 'ሐኪሞች',
  welcome: 'እንኳን ደህና መጡ', upcoming: 'መጪ ቀጠሮዎች', revenue: 'የሳምንቱ ገቢ', mix: 'የሕክምና ዓይነቶች',
}
export const t = (k) => (ui.lang === 'am' && T[k]) || k

export function pushNotif(text, roles, to, doctorId) {
  ui.notifications.unshift({ id: Date.now() + Math.random(), text, roles, to, doctorId, time: 'just now', read: false })
}
export const visibleNotifs = () =>
  ui.notifications.filter((n) => n.roles.includes(state.user.role) && (!n.doctorId || n.doctorId === state.user.doctorId))

export function exportCsv(name, rows) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const body = rows.map((r) => cols.map((c) => `"${String(r[c]).replace(/"/g, '""')}"`).join(','))
  const url = URL.createObjectURL(new Blob([[cols.join(','), ...body].join('\n')], { type: 'text/csv' }))
  Object.assign(document.createElement('a'), { href: url, download: `${name}.csv` }).click()
  URL.revokeObjectURL(url)
  notify(`${name}.csv downloaded`)
}

// Simulates the mobile app sending events so the portal feels alive during the demo.
let started = false
export function startLive() {
  if (started) return
  started = true
  const events = [
    [14000, () => {
      state.appointments.unshift({ id: Date.now(), clientId: 5, doctorId: 2, service: 'Signature HydraFacial', date: day(2), time: '12:00', status: 'pending', notified: false })
      return ['Saron Mekonnen booked Signature HydraFacial with Dr. Yonas', ['reception', 'admin'], '/appointments']
    }],
    [32000, () => {
      state.orders.unshift({ id: 9004, clientId: 6, items: 'SPF 50 Mineral Sunscreen ×1', total: 1900, address: 'Kazanchis, Addis Ababa', lines: [{ productId: 3, qty: 1 }], status: 'placed', date: day(0) })
      return ['New order #9004 from Betty Yilma', ['admin', 'seller'], '/orders']
    }],
    [50000, () => {
      state.complaints.unshift({ id: Date.now(), clientId: 1, subject: 'Booking not confirmed', message: 'I booked yesterday but did not get a confirmation.', priority: 'medium', status: 'open', date: day(0), reply: '' })
      return ['Tigist Worku filed a complaint: Booking not confirmed', ['cto', 'admin'], '/complaints']
    }],
    [68000, () => {
      state.students.push({ id: Date.now(), name: 'Meklit Bogale', courseId: 2, progress: 0, status: 'pending', msg: 'I would love to join the HydraFacial course.' })
      return ['Meklit Bogale applied to the Academy', ['cto'], '/academy']
    }],
  ]
  events.forEach(([ms, run]) =>
    setTimeout(() => {
      const [text, roles, to] = run()
      pushNotif(text, roles, to)
      if (state.user && roles.includes(state.user.role)) notify('🔔 ' + text)
    }, ms),
  )
}
