<script setup>
import { ref } from 'vue'
import { state, actions, can } from '../store'

const TAGS = ['New treatment', 'Offer', 'Academy', 'Announcement']
const open = ref(false)
const blank = () => ({ title: '', body: '', tag: 'Announcement', published: true })
const form = ref(blank())
function save() {
  if (!form.value.title.trim()) return
  actions.addNews({ ...form.value })
  form.value = blank()
  open.value = false
}
</script>

<template>
  <div class="head">
    <div>
      <h1>News</h1>
      <p>Published news appears on the client Home screen in the mobile app. Posting needs the “Post news” permission.</p>
    </div>
    <button v-if="can('news.publish')" class="btn gold" @click="open = true">+ Post news</button>
  </div>

  <div class="grid g2">
    <div v-for="n in state.news" :key="n.id" class="card" :style="{ opacity: n.published ? 1 : 0.65 }">
      <div class="row" style="justify-content: space-between">
        <span class="badge" :class="n.published ? 'active' : 'pending'">{{ n.published ? 'Live in app' : 'Draft' }}</span>
        <span class="badge">{{ n.tag }}</span>
      </div>
      <h2 style="margin-top: 10px">{{ n.title }}</h2>
      <p style="margin: 6px 0 10px">{{ n.body }}</p>
      <p class="note">{{ n.date }} · by {{ n.by }}</p>
      <div v-if="can('news.publish')" class="row" style="margin-top: 12px">
        <button class="btn sm" :class="n.published ? 'ghost' : 'gold'" @click="actions.toggleNews(n)">{{ n.published ? 'Unpublish' : 'Publish' }}</button>
        <button class="btn danger sm" @click="actions.deleteNews(n)">Delete</button>
      </div>
    </div>
  </div>

  <div v-if="open" class="modal-bg" @click.self="open = false">
    <form class="modal" @submit.prevent="save">
      <h2>Post news</h2>
      <label>Title</label><input v-model="form.title" required placeholder="e.g. New treatment at Adama" />
      <label>Message</label><textarea v-model="form.body" rows="4" placeholder="What should clients know?"></textarea>
      <label>Tag</label><select v-model="form.tag"><option v-for="t in TAGS" :key="t">{{ t }}</option></select>
      <label class="row" style="margin-top: 14px; color: var(--ink)"><input v-model="form.published" type="checkbox" style="width: auto" /> Publish to the mobile app now</label>
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button type="button" class="btn ghost" @click="open = false">Cancel</button>
        <button class="btn gold">{{ form.published ? 'Publish' : 'Save draft' }}</button>
      </div>
    </form>
  </div>
</template>
