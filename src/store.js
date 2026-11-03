// Mock data + actions. Everything here is a stand-in for Laravel API calls.
// When the backend exists, replace each action with an axios call to /api/...
import { reactive } from 'vue'
import { LEVEL, DEFAULT_PERMS, PAGES, applies } from './permissions'

// The six web portals.
export const ROLES = {
  ceo: { label: 'CEO', name: 'Dr. Melat Solomon', blurb: 'Full access — revenue, products, doctors, staff & news' },
  gm: { label: 'General Manager', name: 'Dawit Haile', blurb: 'Complaints, inventory & transfers, HR, academy & news' },
  reception: { label: 'Receptionist', name: 'Hana Tadesse', blurb: 'Appointments, walk-in intake & payments' },
  ecommerce: { label: 'Lavish E-commerce', name: 'Abel Girma', blurb: 'Products & prices, inventory, deliveries & order payments' },
  doctor: { label: 'Doctor', name: 'Dr. Meron Alemu', blurb: 'Your patients, their history & prescriptions', doctorId: 1 },
  teacher: { label: 'Lavish Academy', name: 'Dr. Meron Alemu', blurb: 'Your students, schedule, modules, videos & exercises', doctorId: 1 },
  team: { label: 'Lavish Team', name: 'Selam Getahun', blurb: 'Staff groups, announcements & team chat — for every member of staff', teamOnly: true },
}

// ---- permissions (see permissions.js) ----
// Grants per role, editable in the Permissions page and saved in the browser for the demo.
const savedPerms = JSON.parse(localStorage.getItem('lavish_perms_v2') || 'null')
const perms = reactive(savedPerms ?? structuredClone(DEFAULT_PERMS))
perms.ceo = [...DEFAULT_PERMS.ceo] // the top of the hierarchy is never restricted
const savePerms = () => localStorage.setItem('lavish_perms_v2', JSON.stringify(perms))

// Does `role` (default: the signed-in user) hold this permission?
export const can = (key, role = state.user?.role) => !!role && perms[role]?.includes(key)

// Pages in the sidebar — the dashboard is always there.
// Team-only members have no dashboard; they land straight in Lavish Team.
export const nav = (role = state.user?.role) => PAGES.filter((p) => (p === 'dashboard' ? !ROLES[role]?.teamOnly : can('page.' + p, role)))

// Hierarchy rule: you may change a role's permission only if that role is below you,
// you can manage permissions, you hold the permission yourself, and it applies to that role.
export const canGrant = (role, key) => {
  const me = state.user?.role
  return can('permissions.manage') && LEVEL[me] < LEVEL[role] && can(key) && applies(key, role)
}
export function setPerm(role, key, on) {
  if (!canGrant(role, key)) return notify('You can’t change that permission')
  const list = perms[role]
  if (on && !list.includes(key)) list.push(key)
  if (!on) perms[role] = list.filter((k) => k !== key)
  savePerms()
}
// Restores defaults for the roles below the current user.
export function resetPerms() {
  const me = state.user?.role
  Object.keys(perms).filter((r) => LEVEL[r] > LEVEL[me]).forEach((r) => (perms[r] = [...DEFAULT_PERMS[r]]))
  savePerms()
  notify('Permissions reset to defaults')
}
export const rolePerms = perms

export const BRANCHES = ['Addis Ababa – Bole', 'Addis Ababa – Kazanchis', 'Hawassa']
const today = new Date().toISOString().slice(0, 10)
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
// Splits opening stock across branches (most at Bole) so transfers have something to move.
const split = (n) => {
  const b = Math.ceil(n * 0.6), k = Math.floor((n - b) / 2)
  return { [BRANCHES[0]]: b, [BRANCHES[1]]: k, [BRANCHES[2]]: n - b - k }
}
const saved = JSON.parse(localStorage.getItem('lavish_user') || 'null')

