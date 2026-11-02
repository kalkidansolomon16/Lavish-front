<script setup>
import { computed } from 'vue'
const props = defineProps({ data: Array, money: Boolean })
const max = computed(() => Math.max(...props.data.map((d) => d.value)) * 1.15)
const fmt = (v) => (props.money ? (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) : v)
</script>

<template>
  <svg viewBox="0 0 400 190" class="chart">
    <g v-for="g in 4" :key="g">
      <line x1="0" x2="400" :y1="150 - g * 35" :y2="150 - g * 35" stroke="#e2e1df" stroke-dasharray="3 4" />
    </g>
    <g v-for="(d, i) in data" :key="d.label" class="bar">
      <rect :x="i * (400 / data.length) + 10" :width="400 / data.length - 20" :y="150 - (d.value / max) * 140" :height="(d.value / max) * 140" rx="6"
            :fill="i === data.length - 1 ? '#cba590' : '#0a7379'" />
      <text :x="i * (400 / data.length) + 200 / data.length" :y="143 - (d.value / max) * 140" text-anchor="middle" font-size="10" fill="#262626">{{ fmt(d.value) }}</text>
      <text :x="i * (400 / data.length) + 200 / data.length" y="170" text-anchor="middle" font-size="11" fill="#808285">{{ d.label }}</text>
    </g>
  </svg>
</template>

<style>
.chart { width: 100%; height: auto; }
.chart .bar rect { transition: .5s; }
.chart .bar:hover rect { opacity: .8; }
</style>
