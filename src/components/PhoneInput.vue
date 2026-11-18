<script setup>
// Phone number with a country-code dropdown. v-model is the full international number (+251911223344);
// an Ethiopian number typed with the leading 0 (0911…) is accepted too.
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  required: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const COUNTRIES = [
  ['ET', '🇪🇹', 'Ethiopia', '251', '911 22 33 44'],
  ['KE', '🇰🇪', 'Kenya', '254', '712 345 678'],
  ['DJ', '🇩🇯', 'Djibouti', '253', '77 12 34 56'],
  ['ER', '🇪🇷', 'Eritrea', '291', '7 123 456'],
  ['SO', '🇸🇴', 'Somalia', '252', '61 234 5678'],
  ['SD', '🇸🇩', 'Sudan', '249', '91 234 5678'],
  ['SS', '🇸🇸', 'South Sudan', '211', '912 345 678'],
  ['UG', '🇺🇬', 'Uganda', '256', '712 345 678'],
  ['TZ', '🇹🇿', 'Tanzania', '255', '712 345 678'],
  ['RW', '🇷🇼', 'Rwanda', '250', '781 234 567'],
  ['EG', '🇪🇬', 'Egypt', '20', '100 123 4567'],
  ['ZA', '🇿🇦', 'South Africa', '27', '71 234 5678'],
  ['NG', '🇳🇬', 'Nigeria', '234', '802 123 4567'],
  ['SA', '🇸🇦', 'Saudi Arabia', '966', '51 234 5678'],
  ['AE', '🇦🇪', 'United Arab Emirates', '971', '50 123 4567'],
  ['QA', '🇶🇦', 'Qatar', '974', '3312 3456'],
  ['KW', '🇰🇼', 'Kuwait', '965', '500 12345'],
  ['BH', '🇧🇭', 'Bahrain', '973', '3600 1234'],
  ['OM', '🇴🇲', 'Oman', '968', '9212 3456'],
  ['LB', '🇱🇧', 'Lebanon', '961', '71 123 456'],
  ['IL', '🇮🇱', 'Israel', '972', '50 234 5678'],
  ['TR', '🇹🇷', 'Turkey', '90', '501 234 5678'],
  ['GB', '🇬🇧', 'United Kingdom', '44', '7400 123456'],
  ['DE', '🇩🇪', 'Germany', '49', '1512 3456789'],
  ['FR', '🇫🇷', 'France', '33', '6 12 34 56 78'],
  ['IT', '🇮🇹', 'Italy', '39', '312 345 6789'],
  ['NL', '🇳🇱', 'Netherlands', '31', '6 12345678'],
  ['SE', '🇸🇪', 'Sweden', '46', '70 123 45 67'],
  ['NO', '🇳🇴', 'Norway', '47', '406 12 345'],
  ['US', '🇺🇸', 'United States / Canada', '1', '201 555 0123'],
  ['CN', '🇨🇳', 'China', '86', '131 2345 6789'],
  ['IN', '🇮🇳', 'India', '91', '81234 56789'],
]

const code = ref('251')
const local = ref('')

// Split an existing value (+254712345678 or 0911…) into country + local number.
function parse(v) {
  const s = String(v ?? '').trim()
  if (!s) return ['251', '']
  const digits = s.replace(/\D/g, '')
  if (s.startsWith('+') || (digits.startsWith('251') && digits.length === 12)) {
    const c = [...COUNTRIES].sort((a, b) => b[3].length - a[3].length).find((x) => digits.startsWith(x[3]))
    if (c) return [c[3], digits.slice(c[3].length)]
    return ['251', digits]
  }
  return ['251', digits.replace(/^0/, '')]
}

const full = () => {
  const d = local.value.replace(/\D/g, '').replace(/^0+/, '')
  return d ? `+${code.value}${d}` : ''
}

watch(() => props.modelValue, (v) => {
  if (v === full()) return
  ;[code.value, local.value] = parse(v)
}, { immediate: true })

const update = () => emit('update:modelValue', full())
const example = () => COUNTRIES.find((c) => c[3] === code.value)?.[4] ?? ''
</script>

<template>
  <div class="phone-in">
    <select v-model="code" aria-label="Country code" @change="update">
      <option v-for="c in COUNTRIES" :key="c[0]" :value="c[3]">{{ c[1] }} +{{ c[3] }} · {{ c[2] }}</option>
    </select>
    <span class="cc">{{ COUNTRIES.find((c) => c[3] === code)?.[1] }} +{{ code }}</span>
    <input v-model="local" inputmode="tel" autocomplete="tel-national" :required="required" :placeholder="placeholder || example()" @input="update" />
  </div>
</template>

<style scoped>
.phone-in { position: relative; display: flex; align-items: stretch; border: 1px solid var(--line); border-radius: 10px; background: #fff; overflow: hidden; }
.phone-in:focus-within { border-color: var(--dark); box-shadow: 0 0 0 3px rgba(10, 115, 121, .12); }
/* The native select sits invisibly over the visible "🇪🇹 +251" chip, so the list shows full country names. */
.phone-in select { position: absolute; left: 0; top: 0; bottom: 0; width: 104px; opacity: 0; cursor: pointer; z-index: 1; }
.phone-in .cc { display: flex; align-items: center; gap: 4px; width: 104px; flex: none; padding: 0 10px 0 12px; border-right: 1px solid var(--line); background: #faf9f8; font-size: 14px; white-space: nowrap; }
.phone-in .cc::after { content: '▾'; margin-left: auto; color: var(--muted); font-size: 11px; }
.phone-in input { flex: 1; min-width: 0; border: 0 !important; box-shadow: none !important; outline: 0; border-radius: 0; background: transparent; }
</style>
