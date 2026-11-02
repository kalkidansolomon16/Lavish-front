<script setup>
import { clientName } from '../store'
import { ui } from '../ui'
defineProps({ id: Number })
</script>

<template>
  <a class="link" @click.stop="ui.drawerClient = id">{{ clientName(id) }}</a>
</template>
