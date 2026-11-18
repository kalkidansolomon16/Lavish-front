// Portal UI state (language, open drawers/menus), labels and CSV export. No business data here.
import { reactive } from 'vue'
import { notify } from './store'

export const ui = reactive({
  lang: 'en',
  drawerClient: null, // client id → opens the client drawer
  palette: false,     // Ctrl K search
  bell: false,        // notifications menu
})

const T = {
  dashboard: 'ዳሽቦርድ', permissions: 'ፈቃዶች', team: 'የላቪሽ ቡድን', appointments: 'ቀጠሮዎች', payments: 'ክፍያዎች', clients: 'ደንበኞች', chat: 'ውይይት',
  products: 'ምርቶች', orders: 'ትዕዛዞች', complaints: 'ቅሬታዎች', prescriptions: 'ማዘዣዎች', academy: 'አካዳሚ', staff: 'ሰራተኞች', news: 'ዜና', schedule: 'መርሃ ግብር', modules: 'ሞጁሎች', students: 'ተማሪዎች',
  rewards: 'የላቪሽ ሽልማቶች', giftcards: 'የስጦታ ካርዶች', treatments: 'ሕክምናዎች',
  welcome: 'እንኳን ደህና መጡ', upcoming: 'መጪ ቀጠሮዎች', revenue: 'የሳምንቱ ገቢ', mix: 'የሕክምና ዓይነቶች',
}
const EN = { team: 'Lavish Team', rewards: 'Lavish Rewards', giftcards: 'Gift cards' }
export const t = (k) => (ui.lang === 'am' && T[k]) || EN[k] || k

export function exportCsv(name, rows) {
  if (!rows.length) return notify('Nothing to export')
  const cols = Object.keys(rows[0])
  const body = rows.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))
  const url = URL.createObjectURL(new Blob([[cols.join(','), ...body].join('\n')], { type: 'text/csv' }))
  Object.assign(document.createElement('a'), { href: url, download: `${name}.csv` }).click()
  URL.revokeObjectURL(url)
  notify(`${name}.csv downloaded`)
}
