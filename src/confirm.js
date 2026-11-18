// One confirmation dialog for the whole portal.
//   if (!(await ask({ title: 'Decline this booking?', body: '…', ok: 'Decline', tone: 'danger' }))) return
// tone: 'primary' (teal) for ordinary actions, 'danger' (red) for anything destructive or hard to undo.
import { reactive } from 'vue'

export const dialog = reactive({ open: false, title: '', body: '', ok: 'Confirm', cancel: 'Cancel', tone: 'primary', resolve: null })

export function ask({ title, body = '', ok = 'Confirm', cancel = 'Cancel', tone = 'primary' }) {
  dialog.resolve?.(false) // a newer question replaces an unanswered one
  return new Promise((resolve) => Object.assign(dialog, { open: true, title, body, ok, cancel, tone, resolve }))
}

export function answer(yes) {
  const resolve = dialog.resolve
  dialog.open = false
  dialog.resolve = null
  resolve?.(yes)
}
