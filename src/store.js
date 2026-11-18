// App-wide UI state that isn't server data: the toast message and a copy of the signed-in user.
// All business data comes from the Lavish API (src/api/http.js); there is no sample data in the portal.
import { reactive } from 'vue'

export const state = reactive({
  user: null, // { id, name, role, label, doctorId } — mirrors the auth store (see main.js)
  toast: '',
})

let toastTimer
export function notify(msg) {
  state.toast = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (state.toast = ''), 2600)
}

// Copies the API user (GET /auth/me) into state.user.
export function syncUser(u) {
  state.user = u ? { id: u.id, name: u.name, role: u.portal?.key ?? 'staff', label: u.portal?.label ?? 'Staff', doctorId: u.doctor_id } : null
}
