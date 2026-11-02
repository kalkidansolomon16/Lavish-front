// Mock data + actions. Everything here is a stand-in for Laravel API calls.
// When the backend exists, replace each action with an axios call to /api/...
import { reactive } from 'vue'

export const ROLES = {
  admin: { label: 'Admin', name: 'Selam Bekele', blurb: 'Products, orders, staff & overview' },
  reception: { label: 'Receptionist', name: 'Hana Tadesse', blurb: 'Approve appointments, manage payments' },
  doctor: { label: 'Doctor', name: 'Dr. Meron Alemu', blurb: 'Your clients, appointments & chat', doctorId: 1 },
  cto: { label: 'CTO', name: 'Dawit Haile', blurb: 'Academy students & client complaints' },
  seller: { label: 'Medicine Seller', name: 'Abel Girma', blurb: 'Product catalogue & order delivery' },
}

export const NAV = {
  admin: ['dashboard', 'appointments', 'payments', 'products', 'orders', 'prescriptions', 'complaints', 'academy', 'staff'],
  reception: ['dashboard', 'appointments', 'payments', 'clients'],
  doctor: ['dashboard', 'appointments', 'clients', 'prescriptions', 'chat'],
  cto: ['dashboard', 'complaints', 'academy'],
  seller: ['dashboard', 'products', 'prescriptions', 'orders'],
}

const today = new Date().toISOString().slice(0, 10)
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

