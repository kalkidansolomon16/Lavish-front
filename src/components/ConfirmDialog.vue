<script setup>
// Shared "are you sure?" dialog. Opened with ask() from ../confirm.js.
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { dialog, answer } from '../confirm'

const okBtn = ref(null)
const cancelBtn = ref(null)
// Destructive questions start on "Cancel", so a stray Enter can't delete, decline or sign out.
watch(() => dialog.open, async (open) => {
  if (!open) return
  await nextTick()
  ;(dialog.tone === 'danger' ? cancelBtn : okBtn).value?.focus()
})

const onKey = (e) => {
  if (!dialog.open) return
  if (e.key === 'Escape') { e.preventDefault(); answer(false) }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="cd">
      <div v-if="dialog.open" class="cd-bg" @click.self="answer(false)">
        <div class="cd" :class="dialog.tone" role="alertdialog" aria-modal="true" aria-labelledby="cd-title" aria-describedby="cd-body">
          <div class="cd-icon" aria-hidden="true">
            <svg v-if="dialog.tone === 'danger'" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            <svg v-else viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
          </div>
          <h3 id="cd-title">{{ dialog.title }}</h3>
          <p v-if="dialog.body" id="cd-body">{{ dialog.body }}</p>
          <div class="cd-actions">
            <button ref="cancelBtn" type="button" class="cd-cancel" @click="answer(false)">{{ dialog.cancel }}</button>
            <button ref="okBtn" type="button" class="cd-ok" @click="answer(true)">{{ dialog.ok }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cd-bg { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: rgba(23, 19, 15, .5); backdrop-filter: blur(3px); }
.cd { --c: var(--dark); --soft: #e6f2f1; width: min(420px, 100%); padding: 26px 26px 20px; border-radius: 18px; background: var(--card); box-shadow: 0 30px 70px -20px rgba(0, 0, 0, .45); text-align: center; }
.cd.danger { --c: var(--bad); --soft: #f8e7e5; }
.cd-icon { display: grid; place-items: center; width: 48px; height: 48px; margin: 0 auto 14px; border-radius: 50%; background: var(--soft); color: var(--c); }
.cd h3 { margin: 0; font: 600 21px/1.25 'EB Garamond', serif; color: var(--ink); }
.cd p { margin: 8px 0 0; font-size: 14px; line-height: 1.55; color: var(--muted); white-space: pre-line; }
.cd-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 22px; }
.cd-actions button { padding: 10px 14px; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; transition: filter .15s, background .15s; }
.cd-cancel { border: 1px solid var(--line); background: #fff; color: var(--ink); }
.cd-cancel:hover { background: #f6f5f4; }
.cd-ok { border: 1px solid var(--c); background: var(--c); color: #fff; }
.cd-ok:hover { filter: brightness(1.08); }
.cd-ok:focus-visible, .cd-cancel:focus-visible { outline: 3px solid color-mix(in srgb, var(--c) 35%, transparent); outline-offset: 2px; }

.cd-enter-active, .cd-leave-active { transition: opacity .18s ease; }
.cd-enter-active .cd, .cd-leave-active .cd { transition: transform .2s cubic-bezier(.2, .7, .2, 1); }
.cd-enter-from, .cd-leave-to { opacity: 0; }
.cd-enter-from .cd, .cd-leave-to .cd { transform: translateY(10px) scale(.97); }
</style>
