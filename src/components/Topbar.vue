<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ui, visibleNotifs } from '../ui'

const router = useRouter()
const list = computed(() => visibleNotifs())
const unread = computed(() => list.value.filter((n) => !n.read).length)
const open = (n) => { n.read = true; ui.bell = false; router.push(n.to) }
const readAll = () => list.value.forEach((n) => (n.read = true))
</script>

<template>
  <div class="topbar">
    <button class="search" @click="ui.palette = true">🔍 Search clients, doctors, products… <kbd>Ctrl K</kbd></button>
    <div class="row">
      <div class="lang">
        <button :class="{ on: ui.lang === 'en' }" @click="ui.lang = 'en'">EN</button>
        <button :class="{ on: ui.lang === 'am' }" @click="ui.lang = 'am'">አማ</button>
      </div>
      <div class="bell-wrap">
        <button class="bell" @click="ui.bell = !ui.bell">🔔<i v-if="unread">{{ unread }}</i></button>
        <div v-if="ui.bell" class="bell-menu">
          <div class="row" style="justify-content: space-between; padding: 12px 16px">
            <b class="serif" style="font-size: 18px">Notifications</b>
            <a class="link" @click="readAll">Mark all read</a>
          </div>
          <button v-for="n in list" :key="n.id" :class="{ unread: !n.read }" @click="open(n)">
            {{ n.text }}<small>{{ n.time }}</small>
          </button>
          <p v-if="!list.length" class="empty">You're all caught up</p>
        </div>
      </div>
    </div>
  </div>
</template>
