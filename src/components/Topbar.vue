<script setup>
// Search, language switch and the notification bell (real notifications from the API).
import { useRouter } from 'vue-router'
import { ui } from '../ui'
import { useNotifications, ago } from '../stores/notifications'

const router = useRouter()
const bell = useNotifications()
const open = (n) => {
  bell.read(n)
  ui.bell = false
  if (n.path) router.push(n.path)
}
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
        <button class="bell" aria-label="Notifications" @click="ui.bell = !ui.bell">🔔<i v-if="bell.unread">{{ bell.unread }}</i></button>
        <div v-if="ui.bell" class="bell-menu">
          <div class="row" style="justify-content: space-between; padding: 12px 16px">
            <b class="serif" style="font-size: 18px">Notifications</b>
            <a class="link" @click="bell.readAll()">Mark all read</a>
          </div>
          <button v-for="n in bell.items" :key="n.id" :class="{ unread: !n.read }" @click="open(n)">
            <b class="block">{{ n.title }}</b>{{ n.body }}<small>{{ ago(n.created_at) }}</small>
          </button>
          <p v-if="!bell.items.length" class="empty">You're all caught up</p>
        </div>
      </div>
    </div>
  </div>
</template>
