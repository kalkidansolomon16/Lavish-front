<script setup>
// A client's name that opens the client drawer (GET /staff/clients/{id}).
import { ui } from '../ui'
defineProps({ id: Number, name: String })
</script>

<template>
  <a class="link" @click.stop="ui.drawerClient = id">{{ name ?? 'Client' }}</a>
</template>
