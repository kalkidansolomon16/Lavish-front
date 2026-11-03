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
    { id: 1, text: 'Frehiwot Kebede submitted a complaint about redness after filler', roles: ['gm', 'ceo'], time: '2h ago', read: false, to: '/complaints' },
    { id: 2, text: 'New order #9002 placed from the mobile app', roles: ['ceo', 'ecommerce'], time: '3h ago', read: false, to: '/orders' },
    { id: 4, text: 'Eden Fikru asked to reschedule Friday’s practical', roles: ['teacher'], time: '1h ago', read: false, to: '/students' },
    { id: 5, text: 'Hanna Mulugeta completed HydraFacial & Skin Analysis — certificate ready to issue', roles: ['gm', 'ceo'], time: '4h ago', read: false, to: '/academy' },
    { id: 6, text: 'Dr. Sara Kebede is waiting for portal access', roles: ['gm', 'ceo'], time: '6h ago', read: true, to: '/staff' },
    { id: 3, text: 'Mulu Desta requested HIFU Face & Neck Lift', roles: ['reception', 'ceo'], time: '5h ago', read: true, to: '/appointments' },
  ],
})

const T = {
  dashboard: 'ዳሽቦርድ', permissions: 'ፈቃዶች', team: 'የላቪሽ ቡድን', appointments: 'ቀጠሮዎች', payments: 'ክፍያዎች', clients: 'ደንበኞች', chat: 'ውይይት',
  products: 'ምርቶች', orders: 'ትዕዛዞች', complaints: 'ቅሬታዎች', prescriptions: 'ማዘዣዎች', academy: 'አካዳሚ', staff: 'ሰራተኞች', news: 'ዜና', schedule: 'መርሃ ግብር', modules: 'ሞጁሎች', students: 'ተማሪዎች',
  welcome: 'እንኳን ደህና መጡ', upcoming: 'መጪ ቀጠሮዎች', revenue: 'የሳምንቱ ገቢ', mix: 'የሕክምና ዓይነቶች',
}
const EN = { team: 'Lavish Team' }
export const t = (k) => (ui.lang === 'am' && T[k]) || EN[k] || k

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
      return ['Saron Mekonnen booked Signature HydraFacial with Dr. Yonas', ['reception', 'ceo'], '/appointments']
    }],
    [32000, () => {
      state.orders.unshift({ id: 9004, clientId: 6, items: 'SPF 50 Mineral Sunscreen ×1', total: 1900, address: 'Kazanchis, Addis Ababa', lines: [{ productId: 3, qty: 1 }], status: 'placed', date: day(0) })
      return ['New order #9004 from Betty Yilma', ['ceo', 'ecommerce'], '/orders']
    }],
    [50000, () => {
      state.complaints.unshift({ id: Date.now(), clientId: 1, subject: 'Booking not confirmed', message: 'I booked yesterday but did not get a confirmation.', priority: 'medium', status: 'open', date: day(0), reply: '' })
      return ['Tigist Worku filed a complaint: Booking not confirmed', ['gm', 'ceo'], '/complaints']
    }],
    [68000, () => {
      const st = state.students.find((x) => x.name === 'Kidist Amare')
      if (st?.login) st.login.activated = true
      return ['Kidist Amare logged in to the app with the account you created', ['gm', 'ceo'], '/academy']
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