export const state = reactive({
  user: JSON.parse(localStorage.getItem('lavish_user') || 'null'),
  toast: '',

  doctors: [
    { id: 1, name: 'Dr. Meron Alemu', specialty: 'Dermatology', skills: ['Signature HydraFacial', 'PRP Skin Rejuvenation', 'Morpheus8 & Microneedling', 'Advanced Dermatology Treatments'], branch: 'Addis Ababa – Bole', status: 'Available' },
    { id: 2, name: 'Dr. Yonas Tesfaye', specialty: 'Aesthetic Medicine', skills: ['Botox & Dermal Fillers', 'HIFU Face & Neck Lift', 'Signature HydraFacial'], branch: 'Addis Ababa – Bole', status: 'Available' },
    { id: 3, name: 'Dr. Liya Getachew', specialty: 'Hair Transplant', skills: ['Hair Restoration Solutions'], branch: 'Addis Ababa – Kazanchis', status: 'In surgery' },
    { id: 4, name: 'Dr. Biruk Mengistu', specialty: 'Body Transformation', skills: ['Body Contouring & Skin Tightening'], branch: 'Hawassa', status: 'Off today' },
  ],

  staff: [
    { id: 1, name: 'Selam Bekele', role: 'admin', position: 'Operations Admin', branch: 'Addis Ababa – Bole', phone: '+251 911 00 11 22', status: 'active' },
    { id: 2, name: 'Hana Tadesse', role: 'reception', position: 'Front Desk', branch: 'Addis Ababa – Bole', phone: '+251 911 00 33 44', status: 'active' },
    { id: 3, name: 'Tsion Alemayehu', role: 'reception', position: 'Front Desk', branch: 'Addis Ababa – Kazanchis', phone: '+251 911 00 55 66', status: 'active' },
    { id: 4, name: 'Mekdes Tolera', role: 'reception', position: 'Front Desk', branch: 'Hawassa', phone: '+251 462 00 77 88', status: 'suspended' },
    { id: 5, name: 'Dawit Haile', role: 'cto', position: 'Academy & Client Care Lead', branch: 'Addis Ababa – Bole', phone: '+251 911 00 99 00', status: 'active' },
    { id: 6, name: 'Abel Girma', role: 'seller', position: 'Pharmacy & Product Sales', branch: 'Addis Ababa – Bole', phone: '+251 911 11 22 33', status: 'active' },
  ],

  clients: [
    { id: 1, name: 'Tigist Worku', phone: '+251 911 22 33 44', joined: '2026-08-14', treated: true, doctorId: 1, lastTreatment: 'Signature HydraFacial' },
    { id: 2, name: 'Rahel Assefa', phone: '+251 922 11 55 66', joined: '2026-09-02', treated: true, doctorId: 1, lastTreatment: 'PRP Skin Rejuvenation' },
    { id: 3, name: 'Mulu Desta', phone: '+251 933 44 77 88', joined: '2026-10-11', treated: false, doctorId: 2, lastTreatment: '—' },
    { id: 4, name: 'Frehiwot Kebede', phone: '+251 944 90 12 34', joined: '2026-10-20', treated: true, doctorId: 2, lastTreatment: 'Botox & Dermal Fillers' },
    { id: 5, name: 'Saron Mekonnen', phone: '+251 955 67 89 01', joined: '2026-10-28', treated: false, doctorId: 3, lastTreatment: '—' },
    { id: 6, name: 'Betty Yilma', phone: '+251 966 23 45 67', joined: '2026-07-30', treated: true, doctorId: 1, lastTreatment: 'Morpheus8 & Microneedling' },
  ],

  appointments: [
    { id: 101, clientId: 3, doctorId: 2, service: 'HIFU Face & Neck Lift', date: day(1), time: '10:00', status: 'pending', notified: false },
    { id: 102, clientId: 5, doctorId: 3, service: 'Hair Restoration Solutions', date: day(2), time: '14:30', status: 'pending', notified: false },
    { id: 103, clientId: 1, doctorId: 1, service: 'Signature HydraFacial', date: today, time: '09:00', status: 'approved', notified: true },
    { id: 104, clientId: 6, doctorId: 1, service: 'Morpheus8 & Microneedling', date: today, time: '11:30', status: 'approved', notified: true },
    { id: 105, clientId: 4, doctorId: 2, service: 'Botox & Dermal Fillers', date: day(-3), time: '15:00', status: 'completed', notified: true },
    { id: 106, clientId: 2, doctorId: 1, service: 'PRP Skin Rejuvenation', date: day(3), time: '16:00', status: 'pending', notified: false },
    { id: 107, clientId: 5, doctorId: null, service: 'Body Contouring & Skin Tightening', date: day(1), time: '11:00', status: 'pending', notified: false },
    { id: 108, clientId: 3, doctorId: null, service: 'Signature HydraFacial', date: day(1), time: '10:00', status: 'pending', notified: false },
    { id: 109, clientId: 6, doctorId: null, service: 'Hair Restoration Solutions', date: day(2), time: '09:00', status: 'pending', notified: false },
  ],

  payments: [
    { id: 501, clientId: 1, ref: 'Signature HydraFacial', amount: 4500, method: 'Chapa · Telebirr', txRef: 'CHP-7K2M9QX1', status: 'paid', date: today },
    { id: 502, clientId: 6, ref: 'Morpheus8 & Microneedling', amount: 12000, method: 'Cash', status: 'unpaid', date: today },
    { id: 503, clientId: 4, ref: 'Botox & Dermal Fillers', amount: 18500, method: 'Chapa · CBE Birr', txRef: 'CHP-B84LZ0TD', status: 'paid', date: day(-3) },
    { id: 504, clientId: 2, ref: 'PRP Skin Rejuvenation', amount: 9000, method: 'Telebirr', status: 'unpaid', date: day(3) },
  ],

  products: [
    { id: 1, name: 'Vitamin C Brightening Serum', category: 'Skincare', price: 2800, stock: 34, sku: 'LV-SER-001', reorder: 10 },
    { id: 2, name: 'Hyaluronic Hydra Cream', category: 'Skincare', price: 3200, stock: 21, sku: 'LV-CRM-002', reorder: 10 },
    { id: 3, name: 'SPF 50 Mineral Sunscreen', category: 'Sun care', price: 1900, stock: 5, sku: 'LV-SUN-003', reorder: 10 },
    { id: 4, name: 'Post-Treatment Recovery Balm', category: 'Aftercare', price: 2400, stock: 18, sku: 'LV-AFT-004', reorder: 10 },
    { id: 5, name: 'Scalp Revive Hair Tonic', category: 'Hair', price: 2100, stock: 0, sku: 'LV-HAI-005', reorder: 10 },
  ],

  orders: [
    { id: 9001, clientId: 1, items: 'Vitamin C Brightening Serum ×1, SPF 50 ×2', total: 6600, address: 'Bole, Addis Ababa', lines: [{ productId: 1, qty: 1 }, { productId: 3, qty: 2 }], status: 'placed', date: today },
    { id: 9002, clientId: 4, items: 'Post-Treatment Recovery Balm ×1', total: 2400, address: 'CMC, Addis Ababa', lines: [{ productId: 4, qty: 1 }], status: 'placed', date: today },
    { id: 9003, clientId: 2, items: 'Hyaluronic Hydra Cream ×2', total: 6400, address: 'Piassa, Addis Ababa', lines: [{ productId: 2, qty: 2 }], status: 'delivered', date: day(-2) },
  ],

  complaints: [
    { id: 701, clientId: 4, subject: 'Redness after filler session', message: 'The area is still red after 3 days. Should I be worried?', priority: 'high', status: 'open', date: day(-1), reply: '' },
    { id: 702, clientId: 6, subject: 'Long waiting time', message: 'I waited 40 minutes past my appointment time.', priority: 'medium', status: 'in-review', date: day(-4), reply: 'We are reviewing scheduling at Bole.' },
    { id: 703, clientId: 2, subject: 'Wrong item delivered', message: 'I ordered the cream but got the serum.', priority: 'low', status: 'resolved', date: day(-9), reply: 'Replacement delivered. Apologies!' },
  ],

  courses: [
    { id: 1, title: 'Medical Aesthetics Foundations', weeks: 8, price: 35000 },
    { id: 2, title: 'HydraFacial & Skin Analysis', weeks: 4, price: 18000 },
    { id: 3, title: 'Injectables: Botox & Fillers', weeks: 6, price: 52000 },
  ],

  students: [
    { id: 1, name: 'Eden Fikru', courseId: 1, progress: 62, status: 'active', msg: 'Can I reschedule Friday’s practical?' },
    { id: 2, name: 'Nahom Tilahun', courseId: 3, progress: 15, status: 'active', msg: '' },
    { id: 3, name: 'Kidist Amare', courseId: 2, progress: 0, status: 'pending', msg: 'Hello, I would like to enrol in the next intake.' },
    { id: 4, name: 'Bethel Zewdu', courseId: 1, progress: 0, status: 'pending', msg: '' },
  ],

  movements: [
    { id: 1, productId: 2, type: 'sold', qty: -2, balance: 21, reason: 'Order delivered', ref: '#9003', by: 'Abel Girma', date: day(-2) },
    { id: 2, productId: 2, type: 'sold', qty: -7, balance: 23, reason: 'Orders delivered', ref: 'Weekly', by: 'Abel Girma', date: day(-6) },
    { id: 3, productId: 1, type: 'sold', qty: -6, balance: 34, reason: 'Orders delivered', ref: 'Weekly', by: 'Abel Girma', date: day(-9) },
    { id: 4, productId: 3, type: 'sold', qty: -20, balance: 5, reason: 'Orders delivered', ref: 'Monthly', by: 'Abel Girma', date: day(-5) },
    { id: 5, productId: 4, type: 'sold', qty: -6, balance: 18, reason: 'Orders delivered', ref: 'Weekly', by: 'Abel Girma', date: day(-7) },
    { id: 6, productId: 5, type: 'sold', qty: -12, balance: 0, reason: 'Orders delivered', ref: 'Monthly', by: 'Abel Girma', date: day(-4) },
    { id: 7, productId: 1, type: 'in', qty: 40, balance: 40, reason: 'Stock received', ref: 'Opening stock', by: 'Selam Bekele', date: day(-20) },
    { id: 8, productId: 2, type: 'in', qty: 30, balance: 30, reason: 'Stock received', ref: 'Opening stock', by: 'Selam Bekele', date: day(-20) },
    { id: 9, productId: 3, type: 'in', qty: 25, balance: 25, reason: 'Stock received', ref: 'Opening stock', by: 'Selam Bekele', date: day(-20) },
    { id: 10, productId: 4, type: 'in', qty: 24, balance: 24, reason: 'Stock received', ref: 'Opening stock', by: 'Selam Bekele', date: day(-20) },
    { id: 11, productId: 5, type: 'in', qty: 12, balance: 12, reason: 'Stock received', ref: 'Opening stock', by: 'Selam Bekele', date: day(-20) },
  ],

  prescriptions: [
    { id: 1, clientId: 1, doctorId: 1, date: day(-1), status: 'sent', note: 'Mild dryness after HydraFacial — keep skin hydrated, avoid exfoliants for a week.',
      items: [{ productId: 2, qty: 1, instructions: 'Apply twice daily, morning and night' }, { productId: 3, qty: 2, instructions: 'Every morning, reapply after 3 hours outdoors' }] },
    { id: 2, clientId: 4, doctorId: 2, date: day(-3), status: 'ordered', note: 'Post-filler care.',
      items: [{ productId: 4, qty: 1, instructions: 'Thin layer on treated area 2× daily for 5 days' }] },
  ],

  chats: {
    1: [
      { from: 'client', text: 'Hi Doctor, my skin feels dry since the facial. Is that normal?', time: '09:12' },
      { from: 'doctor', text: 'Hello Tigist, mild dryness is normal for 48h. Use the Hydra Cream twice daily.', time: '09:20' },
    ],
    2: [{ from: 'client', text: 'When can I book my next PRP session?', time: 'Yesterday' }],
    4: [],
    6: [{ from: 'client', text: 'Thank you for today!', time: 'Mon' }],
  },
})

