<script setup>
// Drop zone for photos and documents: click or drag a file in, see a preview, change or remove it.
//   v-model   the chosen File (or null)
//   current   URL of the photo already saved (edit forms) — shown until a new file is picked
//   accept    e.g. "image/*" or "image/*,application/pdf"
import { ref, computed, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: null },
  accept: { type: String, default: 'image/*' },
  current: { type: String, default: '' },
  title: { type: String, default: '' },
  hint: { type: String, default: '' },
  maxMb: { type: Number, default: 5 },
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'error'])

const input = ref(null)
const over = ref(false)
const error = ref('')
const preview = ref('')
const removedCurrent = ref(false)

const imagesOnly = computed(() => props.accept.split(',').every((a) => a.trim().startsWith('image/')))
const file = computed(() => props.modelValue)
const isImage = computed(() => (file.value ? file.value.type?.startsWith('image/') : !!props.current && !removedCurrent.value))
const shownUrl = computed(() => (file.value ? preview.value : removedCurrent.value ? '' : props.current))
const kind = computed(() => {
  const n = file.value?.name?.toLowerCase() ?? ''
  return n.endsWith('.pdf') ? 'PDF' : n.endsWith('.csv') ? 'CSV' : n.endsWith('.txt') ? 'TXT' : 'FILE'
})
const size = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB')
const defaultTitle = computed(() => props.title || (imagesOnly.value ? 'Add a photo' : 'Add a file'))
const defaultHint = computed(() => props.hint || `${imagesOnly.value ? 'JPG, PNG or WebP' : props.accept.includes('pdf') ? 'Photo or PDF' : 'File'} · up to ${props.maxMb} MB`)

watch(file, (f) => {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = f && f.type?.startsWith('image/') ? URL.createObjectURL(f) : ''
}, { immediate: true })
onBeforeUnmount(() => preview.value && URL.revokeObjectURL(preview.value))

function matches(f) {
  return props.accept.split(',').map((a) => a.trim().toLowerCase()).some((a) =>
    a.endsWith('/*') ? f.type.startsWith(a.slice(0, -1)) : a.startsWith('.') ? f.name.toLowerCase().endsWith(a) : f.type === a)
}
function take(f) {
  error.value = ''
  if (!f) return
  if (!matches(f)) { error.value = `That file type isn’t allowed here (${defaultHint.value.split(' ·')[0]}).`; return emit('error', error.value) }
  if (f.size > props.maxMb * 1048576) { error.value = `That file is ${size(f.size)} — the limit is ${props.maxMb} MB.`; return emit('error', error.value) }
  emit('update:modelValue', f)
}
const pick = (e) => { take(e.target.files?.[0]); e.target.value = '' }
const drop = (e) => { over.value = false; take(e.dataTransfer.files?.[0]) }
const browse = () => input.value?.click()
function clear() {
  if (file.value) emit('update:modelValue', null)
  else removedCurrent.value = true
}
</script>

<template>
  <div class="fp" :class="{ over, has: file || shownUrl, compact }"
    @dragenter.prevent="over = true" @dragover.prevent="over = true" @dragleave.prevent="over = false" @drop.prevent="drop">
    <input ref="input" type="file" :accept="accept" hidden @change="pick" />

    <!-- empty -->
    <button v-if="!file && !shownUrl" type="button" class="fp-empty" @click="browse">
      <span class="fp-icon" aria-hidden="true">
        <svg v-if="imagesOnly" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></svg>
        <svg v-else viewBox="0 0 24 24"><path d="M12 16V4m0 0-4 4m4-4 4 4" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
      </span>
      <b>{{ over ? 'Drop it here' : defaultTitle }}</b>
      <small>Drag &amp; drop or <u>browse</u> · {{ defaultHint }}</small>
    </button>

    <!-- image preview -->
    <div v-else-if="isImage && shownUrl" class="fp-photo">
      <img :src="shownUrl" alt="" />
      <div class="fp-bar">
        <span>{{ file ? `${file.name} · ${size(file.size)}` : 'Current photo' }}</span>
        <span class="fp-acts"><button type="button" @click="browse">Change</button><button v-if="file" type="button" class="rm" @click="clear">Remove</button></span>
      </div>
    </div>

    <!-- document -->
    <div v-else class="fp-doc">
      <span class="fp-badge">{{ kind }}</span>
      <span class="fp-name"><b>{{ file?.name ?? 'Current file' }}</b><small v-if="file">{{ size(file.size) }}</small></span>
      <span class="fp-acts"><button type="button" @click="browse">Change</button><button type="button" class="rm" @click="clear">Remove</button></span>
    </div>

    <p v-if="error" class="fp-err">{{ error }}</p>
  </div>
</template>

<style scoped>
.fp { position: relative; }
.fp-empty {
  width: 100%; display: grid; justify-items: center; gap: 6px; padding: 22px 16px; cursor: pointer;
  border: 1.5px dashed #cfd8d6; border-radius: 14px; background: linear-gradient(180deg, #fbfaf9, #f5f8f7);
  color: var(--ink, #222); text-align: center; transition: border-color .2s, background .2s, transform .2s;
}
.fp.compact .fp-empty { padding: 14px; grid-template-columns: auto 1fr; justify-items: start; text-align: left; column-gap: 12px; row-gap: 2px; }
.fp.compact .fp-empty .fp-icon { grid-row: span 2; width: 40px; height: 40px; }
.fp-empty:hover, .fp.over .fp-empty { border-color: var(--dark, #0a7379); background: #eef6f5; }
.fp.over .fp-empty { transform: scale(1.01); }
.fp-icon { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 14px; background: #e3f0ee; color: var(--teal-deep, #06484c); transition: transform .2s; }
.fp-empty:hover .fp-icon { transform: translateY(-2px); }
.fp-icon svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.fp-empty b { font-weight: 500; font-size: 14px; }
.fp-empty small { color: var(--muted, #777); font-size: 12px; }
.fp-empty u { color: var(--teal-deep, #06484c); text-decoration-color: #9cc9c4; text-underline-offset: 2px; }

.fp-photo { position: relative; border-radius: 14px; overflow: hidden; border: 1px solid var(--line, #e6e4e1); background: #f3f2f0; }
.fp-photo img { display: block; width: 100%; height: 180px; object-fit: cover; }
.fp.compact .fp-photo img { height: 120px; }
.fp-bar { position: absolute; inset: auto 0 0 0; display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 26px 12px 10px; background: linear-gradient(transparent, rgba(0, 0, 0, .62)); color: #fff; font-size: 12px; }
.fp-bar > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fp-acts { display: flex; gap: 6px; flex: none; }
.fp-acts button { padding: 5px 11px; border-radius: 99px; border: 0; background: rgba(255, 255, 255, .92); color: #222; font-size: 12px; cursor: pointer; }
.fp-acts button:hover { background: #fff; }
.fp-acts .rm { color: var(--bad, #b8483f); }

.fp-doc { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--line, #e6e4e1); border-radius: 14px; background: #fff; }
.fp-badge { display: grid; place-items: center; width: 42px; height: 48px; border-radius: 8px; background: #f8e7e5; color: var(--bad, #b8483f); font-size: 11px; font-weight: 700; letter-spacing: .5px; flex: none; }
.fp-name { flex: 1; min-width: 0; display: grid; }
.fp-name b { font-weight: 500; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fp-name small { color: var(--muted, #777); font-size: 12px; }
.fp-doc .fp-acts button { background: #f3f2f0; }
.fp-err { margin: 6px 0 0; font-size: 12.5px; color: var(--bad, #b8483f); }
</style>
