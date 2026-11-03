// Role hierarchy + permission catalogue. The live grants are kept in store.js (state.perms).
// When the backend exists, these become Laravel policies / a role_permissions table.

// Lower number = higher in the hierarchy. A role can only manage roles below it.
export const LEVEL = { ceo: 1, gm: 2, reception: 3, ecommerce: 3, doctor: 3, teacher: 3 }

// `only` = the permission makes sense for these roles only (personal pages / clinical actions).
export const PERMISSIONS = [
  { group: 'Pages', items: [
    { key: 'page.appointments', label: 'Appointments' },
    { key: 'page.payments', label: 'Payments' },
    { key: 'page.clients', label: 'Clients' },
    { key: 'page.products', label: 'Products & inventory' },
    { key: 'page.orders', label: 'Orders' },
    { key: 'page.prescriptions', label: 'Prescriptions' },
    { key: 'page.complaints', label: 'Complaints' },
    { key: 'page.academy', label: 'Academy' },
    { key: 'page.staff', label: 'Staff' },
    { key: 'page.news', label: 'News' },
    { key: 'page.permissions', label: 'Permissions' },
    { key: 'page.chat', label: 'Patient chat', only: ['doctor'] },
    { key: 'page.schedule', label: 'Class schedule', only: ['teacher'] },
    { key: 'page.modules', label: 'Modules', only: ['teacher'] },
    { key: 'page.students', label: 'My students', only: ['teacher'] },
  ] },
  { group: 'Appointments & clients', items: [
    { key: 'appointments.approve', label: 'Approve, assign & decline bookings · walk-in / phone booking' },
    { key: 'appointments.complete', label: 'Mark treatments as done', only: ['doctor'] },
    { key: 'clients.history', label: 'Record & edit client medical history' },
    { key: 'clients.invite', label: 'Send app links & mark clients registered' },
  ] },
  { group: 'Money', items: [
    { key: 'finance.revenue', label: 'See revenue, prices, client spend & stock value' },
    { key: 'payments.collect', label: 'Collect & record treatment payments' },
  ] },
  { group: 'Products & orders', items: [
    { key: 'products.edit', label: 'Add products, set prices, receive & adjust stock' },
    { key: 'products.transfer', label: 'Transfer stock between branches' },
    { key: 'orders.deliver', label: 'Confirm deliveries & mark orders paid' },
  ] },
  { group: 'Prescriptions', items: [
    { key: 'prescriptions.create', label: 'Write prescriptions & suggest restocked products', only: ['doctor'] },
    { key: 'prescriptions.fulfil', label: 'Turn prescriptions into orders' },
  ] },
  { group: 'Complaints & news', items: [
    { key: 'complaints.manage', label: 'Reply to & resolve complaints' },
    { key: 'news.publish', label: 'Post, publish & delete news' },
  ] },
  { group: 'Academy', items: [
    { key: 'academy.paths', label: 'Edit learning paths & teacher access' },
    { key: 'academy.students', label: 'Enrol students & reset their app passwords' },
    { key: 'academy.certificates', label: 'Issue certificates' },
    { key: 'academy.teach', label: 'Teach: lessons, classes, grading & student chat', only: ['teacher'] },
  ] },
  { group: 'Staff & access', items: [
    { key: 'staff.add', label: 'Add staff & reactivate accounts' },
    { key: 'staff.suspend', label: 'Suspend staff accounts' },
    { key: 'doctors.grant', label: 'Give doctors portal access' },
    { key: 'doctors.ban', label: 'Ban & reinstate doctors' },
    { key: 'permissions.manage', label: 'Change permissions of lower roles' },
  ] },
]

export const ALL_KEYS = PERMISSIONS.flatMap((g) => g.items.map((i) => i.key))
export const applies = (key, role) => {
  const p = PERMISSIONS.flatMap((g) => g.items).find((i) => i.key === key)
  return !p?.only || p.only.includes(role)
}

// Starting grants — what each portal could do before permissions were configurable.
// The CEO always has every permission that applies to them; that row can't be edited.
export const DEFAULT_PERMS = {
  ceo: ALL_KEYS.filter((k) => applies(k, 'ceo')),
  gm: ['page.complaints', 'page.products', 'page.staff', 'page.academy', 'page.news', 'page.permissions',
    'products.transfer', 'complaints.manage', 'news.publish', 'academy.paths', 'academy.certificates',
    'staff.add', 'doctors.grant', 'permissions.manage'],
  reception: ['page.appointments', 'page.clients', 'page.payments',
    'appointments.approve', 'clients.history', 'clients.invite', 'finance.revenue', 'payments.collect'],
  ecommerce: ['page.products', 'page.orders', 'page.prescriptions', 'products.edit', 'orders.deliver', 'prescriptions.fulfil'],
  doctor: ['page.appointments', 'page.clients', 'page.prescriptions', 'page.chat', 'appointments.complete', 'prescriptions.create'],
  teacher: ['page.schedule', 'page.modules', 'page.students', 'academy.teach'],
}

// Sidebar order.
export const PAGES = ['dashboard', 'appointments', 'payments', 'clients', 'chat', 'products', 'orders', 'prescriptions', 'complaints', 'academy', 'staff', 'news', 'schedule', 'modules', 'students', 'permissions']
