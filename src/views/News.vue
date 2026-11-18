<script setup>
// News — GET /staff/news. Published news appears on the client Home screen in the mobile app.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { day } from '../fmt'
import FilePicker from '../components/FilePicker.vue'
import Pager from '../components/Pager.vue'

const auth = useAuth()
const canPost = computed(() => auth.can('news.create'))
const canEdit = computed(() => auth.can('news.edit'))
const canDelete = computed(() => auth.can('news.delete'))
const TAGS = ['New treatment', 'Offer', 'Academy', 'Update']
const rows = ref([])
const error = ref('')
const form = ref(null)
const busy = ref(false)

async function load() {
  try {
    const res = await api.get('/staff/news', { page: page.value, per_page: 20 })
    rows.value = res.data
    meta.value = res.meta
  } catch (e) {
    error.value = e.message
  }
}
onMounted(load)

const openNew = () => (form.value = { title: '', body: '', tag: 'Update', published: true, image: null })
const openEdit = (n) => (form.value = { id: n.id, title: n.title, body: n.body, tag: n.tag, published: n.published, image: null, image_url: n.image_url })
const toForm = (f) => {
  const fd = new FormData()
  fd.append('title', f.title.trim())
  fd.append('body', f.body)
  fd.append('tag', f.tag)
  fd.append('published', f.published ? '1' : '0')
  if (f.image) fd.append('image', f.image)
  return fd
}
async function save() {
  const f = form.value
  if (!f.title.trim() || !f.body.trim()) return
  if (!(await ask({ title: f.id ? 'Save changes?' : f.published ? 'Publish this news?' : 'Save as draft?', body: `“${f.title.trim()}”${f.published ? '\nClients see it on the app Home screen.' : ''}`, ok: f.id ? 'Save' : f.published ? 'Publish' : 'Save draft' }))) return
  busy.value = true
  try {
    const n = (f.id ? await api.post(`/staff/news/${f.id}`, toForm(f)) : await api.post('/staff/news', toForm(f))).data
    rows.value = f.id ? rows.value.map((x) => (x.id === n.id ? n : x)) : [n, ...rows.value]
    form.value = null
    notify('Saved')
  } catch (e) {
    notify(e.message)
  } finally {
    busy.value = false
  }
}
async function toggle(n) {
  const on = !n.published
  if (!(await ask({ title: on ? 'Publish this news?' : 'Unpublish this news?', body: `“${n.title}”\n${on ? 'Clients will see it in the app.' : 'Clients will no longer see it.'}`, ok: on ? 'Publish' : 'Unpublish', tone: on ? 'primary' : 'danger' }))) return
  try {
    const fd = new FormData()
    fd.append('published', on ? '1' : '0')
    const u = (await api.post(`/staff/news/${n.id}`, fd)).data
    rows.value = rows.value.map((x) => (x.id === u.id ? u : x))
  } catch (e) {
    notify(e.message)
  }
}
async function remove(n) {
  if (!(await ask({ title: 'Delete this news?', body: `“${n.title}” will be removed permanently.`, ok: 'Delete', tone: 'danger' }))) return
  try {
    await api.delete(`/staff/news/${n.id}`)
    rows.value = rows.value.filter((x) => x.id !== n.id)
  } catch (e) {
    notify(e.message)
  }
}
const page = ref(1)
const meta = ref({})
</script>

<template>
  <div class="head">
    <div>
      <h1>News</h1>
      <p>Published news appears on the client Home screen in the mobile app.</p>
    </div>
    <button v-if="canPost" class="btn gold" @click="openNew">+ Post news</button>
  </div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>

  <div class="grid g2">
    <div v-for="n in rows" :key="n.id" class="card" :style="{ opacity: n.published ? 1 : 0.65 }">
      <img v-if="n.image_url" :src="n.image_url" alt="" style="width: 100%; height: 160px; object-fit: cover; border-radius: 12px; margin-bottom: 10px" />
      <div class="row" style="justify-content: space-between">
        <span class="badge" :class="n.published ? 'active' : 'pending'">{{ n.published ? 'Live in app' : 'Draft' }}</span>
        <span class="badge">{{ n.tag }}</span>
      </div>
      <h2 style="margin-top: 10px">{{ n.title }}</h2>
      <p style="margin: 6px 0 10px; white-space: pre-line">{{ n.body }}</p>
      <p class="note">{{ day(n.published_at ?? n.created_at) }}<template v-if="n.author"> · by {{ n.author }}</template></p>
      <div v-if="canEdit || canDelete" class="row" style="margin-top: 12px">
        <button v-if="canEdit" class="btn sm" :class="n.published ? 'ghost' : 'gold'" @click="toggle(n)">{{ n.published ? 'Unpublish' : 'Publish' }}</button>
        <button v-if="canEdit" class="btn ghost sm" @click="openEdit(n)">Edit</button>
        <button v-if="canDelete" class="btn danger sm" @click="remove(n)">Delete</button>
      </div>
    </div>
    <p v-if="!rows.length" class="empty card">No news yet.</p>
    <Pager :meta="meta" label="posts" @go="(n) => { page = n; load() }" />
  </div>

  <div v-if="form" class="modal-bg" @click.self="form = null">
    <form class="modal" @submit.prevent="save">
      <h2>{{ form.id ? 'Edit news' : 'Post news' }}</h2>
      <label>Title</label><input v-model="form.title" required placeholder="e.g. New treatment at Adama" />
      <label>Message</label><textarea v-model="form.body" rows="4" required placeholder="What should clients know?"></textarea>
      <label>Tag</label><select v-model="form.tag"><option v-for="t in TAGS" :key="t">{{ t }}</option></select>
      <label>Picture <small class="note">(optional)</small></label>
      <FilePicker v-model="form.image" accept="image/*" :current="form.image_url ?? ''" title="Add a cover picture" hint="Wide picture (landscape) · JPG, PNG or WebP · up to 4 MB" :max-mb="4" />
      <label class="row" style="margin-top: 14px; color: var(--ink)"><input v-model="form.published" type="checkbox" style="width: auto" /> Show in the mobile app</label>
      <div class="row" style="margin-top: 18px; justify-content: flex-end">
        <button type="button" class="btn ghost" @click="form = null">Cancel</button>
        <button class="btn gold" :disabled="busy">{{ form.id ? 'Save' : form.published ? 'Publish' : 'Save draft' }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
label { display: block; font-size: 13px; margin: 10px 0 4px; }
textarea { width: 100%; }
</style>