export const state = reactive({
  user: saved && ROLES[saved.role] ? saved : null,
  toast: '',

  doctors: [
    { id: 1, name: 'Dr. Meron Alemu', specialty: 'Dermatology', skills: ['Signature HydraFacial', 'PRP Skin Rejuvenation', 'Morpheus8 & Microneedling', 'Advanced Dermatology Treatments'], branch: 'Addis Ababa – Bole', status: 'Available', access: 'active' },
    { id: 2, name: 'Dr. Yonas Tesfaye', specialty: 'Aesthetic Medicine', skills: ['Botox & Dermal Fillers', 'HIFU Face & Neck Lift', 'Signature HydraFacial'], branch: 'Addis Ababa – Bole', status: 'Available', access: 'active' },
    { id: 3, name: 'Dr. Liya Getachew', specialty: 'Hair Transplant', skills: ['Hair Restoration Solutions'], branch: 'Addis Ababa – Kazanchis', status: 'In surgery', access: 'active' },
    { id: 4, name: 'Dr. Biruk Mengistu', specialty: 'Body Transformation', skills: ['Body Contouring & Skin Tightening'], branch: 'Hawassa', status: 'Off today', access: 'active' },
    { id: 5, name: 'Dr. Sara Kebede', specialty: 'Laser & Skin Resurfacing', skills: ['Advanced Dermatology Treatments'], branch: 'Addis Ababa – Kazanchis', status: 'Available', access: 'pending' },
  ],

  staff: [
    { id: 1, name: 'Dr. Melat Solomon', role: 'ceo', position: 'Chief Executive Officer', branch: 'Addis Ababa – Bole', phone: '+251 911 00 11 22', status: 'active' },
    { id: 2, name: 'Hana Tadesse', role: 'reception', position: 'Front Desk', branch: 'Addis Ababa – Bole', phone: '+251 911 00 33 44', status: 'active' },
    { id: 3, name: 'Tsion Alemayehu', role: 'reception', position: 'Front Desk', branch: 'Addis Ababa – Kazanchis', phone: '+251 911 00 55 66', status: 'active' },
    { id: 4, name: 'Mekdes Tolera', role: 'reception', position: 'Front Desk', branch: 'Hawassa', phone: '+251 462 00 77 88', status: 'suspended' },
    { id: 5, name: 'Dawit Haile', role: 'gm', position: 'General Manager', branch: 'Addis Ababa – Bole', phone: '+251 911 00 99 00', status: 'active' },
    { id: 6, name: 'Abel Girma', role: 'ecommerce', position: 'E-commerce & Inventory', branch: 'Addis Ababa – Bole', phone: '+251 911 11 22 33', status: 'active' },
    { id: 7, name: 'Selam Getahun', role: 'team', position: 'Nurse', branch: 'Addis Ababa – Bole', phone: '+251 911 44 55 66', status: 'active' },
    { id: 8, name: 'Ruth Alemayehu', role: 'team', position: 'Skin Therapist', branch: 'Addis Ababa – Bole', phone: '+251 911 77 88 99', status: 'active' },
    { id: 9, name: 'Yared Bekele', role: 'team', position: 'Delivery & Logistics', branch: 'Addis Ababa – Bole', phone: '+251 922 33 44 55', status: 'active' },
  ],

  clients: [
    { id: 1, name: 'Tigist Worku', phone: '+251 911 22 33 44', joined: '2026-08-14', treated: true, doctorId: 1, lastTreatment: 'Signature HydraFacial', app: true,
      history: { source: 'Walk-in', concern: 'Dull, dehydrated skin before a wedding', skinType: 'Dry', allergies: 'None known', medications: 'None', conditions: 'None', previous: 'No previous aesthetic treatments', pregnant: 'No', recordedBy: 'Hana Tadesse', date: '2026-08-14' } },
    { id: 2, name: 'Rahel Assefa', phone: '+251 922 11 55 66', joined: '2026-09-02', treated: true, doctorId: 1, lastTreatment: 'PRP Skin Rejuvenation', app: true },
    { id: 3, name: 'Mulu Desta', phone: '+251 933 44 77 88', joined: '2026-10-11', treated: false, doctorId: 2, lastTreatment: '—', app: true },
    { id: 4, name: 'Frehiwot Kebede', phone: '+251 944 90 12 34', joined: '2026-10-20', treated: true, doctorId: 2, lastTreatment: 'Botox & Dermal Fillers', app: true,
      history: { source: 'Phone call', concern: 'Fine lines around the eyes and forehead', skinType: 'Combination', allergies: 'Lidocaine (mild)', medications: 'None', conditions: 'None', previous: 'Botox 2025 (another clinic)', pregnant: 'No', recordedBy: 'Hana Tadesse', date: '2026-10-20' } },
    { id: 5, name: 'Saron Mekonnen', phone: '+251 955 67 89 01', joined: '2026-10-28', treated: false, doctorId: 3, lastTreatment: '—', app: true },
    { id: 6, name: 'Betty Yilma', phone: '+251 966 23 45 67', joined: '2026-07-30', treated: true, doctorId: 1, lastTreatment: 'Morpheus8 & Microneedling', app: true },
    { id: 7, name: 'Almaz Tesfaye', phone: '+251 977 31 45 90', joined: today, treated: false, doctorId: 1, lastTreatment: '—', app: false,
      history: { source: 'Walk-in', concern: 'Dark spots on cheeks (melasma)', skinType: 'Oily', allergies: 'Penicillin', medications: 'Oral contraceptives', conditions: 'None', previous: 'Chemical peel 2024', pregnant: 'No', recordedBy: 'Hana Tadesse', date: today } },
  ],

  appointments: [
    { id: 101, clientId: 3, doctorId: 2, service: 'HIFU Face & Neck Lift', date: day(1), time: '10:00', status: 'pending', notified: false },
    { id: 102, clientId: 5, doctorId: 3, service: 'Hair Restoration Solutions', date: day(2), time: '14:30', status: 'pending', notified: false },
    { id: 103, clientId: 1, doctorId: 1, service: 'Signature HydraFacial', date: today, time: '09:00', status: 'approved', notified: true },
    { id: 104, clientId: 6, doctorId: 1, service: 'Morpheus8 & Microneedling', date: today, time: '11:30', status: 'approved', notified: true },
    { id: 105, clientId: 4, doctorId: 2, service: 'Botox & Dermal Fillers', date: day(-3), time: '15:00', status: 'completed', notified: true },
    // Clashes with Dr. Meron's 10:00 class — reception sees the conflict before approving.
    { id: 106, clientId: 2, doctorId: 1, service: 'PRP Skin Rejuvenation', date: day(1), time: '11:00', status: 'pending', notified: false },
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
    { id: 1, name: 'Vitamin C Brightening Serum', category: 'Skincare', price: 2800, stock: 34, sku: 'LV-SER-001', reorder: 10, branches: split(34) },
    { id: 2, name: 'Hyaluronic Hydra Cream', category: 'Skincare', price: 3200, stock: 21, sku: 'LV-CRM-002', reorder: 10, branches: split(21) },
    { id: 3, name: 'SPF 50 Mineral Sunscreen', category: 'Sun care', price: 1900, stock: 5, sku: 'LV-SUN-003', reorder: 10, branches: split(5) },
    { id: 4, name: 'Post-Treatment Recovery Balm', category: 'Aftercare', price: 2400, stock: 18, sku: 'LV-AFT-004', reorder: 10, branches: split(18) },
    { id: 5, name: 'Scalp Revive Hair Tonic', category: 'Hair', price: 2100, stock: 0, sku: 'LV-HAI-005', reorder: 10, branches: split(0) },
  ],

  orders: [
    { id: 9001, clientId: 1, items: 'Vitamin C Brightening Serum ×1, SPF 50 ×2', total: 6600, address: 'Bole, Addis Ababa', lines: [{ productId: 1, qty: 1 }, { productId: 3, qty: 2 }], status: 'placed', date: today, payment: 'unpaid', method: 'Pay on delivery' },
    { id: 9002, clientId: 4, items: 'Post-Treatment Recovery Balm ×1', total: 2400, address: 'CMC, Addis Ababa', lines: [{ productId: 4, qty: 1 }], status: 'placed', date: today, payment: 'paid', method: 'Telebirr' },
    { id: 9003, clientId: 2, items: 'Hyaluronic Hydra Cream ×2', total: 6400, address: 'Piassa, Addis Ababa', lines: [{ productId: 2, qty: 2 }], status: 'delivered', date: day(-2), payment: 'paid', method: 'Chapa · CBE Birr', notified: true },
  ],

  complaints: [
    { id: 701, clientId: 4, subject: 'Redness after filler session', message: 'The area is still red after 3 days. Should I be worried?', priority: 'high', status: 'open', date: day(-1), reply: '' },
    { id: 702, clientId: 6, subject: 'Long waiting time', message: 'I waited 40 minutes past my appointment time.', priority: 'medium', status: 'in-review', date: day(-4), reply: 'We are reviewing scheduling at Bole.' },
    { id: 703, clientId: 2, subject: 'Wrong item delivered', message: 'I ordered the cream but got the serum.', priority: 'low', status: 'resolved', date: day(-9), reply: 'Replacement delivered. Apologies!' },
  ],

  // Learning paths: the General Manager defines courses + modules and assigns teacher doctors;
  // teachers attach videos and exercises to each module.
  courses: [
    { id: 1, title: 'Medical Aesthetics Foundations', weeks: 8, price: 35000, level: 'Beginner', teacherIds: [1], modules: [
      { id: 11, week: 1, title: 'Skin anatomy & types', video: { title: 'Layers of the skin', mins: 18 }, exercise: { title: 'Label the skin layers', due: day(-28) }, published: true },
      { id: 12, week: 2, title: 'Hygiene & infection control', video: { title: 'Clinic sterilisation walkthrough', mins: 22 }, exercise: { title: 'Hygiene checklist quiz', due: day(-21) }, published: true },
      { id: 13, week: 3, title: 'Client consultation', video: { title: 'Running a consultation', mins: 25 }, exercise: { title: 'Role-play recording', due: day(-14) }, published: true },
      { id: 14, week: 4, title: 'Facials & extractions', video: { title: 'Extraction technique', mins: 31 }, exercise: { title: 'Practical log — 3 facials', due: day(-7) }, published: true },
      { id: 15, week: 5, title: 'Chemical peels', video: { title: 'Peel depth & selection', mins: 27 }, exercise: { title: 'Peel case study', due: day(3) }, published: true },
      { id: 16, week: 6, title: 'Microdermabrasion', video: null, exercise: null, published: false },
      { id: 17, week: 7, title: 'Aftercare & product advice', video: null, exercise: null, published: false },
      { id: 18, week: 8, title: 'Final practical exam', video: null, exercise: null, published: false },
    ] },
    { id: 2, title: 'HydraFacial & Skin Analysis', weeks: 4, price: 18000, level: 'Intermediate', teacherIds: [1, 2], modules: [
      { id: 21, week: 1, title: 'Skin analysis devices', video: { title: 'Using the skin scanner', mins: 15 }, exercise: { title: 'Analyse 2 client scans', due: day(-10) }, published: true },
      { id: 22, week: 2, title: 'HydraFacial protocol', video: { title: 'Full HydraFacial protocol', mins: 34 }, exercise: { title: 'Protocol quiz', due: day(-3) }, published: true },
      { id: 23, week: 3, title: 'Boosters & add-ons', video: null, exercise: null, published: false },
      { id: 24, week: 4, title: 'Practical assessment', video: null, exercise: null, published: false },
    ] },
    { id: 3, title: 'Injectables: Botox & Fillers', weeks: 6, price: 52000, level: 'Advanced', teacherIds: [2], modules: [
      { id: 31, week: 1, title: 'Facial anatomy', video: { title: 'Danger zones of the face', mins: 40 }, exercise: { title: 'Anatomy mapping', due: day(5) }, published: true },
      { id: 32, week: 2, title: 'Neurotoxins', video: null, exercise: null, published: false },
      { id: 33, week: 3, title: 'Hyaluronic fillers', video: null, exercise: null, published: false },
    ] },
  ],

  sessions: [
    { id: 1, courseId: 1, teacherId: 1, date: day(1), time: '10:00', title: 'Chemical peels — practical', kind: 'Practical', room: 'Bole training room' },
    { id: 2, courseId: 2, teacherId: 1, date: day(2), time: '14:00', title: 'HydraFacial protocol — demo', kind: 'Practical', room: 'Bole training room' },
    { id: 3, courseId: 1, teacherId: 1, date: day(4), time: '14:00', title: 'Microdermabrasion — theory', kind: 'Theory', room: 'Online (Zoom)' },
    { id: 4, courseId: 3, teacherId: 2, date: day(3), time: '09:00', title: 'Facial anatomy — cadaver lab', kind: 'Practical', room: 'Kazanchis lab' },
  ],

  // `login` = app credentials the CEO handed over; `activated` once the student has logged in.
  students: [
    { id: 1, name: 'Eden Fikru', phone: '+251 912 45 67 89', courseId: 1, progress: 62, status: 'active', msg: 'Can I reschedule Friday’s practical?', certificate: null, login: { username: '0912456789', via: 'In person', activated: true },
      chat: [{ from: 'teacher', text: 'Welcome to Foundations, Eden!', time: 'Sep 1' }, { from: 'student', text: 'Can I reschedule Friday’s practical?', time: 'Yesterday' }] },
    { id: 2, name: 'Nahom Tilahun', phone: '+251 913 22 10 44', courseId: 3, progress: 15, status: 'active', msg: '', certificate: null, login: { username: '0913221044', via: 'Phone call', activated: true }, chat: [] },
    { id: 3, name: 'Kidist Amare', phone: '+251 914 88 21 07', courseId: 2, progress: 0, status: 'active', msg: '', certificate: null, login: { username: '0914882107', via: 'Phone call', activated: false }, chat: [] },
    { id: 4, name: 'Bethel Zewdu', phone: '+251 915 60 33 12', courseId: 1, progress: 0, status: 'active', msg: '', certificate: null, login: { username: '0915603312', via: 'In person', activated: false }, chat: [] },
    { id: 5, name: 'Hanna Mulugeta', phone: '+251 916 74 09 55', courseId: 2, progress: 100, status: 'completed', msg: 'Thank you for everything!', certificate: null, login: { username: '0916740955', via: 'In person', activated: true },
      chat: [{ from: 'student', text: 'I passed the practical assessment 🎉', time: 'Mon' }, { from: 'teacher', text: 'Congratulations Hanna — well deserved!', time: 'Mon' }] },
    { id: 6, name: 'Selamawit Girma', phone: '+251 917 12 98 30', courseId: 2, progress: 48, status: 'active', msg: '', certificate: null, login: { username: '0917129830', via: 'Phone call', activated: true }, chat: [] },
  ],

  // Shown on the client Home screen in the mobile app. Posted by the CEO or General Manager.
  news: [
    { id: 1, title: 'New: Morpheus8 now at Kazanchis', body: 'Our most requested skin-tightening treatment is now available at the Kazanchis branch. Book from the app.', tag: 'New treatment', date: day(-1), by: 'Dr. Melat Solomon', published: true },
    { id: 2, title: '20% off aftercare this week', body: 'All Aftercare products are 20% off in the Lavish shop until Sunday.', tag: 'Offer', date: day(-3), by: 'Dawit Haile', published: true },
    { id: 3, title: 'Academy: December intake open', body: 'Enrolment for the December Foundations intake is open — visit the academy or call to register.', tag: 'Academy', date: day(-6), by: 'Dawit Haile', published: false },
  ],

  movements: [
    { id: 1, productId: 2, type: 'sold', qty: -2, balance: 21, reason: 'Order delivered', ref: '#9003', by: 'Abel Girma', date: day(-2) },
    { id: 2, productId: 2, type: 'sold', qty: -7, balance: 23, reason: 'Orders delivered', ref: 'Weekly', by: 'Abel Girma', date: day(-6) },
    { id: 3, productId: 1, type: 'sold', qty: -6, balance: 34, reason: 'Orders delivered', ref: 'Weekly', by: 'Abel Girma', date: day(-9) },
    { id: 4, productId: 3, type: 'sold', qty: -20, balance: 5, reason: 'Orders delivered', ref: 'Monthly', by: 'Abel Girma', date: day(-5) },
    { id: 5, productId: 4, type: 'sold', qty: -6, balance: 18, reason: 'Orders delivered', ref: 'Weekly', by: 'Abel Girma', date: day(-7) },
    { id: 6, productId: 5, type: 'sold', qty: -12, balance: 0, reason: 'Orders delivered', ref: 'Monthly', by: 'Abel Girma', date: day(-4) },
    { id: 7, productId: 1, type: 'in', qty: 40, balance: 40, reason: 'Stock received', ref: 'Opening stock', by: 'Dr. Melat Solomon', date: day(-20) },
    { id: 8, productId: 2, type: 'in', qty: 30, balance: 30, reason: 'Stock received', ref: 'Opening stock', by: 'Dr. Melat Solomon', date: day(-20) },
    { id: 9, productId: 3, type: 'in', qty: 25, balance: 25, reason: 'Stock received', ref: 'Opening stock', by: 'Dr. Melat Solomon', date: day(-20) },
    { id: 10, productId: 4, type: 'in', qty: 24, balance: 24, reason: 'Stock received', ref: 'Opening stock', by: 'Dr. Melat Solomon', date: day(-20) },
    { id: 11, productId: 5, type: 'in', qty: 12, balance: 12, reason: 'Stock received', ref: 'Opening stock', by: 'Dr. Melat Solomon', date: day(-20) },
  ],

  prescriptions: [
    { id: 1, clientId: 1, doctorId: 1, date: day(-1), status: 'sent', note: 'Mild dryness after HydraFacial — keep skin hydrated, avoid exfoliants for a week.',
      items: [{ productId: 2, qty: 1, instructions: 'Apply twice daily, morning and night' }, { productId: 3, qty: 2, instructions: 'Every morning, reapply after 3 hours outdoors' }] },
    { id: 2, clientId: 4, doctorId: 2, date: day(-3), status: 'ordered', note: 'Post-filler care.',
      items: [{ productId: 4, qty: 1, instructions: 'Thin layer on treated area 2× daily for 5 days' }] },
    // `waiting` = the Lavish product was out of stock when prescribed; the doctor suggests it again once it's back.
    // `custom` = a medicine Lavish doesn't sell — the client buys it at a pharmacy.
    { id: 3, clientId: 6, doctorId: 1, date: day(-12), status: 'sent', note: 'Protect the treated skin from the sun for 4 weeks.',
      items: [{ productId: 3, qty: 1, instructions: 'Every morning, reapply after 3 hours outdoors', waiting: true },
        { productId: null, custom: 'Tranexamic acid 250 mg tablets', qty: 1, instructions: '1 tablet twice daily for 8 weeks' }] },
    { id: 4, clientId: 2, doctorId: 1, date: day(-5), status: 'sent', note: 'Support hair growth between PRP sessions.',
      items: [{ productId: 5, qty: 1, instructions: 'Massage into scalp every evening', waiting: true }] },
  ],

  // ---- Lavish Team: internal staff communication ----
  // People are keyed 's<id>' (staff) or 'd<id>' (doctors). Groups are created by the CEO / GM.
  announcements: [
    { id: 1, title: 'Welcome to Lavish Team', body: 'This is our new space for staff news, groups and direct messages. Please check it at the start of every shift.', by: 's1', date: day(-2), audience: 'all', readBy: ['s1', 's5'] },
    { id: 2, title: 'Bole team meeting — Friday 8:30', body: 'Short stand-up before opening: new HydraFacial booster protocol and weekend staffing.', by: 's5', date: day(-1), audience: 2, readBy: ['s5'] },
  ],
  groups: [
    { id: 1, name: 'All Doctors', about: 'Clinical updates, protocols and case discussions', members: ['s1', 's5', 'd1', 'd2', 'd3', 'd4'], by: 's1', date: day(-20),
      messages: [{ from: 's1', text: 'Please review the updated consent form before Monday.', time: 'Mon 09:10' }, { from: 'd2', text: 'Done — looks good.', time: 'Mon 10:02' }] },
    { id: 2, name: 'Bole Front Desk & Care', about: 'Daily coordination at the Bole branch', members: ['s5', 's2', 's7', 's8', 'd1'], by: 's5', date: day(-10),
      messages: [{ from: 's2', text: 'Morning! 3 walk-ins already booked for this afternoon.', time: '08:45' }, { from: 's7', text: 'Treatment room 2 is ready.', time: '08:52' }] },
    { id: 3, name: 'Shop & Delivery', about: 'Orders, stock and deliveries', members: ['s1', 's6', 's9'], by: 's1', date: day(-6),
      messages: [{ from: 's6', text: 'Order #9001 is packed and ready for pickup.', time: 'Yesterday' }] },
  ],
  // Direct messages, keyed by the two people's keys sorted and joined with '|'.
  dms: {
    's2|s7': [{ from: 's2', text: 'Can you prep room 1 for Tigist at 9?', time: '08:30' }, { from: 's7', text: 'On it 👍', time: '08:31' }],
    'd1|s1': [{ from: 's1', text: 'Dr. Meron, great feedback from clients this week. Thank you!', time: 'Tue' }],
  },

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

// Everyone with an active account, for groups and direct messages.
export const people = () => [
  ...state.staff.filter((m) => m.status === 'active').map((m) => ({ key: 's' + m.id, name: m.name, role: m.role, title: m.position })),
  ...state.doctors.filter((d) => d.access === 'active').map((d) => ({ key: 'd' + d.id, name: d.name, role: 'doctor', title: d.specialty })),
]
export const personName = (key) => people().find((p) => p.key === key)?.name ?? 'Former staff'
// The signed-in user's person key (doctor and academy portals are the same person).
export const meKey = () => people().find((p) => p.name === state.user?.name)?.key
export const dmKey = (a, b) => [a, b].sort().join('|')

export const clientName = (id) => state.clients.find((c) => c.id === id)?.name ?? 'Unknown'
export const doctorName = (id) => state.doctors.find((d) => d.id === id)?.name ?? 'Unassigned'
export const courseTitle = (id) => state.courses.find((c) => c.id === id)?.title ?? ''
export const etb = (n) => `ETB ${n.toLocaleString()}`

// Doctors who also teach have one calendar: academy classes and treatments must not overlap.
export const CLASS_MINS = 120
export const TREATMENT_MINS = 60
const toMins = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5)
const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const overlaps = (t1, len1, t2, len2) => toMins(t1) < toMins(t2) + len2 && toMins(t2) < toMins(t1) + len1
// What the doctor is already committed to during [time, time + length) on that date.
export function doctorClashes(doctorId, date, time, length = TREATMENT_MINS, skipApptId) {
  const classes = state.sessions
    .filter((s) => s.teacherId === doctorId && s.date === date && overlaps(time, length, s.time, CLASS_MINS))
    .map((s) => ({ kind: 'class', text: `Teaching “${s.title}” ${s.time}–${fmt(toMins(s.time) + CLASS_MINS)} · ${s.room}` }))
  const treatments = state.appointments
    .filter((a) => a.id !== skipApptId && a.doctorId === doctorId && a.status === 'approved' && a.date === date && overlaps(time, length, a.time, TREATMENT_MINS))
    .map((a) => ({ kind: 'treatment', text: `Treating ${clientName(a.clientId)} — ${a.service} at ${a.time}` }))
  return [...classes, ...treatments]
}

// Ranks doctors for an appointment the client left unassigned.
export function suggestDoctors(appt) {
  const words = (t) => t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)
  const client = state.clients.find((c) => c.id === appt.clientId)
  const isToday = appt.date === today
  const active = (a) => a.doctorId && !['declined', 'completed'].includes(a.status)

  const ranked = state.doctors.filter((d) => d.access === 'active').map((d) => {
    const reasons = []
    let score = 0
    let available = true

    const exact = (d.skills ?? []).includes(appt.service)
    const overlap = words(appt.service).some((w) => words(d.specialty).includes(w))
    if (exact) { score += 50; reasons.push({ ok: true, text: `Specialist in ${appt.service}` }) }
    else if (overlap) { score += 30; reasons.push({ ok: true, text: `Related specialty: ${d.specialty}` }) }
    else reasons.push({ ok: false, text: `Not a ${appt.service} specialist (${d.specialty})` })

    const clash = state.appointments.some((a) => active(a) && a.doctorId === d.id && a.date === appt.date && a.time === appt.time)
    const teaching = doctorClashes(d.id, appt.date, appt.time).find((c) => c.kind === 'class')
    if (teaching) { available = false; reasons.push({ ok: false, text: teaching.text }) }
    else if (clash) { available = false; reasons.push({ ok: false, text: `Already booked at ${appt.time}` }) }
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
// Removes qty from branch stock, main branch first. p.stock is always the sum of p.branches.
function takeFromBranches(p, qty) {
  for (const b of BRANCHES) {
    const n = Math.min(p.branches[b], qty)
    p.branches[b] -= n; qty -= n
  }
}

// Temporary password the student must change at first login.
const tempPassword = () => 'LA-' + Math.random().toString(36).slice(2, 6).toUpperCase() + Math.floor(10 + Math.random() * 90)

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
    const prod = { id: Date.now(), sku: 'LV-' + String(state.products.length + 1).padStart(3, '0'), reorder: 10, ...p, branches: { ...split(0), [BRANCHES[0]]: p.stock } }
    state.products.unshift(prod)
    if (prod.stock > 0) logMove(prod, 'in', prod.stock, 'Stock received', 'Opening stock')
    notify('Product added — visible in mobile app')
  },
  receiveStock(p, qty, ref, branch = BRANCHES[0]) { p.stock += qty; p.branches[branch] += qty; logMove(p, 'in', qty, 'Stock received · ' + branch, ref || '—'); notify(`${qty} × ${p.name} added to ${branch}`) },
  transferStock(p, from, to, qty) {
    if (qty <= 0 || from === to) return
    if (p.branches[from] < qty) return notify(`Only ${p.branches[from]} at ${from}`)
    p.branches[from] -= qty; p.branches[to] += qty
    logMove(p, 'transfer', 0, `${qty} moved ${from} → ${to}`, 'Transfer')
    notify(`${qty} × ${p.name} transferred to ${to}`)
  },
  setPrice(p, price) { p.price = price; notify(`${p.name} now ${etb(price)} in the app`) },
  adjustStock(p, counted, reason) {
    const diff = counted - p.stock
    if (!diff) return notify('No change in quantity')
    p.stock = counted
    if (diff > 0) p.branches[BRANCHES[0]] += diff
    else takeFromBranches(p, -diff)
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
    lines.forEach((l) => { l.p.stock -= l.qty; takeFromBranches(l.p, l.qty); logMove(l.p, 'sold', -l.qty, 'Order delivered', '#' + o.id); if (l.p.stock <= l.p.reorder) low.push(l.p) })
    o.status = 'delivered'; o.notified = true
    if (o.method === 'Pay on delivery') o.payment = 'paid'
    notify(`Order #${o.id} delivered — client notified in the app`)
    return low
  },
  updateComplaint(c, status) { c.status = status; notify(`Complaint ${status}`) },
  addPrescription(rx) {
    state.prescriptions.unshift({ id: Date.now(), date: today, status: 'sent', ...rx })
    notify('Prescription sent to the client’s mobile app')
  },
  // A doctor re-suggests a product that was out of stock when they prescribed it. Arrives in the client's chat.
  suggestRestocked(rx, item) {
    const p = state.products.find((x) => x.id === item.productId)
    if (!state.chats[rx.clientId]) state.chats[rx.clientId] = []
    state.chats[rx.clientId].push({ from: 'doctor', text: `Good news — ${p.name}, which I prescribed for you, is back in stock. You can order it from the Shop in the app. (${item.instructions || 'Use as directed'})`, time: 'now' })
    item.suggested = true
    notify(`Suggestion sent to ${clientName(rx.clientId)}’s app`)
  },
  fulfillPrescription(rx) {
    // Only Lavish products can be ordered; outside medicines are bought at a pharmacy.
    const items = rx.items.filter((i) => i.productId)
    if (!items.length) return notify('Nothing to order — all items are outside Lavish products')
    const lines = items.map((i) => ({ p: state.products.find((x) => x.id === i.productId), qty: i.qty }))
    state.orders.unshift({
      id: Date.now() % 100000, clientId: rx.clientId, date: today, status: 'placed', address: 'To be confirmed with client', lines: items.map((i) => ({ productId: i.productId, qty: i.qty })),
      items: lines.map((l) => `${l.p.name} ×${l.qty}`).join(', '), total: lines.reduce((t, l) => t + l.p.price * l.qty, 0),
    })
    rx.status = 'ordered'
    notify('Order created from prescription — stock reserved')
  },
  addStaff(m) {
    if (m.role === 'doctor') {
      state.doctors.push({ id: Date.now(), name: m.name, specialty: m.position, skills: [], branch: m.branch, status: 'Available', access: 'active' })
    } else {
      state.staff.push({ id: Date.now(), ...m, status: 'active' })
    }
    notify(`${m.name} added — login invite sent to ${m.phone}`)
  },
  toggleStaff(m) { m.status = m.status === 'active' ? 'suspended' : 'active'; notify(`${m.name} ${m.status === 'active' ? 'reactivated' : 'suspended'}`) },
  // ---- Lavish Team ----
  postAnnouncement({ title, body, audience }) {
    state.announcements.unshift({ id: Date.now(), title, body, audience, by: meKey(), date: today, readBy: [meKey()] })
    notify(audience === 'all' ? 'Announcement sent to all staff' : 'Announcement sent to the group')
  },
  deleteAnnouncement(a) { state.announcements = state.announcements.filter((x) => x !== a); notify('Announcement removed') },
  createGroup({ name, about, members }) {
    const g = { id: Date.now(), name, about, members: [...new Set([meKey(), ...members])], by: meKey(), date: today, messages: [] }
    state.groups.unshift(g)
    notify(`Group “${name}” created — ${g.members.length} members can now see it`)
    return g
  },
  setGroupMembers(g, members) { g.members = [...new Set(members)]; notify('Group members updated') },
  deleteGroup(g) { state.groups = state.groups.filter((x) => x !== g); notify('Group deleted') },
  sendGroupMessage(g, text) {
    // Members only (people who manage groups can also post).
    if (!g.members.includes(meKey()) && !can('team.groups')) return notify('Only members of this group can post here')
    g.messages.push({ from: meKey(), text, time: 'now' })
  },
  sendDirect(to, text) {
    const k = dmKey(meKey(), to)
    if (!state.dms[k]) state.dms[k] = []
    state.dms[k].push({ from: meKey(), text, time: 'now' })
  },

  sendChat(clientId, text) {
    state.chats[clientId].push({ from: 'doctor', text, time: 'now' })
  },

  // ---- access control (CEO grants + bans, GM grants) ----
  setDoctorAccess(d, access) {
    d.access = access
    notify({ active: `${d.name} can now log in`, banned: `${d.name} is banned — hidden from the mobile app` }[access])
  },

  // ---- e-commerce ----
  markOrderPaid(o) { o.payment = 'paid'; notify(`Order #${o.id} marked as paid`) },

  // ---- reception: walk-in / phone booking ----
  // Creates (or updates) the client with their intake history and books an approved slot.
  walkIn({ clientId, client, history, appt, sms, invite }) {
    let c = state.clients.find((x) => x.id === clientId)
    if (!c) {
      c = { id: Date.now(), ...client, joined: today, treated: false, doctorId: appt.doctorId, lastTreatment: '—', app: false }
      state.clients.unshift(c)
    }
    c.history = { ...history, recordedBy: state.user.name, date: today }
    const a = { id: Date.now() + 1, clientId: c.id, ...appt, status: 'approved', notified: true }
    state.appointments.unshift(a)
    state.payments.unshift({ id: Date.now() + 2, clientId: c.id, ref: appt.service, amount: appt.price, method: '—', status: 'unpaid', date: appt.date })
    if (invite) c.invited = true
    notify(`Booked & ${doctorName(a.doctorId)} notified${sms ? ` — SMS sent to ${c.phone}` : ''}`)
    return { c, a }
  },
  sendAppInvite(c) { c.invited = true; notify(`App download link sent to ${c.phone}`) },
  markRegistered(c) { c.app = true; notify(`${c.name} is now registered in the app`) },

  // ---- news (CEO + GM) ----
  addNews(n) { state.news.unshift({ id: Date.now(), date: today, by: state.user.name, ...n }); notify(n.published ? 'Published to the mobile app' : 'Saved as draft') },
  toggleNews(n) { n.published = !n.published; notify(n.published ? 'Now showing in the mobile app' : 'Hidden from the mobile app') },
  deleteNews(n) { state.news = state.news.filter((x) => x !== n); notify('News removed') },

  // ---- academy ----
  // CEO enrols a student and creates their app login. Returns the one-time password to hand over.
  addStudent({ name, phone, courseId, via }) {
    const password = tempPassword()
    const username = phone.replace(/\D/g, '').replace(/^251/, '0')
    state.students.unshift({ id: Date.now(), name, phone, courseId, progress: 0, status: 'active', msg: '', certificate: null, login: { username, via, activated: false }, chat: [] })
    notify(`${name} enrolled — app login created`)
    return { name, username, password }
  },
  smsStudentLogin(c) { notify(`Login details sent by SMS to ${c.name}`) },
  // When a student forgets their password they call the CEO, who issues a new one.
  resetStudentPassword(st) {
    st.login.activated = false
    notify(`New password created for ${st.name}`)
    return { name: st.name, username: st.login.username, password: tempPassword() }
  },
  addModule(c, title) {
    const week = c.modules.length + 1
    c.modules.push({ id: Date.now(), week, title, video: null, exercise: null, published: false })
    notify(`Module added to ${c.title}`)
  },
  setTeachers(c, ids) { c.teacherIds = ids; notify('Teacher access updated') },
  saveLesson(m, video, exercise) { m.video = video; m.exercise = exercise; notify('Lesson content saved') },
  publishModule(m) { m.published = !m.published; notify(m.published ? 'Module visible to students' : 'Module hidden') },
  addSession(s) { state.sessions.push({ id: Date.now(), ...s }); notify('Session added — students notified') },
  setProgress(st, n) { st.progress = n; if (n >= 100) st.status = 'completed' },
  messageStudent(st, text) { st.chat.push({ from: 'teacher', text, time: 'now' }) },
  issueCertificate(st) {
    st.certificate = { no: 'LA-' + new Date().getFullYear() + '-' + String(st.id).padStart(4, '0'), date: today, by: state.user.name }
    notify(`Certificate issued — PDF sent to ${st.name}’s app`)
  },
}

// Every action checks its permission, so a hidden button isn't the only line of defence.
// A function entry picks the permission from the arguments.
const ACTION_PERMS = {
  assignDoctor: 'appointments.approve', approveAppointment: 'appointments.approve', declineAppointment: 'appointments.approve', walkIn: 'appointments.approve',
  completeAppointment: 'appointments.complete',
  markPaid: 'payments.collect',
  addProduct: 'products.edit', receiveStock: 'products.edit', setPrice: 'products.edit', adjustStock: 'products.edit', deleteProduct: 'products.edit',
  transferStock: 'products.transfer',
  confirmDelivery: 'orders.deliver', markOrderPaid: 'orders.deliver',
  updateComplaint: 'complaints.manage',
  addPrescription: 'prescriptions.create', suggestRestocked: 'prescriptions.create',
  fulfillPrescription: 'prescriptions.fulfil',
  addStaff: 'staff.add',
  toggleStaff: (m) => (m.status === 'active' ? 'staff.suspend' : 'staff.add'),
  setDoctorAccess: (d, access) => (access === 'banned' || d.access === 'banned' ? 'doctors.ban' : 'doctors.grant'),
  sendChat: 'page.chat',
  sendAppInvite: 'clients.invite', markRegistered: 'clients.invite',
  addNews: 'news.publish', toggleNews: 'news.publish', deleteNews: 'news.publish',
  addStudent: 'academy.students', resetStudentPassword: 'academy.students', smsStudentLogin: 'academy.students',
  postAnnouncement: 'team.announce', deleteAnnouncement: 'team.announce',
  createGroup: 'team.groups', setGroupMembers: 'team.groups', deleteGroup: 'team.groups',
  sendGroupMessage: 'page.team', sendDirect: 'page.team',
  addModule: 'academy.paths', setTeachers: 'academy.paths',
  saveLesson: 'academy.teach', publishModule: 'academy.teach', addSession: 'academy.teach', setProgress: 'academy.teach', messageStudent: 'academy.teach',
  issueCertificate: 'academy.certificates',
}
for (const [name, need] of Object.entries(ACTION_PERMS)) {
  const run = actions[name]
  actions[name] = (...args) => {
    const key = typeof need === 'function' ? need(...args) : need
    if (!can(key)) return notify('You don’t have permission to do that')
    return run(...args)
  }
}