export const clientName = (id) => state.clients.find((c) => c.id === id)?.name ?? 'Unknown'
export const doctorName = (id) => state.doctors.find((d) => d.id === id)?.name ?? 'Unassigned'
export const courseTitle = (id) => state.courses.find((c) => c.id === id)?.title ?? ''
export const etb = (n) => `ETB ${n.toLocaleString()}`

// Ranks doctors for an appointment the client left unassigned.
export function suggestDoctors(appt) {
  const words = (t) => t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)
  const client = state.clients.find((c) => c.id === appt.clientId)
  const isToday = appt.date === today
  const active = (a) => a.doctorId && !['declined', 'completed'].includes(a.status)

  const ranked = state.doctors.map((d) => {
    const reasons = []
    let score = 0
    let available = true

    const exact = (d.skills ?? []).includes(appt.service)
    const overlap = words(appt.service).some((w) => words(d.specialty).includes(w))
    if (exact) { score += 50; reasons.push({ ok: true, text: `Specialist in ${appt.service}` }) }
    else if (overlap) { score += 30; reasons.push({ ok: true, text: `Related specialty: ${d.specialty}` }) }
    else reasons.push({ ok: false, text: `Not a ${appt.service} specialist (${d.specialty})` })

    const clash = state.appointments.some((a) => active(a) && a.doctorId === d.id && a.date === appt.date && a.time === appt.time)
    if (clash) { available = false; reasons.push({ ok: false, text: `Already booked at ${appt.time}` }) }
    else if (isToday && d.status !== 'Available') { available = false; reasons.push({ ok: false, text: `${d.status} today` }) }
    else { score += 30; reasons.push({ ok: true, text: `Free at ${appt.time}` }) }

    const load = state.appointments.filter((a) => active(a) && a.doctorId === d.id && a.date === appt.date).length
    score += Math.max(0, 20 - load * 6)
    reasons.push({ ok: load < 3, text: load ? `${load} other session(s) that day` : 'No other sessions that day — their turn' })

    const seen = client?.doctorId === d.id || state.appointments.some((a) => a.clientId === appt.clientId && a.doctorId === d.id && a.status === 'completed')
    if (seen) { score += 10; reasons.push({ ok: true, text: 'Has treated this client before' }) }

    return { doctor: d, score: available ? score : Math.min(score, 15), available, reasons }
  })
  return ranked.sort((a, b) => b.available - a.available || b.score - a.score)
}

