<script setup>
// Scan a barcode or QR code with the device camera (laptop webcam, tablet or phone) — gift cards and member cards.
// Emits `scanned` with the text, then closes. Needs https (the live portal is) and camera permission.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

defineProps({ title: { type: String, default: 'Scan with camera' } })
const emit = defineEmits(['scanned', 'close'])

const video = ref(null)
const error = ref('')
const cameras = ref([])
const cameraId = ref(null)
const typed = ref('')
// Can't scan (no camera, blurry, damaged card): type the number instead.
function useTyped() {
  const t = typed.value.trim()
  if (t.replace(/[^A-Za-z0-9]/g, '').length < 6) return
  stop()
  emit('scanned', t)
}
let controls = null
let reader = null

const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.EAN_13]], [DecodeHintType.TRY_HARDER, true]])

async function start() {
  stop()
  error.value = ''
  try {
    reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 })
    const constraints = { video: cameraId.value ? { deviceId: { exact: cameraId.value } } : { facingMode: { ideal: 'environment' } } }
    controls = await reader.decodeFromConstraints(constraints, video.value, (result) => {
      if (result) {
        stop()
        emit('scanned', result.getText())
      }
    })
    if (!cameras.value.length) {
      cameras.value = (await BrowserMultiFormatReader.listVideoInputDevices()).map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }))
    }
  } catch (e) {
    error.value = e?.name === 'NotAllowedError'
      ? 'Camera access was blocked. Click the camera icon (or the lock 🔒) at the left of the address bar → Camera → Allow, then press “Try again”.'
      : e?.name === 'NotFoundError' ? 'No camera found on this device. Use a barcode scanner or type the number.' : 'Couldn’t start the camera: ' + (e?.message ?? e)
  }
}
function stop() {
  try { controls?.stop() } catch { /* already stopped */ }
  controls = null
}
function switchCamera(id) { cameraId.value = id; start() }

onMounted(start)
onBeforeUnmount(stop)
</script>

<template>
  <!-- On top of everything on the page, wherever the button is -->
  <Teleport to="body">
  <div class="modal-bg" style="z-index: 1000" @click.self="emit('close')">
    <div class="modal scan">
      <h2>{{ title }}</h2>
      <p class="note">Hold the barcode or QR code inside the frame — it reads by itself.</p>
      <div class="cam">
        <video ref="video" muted playsinline></video>
        <span class="frame"></span>
      </div>
      <p v-if="error" class="err">{{ error }}</p>
      <form class="typed" @submit.prevent="useTyped">
        <label>Can’t scan? Type the number</label>
        <div class="row" style="gap: 8px; flex-wrap: nowrap">
          <input v-model="typed" placeholder="e.g. 9J6L-38TL-NSBX-DWL5 or LVM0000005" autocomplete="off" />
          <button class="btn gold" :disabled="typed.replace(/[^A-Za-z0-9]/g, '').length < 6">Use</button>
        </div>
      </form>
      <div class="row" style="justify-content: space-between; margin-top: 12px; gap: 8px">
        <select v-if="cameras.length > 1" :value="cameraId ?? ''" style="max-width: 60%" @change="switchCamera($event.target.value)">
          <option value="" disabled>Choose camera…</option>
          <option v-for="c in cameras" :key="c.id" :value="c.id">{{ c.label }}</option>
        </select>
        <span v-else></span>
        <div class="row" style="gap: 8px"><button v-if="error" type="button" class="btn ghost" @click="start">Try again</button><button type="button" class="btn ghost" @click="emit('close')">Close</button></div>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.scan { width: min(520px, 95vw); }
.cam { position: relative; margin-top: 12px; border-radius: 14px; overflow: hidden; background: #111; aspect-ratio: 4 / 3; }
.cam video { width: 100%; height: 100%; object-fit: cover; display: block; }
.frame { position: absolute; inset: 18% 12%; border: 3px solid rgba(255, 255, 255, .85); border-radius: 12px; box-shadow: 0 0 0 999px rgba(0, 0, 0, .35); }
.typed { margin-top: 12px; }
.typed label { display: block; font-size: 13px; margin-bottom: 4px; }
.typed input { flex: 1; font: 600 15px ui-monospace, monospace; letter-spacing: 1px; text-transform: uppercase; }
.err { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: #f8e7e5; color: var(--bad); font-size: 13px; }
</style>
