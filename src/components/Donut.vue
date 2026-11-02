<script setup>
import { computed } from 'vue'
const props = defineProps({ items: Array, center: String })
const colors = ['#0a7379', '#cba590', '#6fb3b0', '#af8b77', '#9fcfca', '#895637']
const total = computed(() => props.items.reduce((t, i) => t + i.value, 0) || 1)
const R = 52, C = 2 * Math.PI * R
const arcs = computed(() => {
  let off = 0
  return props.items.map((it, i) => {
    const len = (it.value / total.value) * C
    const a = { ...it, color: it.color || colors[i % colors.length], dash: `${len} ${C - len}`, off: -off }
    off += len
    return a
  })
})
</script>

<template>
  <div class="donut">
    <svg viewBox="0 0 140 140" width="150">
      <circle cx="70" cy="70" :r="R" fill="none" stroke="#f0eeec" stroke-width="18" />
      <circle v-for="a in arcs" :key="a.label" cx="70" cy="70" :r="R" fill="none" :stroke="a.color" stroke-width="18"
              :stroke-dasharray="a.dash" :stroke-dashoffset="a.off" transform="rotate(-90 70 70)" />
      <text x="70" y="68" text-anchor="middle" font-size="26" font-family="EB Garamond" fill="#262626">{{ total }}</text>
      <text x="70" y="84" text-anchor="middle" font-size="9" fill="#808285">{{ center }}</text>
    </svg>
    <ul>
      <li v-for="a in arcs" :key="a.label"><i :style="{ background: a.color }"></i>{{ a.label }} <b>{{ a.value }}</b></li>
    </ul>
  </div>
</template>

<style>
.donut { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.donut ul { list-style: none; padding: 0; font-size: 12px; display: grid; gap: 6px; }
.donut li i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 7px; }
.donut li b { margin-left: 4px; }
</style>