export function notify(msg) {
  state.toast = msg
  setTimeout(() => (state.toast = ''), 2600)
}

export function login(role) {
  state.user = { role, ...ROLES[role] }
  localStorage.setItem('lavish_user', JSON.stringify(state.user))
}
export function logout() {
  state.user = null
  localStorage.removeItem('lavish_user')
}

// Units promised to placed (not yet delivered) orders.
export const reserved = (productId) =>
  state.orders.filter((o) => o.status === 'placed')
    .reduce((t, o) => t + (o.lines ?? []).filter((l) => l.productId === productId).reduce((n, l) => n + l.qty, 0), 0)

function logMove(p, type, qty, reason, ref) {
  state.movements.unshift({ id: Date.now() + Math.random(), productId: p.id, type, qty, balance: p.stock, reason, ref, by: state.user?.name ?? 'System', date: today })
}

export const actions = {
  assignDoctor(a, d) {
    a.doctorId = d.id; a.status = 'approved'; a.notified = true
    notify(`Assigned to ${d.name} and approved — doctor notified`)
  },
  approveAppointment(a) { a.status = 'approved'; a.notified = true; notify(`Approved — ${doctorName(a.doctorId)} has been notified`) },
  declineAppointment(a) { a.status = 'declined'; notify('Appointment declined, client informed') },
  completeAppointment(a) {
    a.status = 'completed'
    const c = state.clients.find((x) => x.id === a.clientId)
    c.treated = true; c.lastTreatment = a.service
    if (!state.chats[c.id]) state.chats[c.id] = []
    notify('Marked complete — chat unlocked for client')
  },
  markPaid(p, method) { p.status = 'paid'; if (method) p.method = method; notify('Payment recorded') },
  addProduct(p) {
    const prod = { id: Date.now(), sku: 'LV-' + String(state.products.length + 1).padStart(3, '0'), reorder: 10, ...p }
    state.products.unshift(prod)
    if (prod.stock > 0) logMove(prod, 'in', prod.stock, 'Stock received', 'Opening stock')
    notify('Product added — visible in mobile app')
  },
  receiveStock(p, qty, ref) { p.stock += qty; logMove(p, 'in', qty, 'Stock received', ref || '—'); notify(`${qty} × ${p.name} added to inventory`) },
  adjustStock(p, counted, reason) {
    const diff = counted - p.stock
    if (!diff) return notify('No change in quantity')
    p.stock = counted
    logMove(p, 'adjust', diff, reason, 'Stock count')
    notify(`${p.name} adjusted to ${counted}`)
  },
  deleteProduct(p) { state.products = state.products.filter((x) => x !== p); notify('Product removed') },
  // Deducts stock for each line. Returns the products that fell to/below their reorder level, or null if blocked.
  confirmDelivery(o) {
    const lines = (o.lines ?? []).map((l) => ({ p: state.products.find((x) => x.id === l.productId), qty: l.qty }))
    const short = lines.find((l) => l.p.stock < l.qty)
    if (short) { notify(`Not enough stock for ${short.p.name} — restock first`); return null }
    const low = []
    lines.forEach((l) => { l.p.stock -= l.qty; logMove(l.p, 'sold', -l.qty, 'Order delivered', '#' + o.id); if (l.p.stock <= l.p.reorder) low.push(l.p) })
    o.status = 'delivered'
    notify(`Order #${o.id} delivered — stock updated`)
    return low
  },
  updateComplaint(c, status) { c.status = status; notify(`Complaint ${status}`) },
  decideStudent(s, ok) { s.status = ok ? 'active' : 'rejected'; notify(ok ? 'Student enrolled' : 'Application declined') },
  addPrescription(rx) {
    state.prescriptions.unshift({ id: Date.now(), date: today, status: 'sent', ...rx })
    notify('Prescription sent to the client’s mobile app')
  },
  fulfillPrescription(rx) {
    const lines = rx.items.map((i) => ({ p: state.products.find((x) => x.id === i.productId), qty: i.qty }))
    state.orders.unshift({
      id: Date.now() % 100000, clientId: rx.clientId, date: today, status: 'placed', address: 'To be confirmed with client', lines: rx.items.map((i) => ({ productId: i.productId, qty: i.qty })),
      items: lines.map((l) => `${l.p.name} ×${l.qty}`).join(', '), total: lines.reduce((t, l) => t + l.p.price * l.qty, 0),
    })
    rx.status = 'ordered'
    notify('Order created from prescription — stock reserved')
  },
  addStaff(m) {
    if (m.role === 'doctor') {
      state.doctors.push({ id: Date.now(), name: m.name, specialty: m.position, branch: m.branch, status: 'Available' })
    } else {
      state.staff.push({ id: Date.now(), ...m, status: 'active' })
    }
    notify(`${m.name} added — login invite sent to ${m.phone}`)
  },
  toggleStaff(m) { m.status = m.status === 'active' ? 'suspended' : 'active'; notify(`${m.name} ${m.status === 'active' ? 'reactivated' : 'suspended'}`) },
  sendChat(clientId, text) {
    state.chats[clientId].push({ from: 'doctor', text, time: 'now' })
  },
}
