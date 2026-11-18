<script setup>
// Double-points days, holiday offers and targeted offers by treatment or tier. A campaign can also send
// members an app notice when it starts (sent once, by the scheduler).
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api/http'
import { useAuth } from '../../stores/auth'
import { ask } from '../../confirm'
import { notify } from '../../store'
import { when } from '../../fmt'

const auth = useAuth()
const edit = computed(() => auth.can('rewards.manage'))
const data = ref(null)
const services = ref([])
const form = ref(null)
const error = ref('')

const load = async () => (data.value = (await api.get('/staff/rewards/settings')).data)
onMounted(async () => {
  await load().catch((e) => (error.value = e.message))
  services.value = (await api.get('/catalog/services').catch(() => ({ data: [] }))).data
})

const status = (c) => (!c.active ? 'off' : new Date(c.ends_at) < new Date() ? 'ended' : new Date(c.starts_at) > new Date() ? 'scheduled' : 'running')
const STATUS = { running: ['Running now', 'paid'], scheduled: ['Scheduled', 'pending'], ended: ['Ended', 'declined'], off: ['Switched off', 'declined'] }
const target = (c) => [
  c.service_ids?.length ? services.value.filter((s) => c.service_ids.includes(s.id)).map((s) => s.name).join(', ') : 'All treatments',
  c.tier_ids?.length ? data.value.tiers.filter((t) => c.tier_ids.includes(t.id)).map((t) => t.name).join(', ') + ' members' : 'every member',
].join(' · ')

const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16)
function openNew() {
  const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() + 1)
  const e = new Date(s); e.setDate(e.getDate() + 1); e.setMinutes(-1)
  form.value = { name: 'Double points day', description: '', multiplier: 2, starts_at: local(s), ends_at: local(e), service_ids: [], tier_ids: [], active: true, notify_members: false, notice_title: '', notice_body: '' }
}
const openEdit = (c) => (form.value = { ...c, notice_title: c.notice_title ?? '', notice_body: c.notice_body ?? '', starts_at: local(new Date(c.starts_at)), ends_at: local(new Date(c.ends_at)), service_ids: c.service_ids ?? [], tier_ids: c.tier_ids ?? [] })

async function save() {
  const f = form.value
  if (!(await ask({ title: f.id ? 'Save campaign?' : 'Schedule this campaign?', body: `${f.name}: ${f.multiplier}× points\n${when(f.starts_at)} → ${when(f.ends_at)}${f.notify_members ? '\nMembers get an app notice when it starts.' : ''}`, ok: 'Save' }))) return
  try {
    const body = { ...f, notice_title: f.notice_title || null, notice_body: f.notice_body || null, service_ids: f.service_ids.length ? f.service_ids : null, tier_ids: f.tier_ids.length ? f.tier_ids : null }
    data.value = (f.id ? await api.patch(`/staff/rewards/campaigns/${f.id}`, body) : await api.post('/staff/rewards/campaigns', body)).data
    form.value = null
    notify('Campaign saved')
  } catch (e) {
    error.value = e.message
  }
}
async function toggle(c) {
  if (!(await ask({ title: c.active ? `Switch off “${c.name}”?` : `Switch “${c.name}” back on?`, ok: c.active ? 'Switch off' : 'Switch on', tone: c.active ? 'danger' : 'primary' }))) return
  data.value = (await api.patch(`/staff/rewards/campaigns/${c.id}`, { active: !c.active })).data
}
const pick = (list, id) => (list.includes(id) ? list.splice(list.indexOf(id), 1) : list.push(id))
</script>

<template>
  <p v-if="error" class="err">{{ error }}</p>
  <div class="hrow">
    <p class="note">Campaigns multiply the points earned on top of the member’s tier multiplier — for example 2× on chosen days or treatments, or a holiday offer for Enkutatash, Meskel, Genna, Timket or Fasika. Tick “Notify members” to send an app notice when it starts.</p>
    <button v-if="edit" class="btn gold" @click="openNew">+ New campaign</button>
  </div>
  <div v-if="data" class="camps">
    <div v-for="c in data.campaigns" :key="c.id" class="card camp" :class="status(c)">
      <div class="x"><b>{{ c.multiplier }}×</b></div>
      <div class="grow">
        <div class="t"><b>{{ c.name }}</b><span class="badge" :class="STATUS[status(c)][1]">{{ STATUS[status(c)][0] }}</span></div>
        <p class="note">{{ when(c.starts_at) }} → {{ when(c.ends_at) }}</p>
        <p class="note">{{ target(c) }}</p>
        <p v-if="c.description">{{ c.description }}</p>
        <p v-if="c.notify_members" class="note notice">🔔 {{ c.notified_at ? `Notice sent to ${c.notified_count} member${c.notified_count === 1 ? '' : 's'} · ${when(c.notified_at)}` : 'App notice will be sent to members when it starts' }}</p>
      </div>
      <div v-if="edit" class="row"><button class="btn ghost sm" @click="openEdit(c)">Edit</button><button class="btn sm" :class="c.active ? 'danger' : 'ghost'" @click="toggle(c)">{{ c.active ? 'Switch off' : 'Switch on' }}</button></div>
    </div>
    <p v-if="!data.campaigns.length" class="card empty">No campaigns yet.</p>
  </div>

  <div v-if="form" class="modal-bg" @click.self="form = null">
    <form class="modal" style="width: min(580px, 95vw); max-height: 92vh; overflow: auto" @submit.prevent="save">
      <h2>{{ form.id ? 'Edit campaign' : 'New campaign' }}</h2>
      <label>Name (shown in the app)</label><input v-model="form.name" required />
      <label>Description</label><input v-model="form.description" placeholder="e.g. Double points on every HydraFacial this weekend" />
      <div class="grid g2">
        <div><label>Points multiplier</label><input v-model.number="form.multiplier" type="number" step="0.25" min="1" max="10" required /></div>
        <div></div>
        <div><label>Starts</label><input v-model="form.starts_at" type="datetime-local" required /></div>
        <div><label>Ends</label><input v-model="form.ends_at" type="datetime-local" required /></div>
      </div>
      <label>Treatments <small class="note">(none = all)</small></label>
      <div class="pills"><button v-for="s in services" :key="s.id" type="button" :class="{ on: form.service_ids.includes(s.id) }" @click="pick(form.service_ids, s.id)">{{ s.name }}</button></div>
      <label>Tiers <small class="note">(none = every member)</small></label>
      <div class="pills"><button v-for="t in data.tiers" :key="t.id" type="button" :class="{ on: form.tier_ids.includes(t.id) }" @click="pick(form.tier_ids, t.id)">{{ t.name }}</button></div>
      <label class="chk"><input v-model="form.notify_members" type="checkbox" /> Notify members in the app when it starts</label>
      <template v-if="form.notify_members">
        <label>Notice title <small class="note">(empty = campaign name)</small></label><input v-model="form.notice_title" maxlength="120" placeholder="e.g. Melkam Fasika from Lavish!" />
        <label>Notice message <small class="note">(empty = description)</small></label><textarea v-model="form.notice_body" rows="2" maxlength="500" placeholder="e.g. Double points on every treatment until Sunday."></textarea>
        <p class="note">Sent once to {{ form.tier_ids.length ? 'members of the chosen tiers' : 'every member' }} with the app.</p>
      </template>
      <div class="row" style="justify-content: flex-end; margin-top: 16px"><button type="button" class="btn ghost" @click="form = null">Cancel</button><button class="btn gold">Save</button></div>
    </form>
  </div>
</template>

<style scoped>
.hrow { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 14px; }
.hrow .note { margin: 0; max-width: 640px; }
.camps { display: grid; gap: 12px; }
.camp { display: flex; gap: 16px; align-items: flex-start; }
.camp.ended, .camp.off { opacity: .6; }
.camp .x { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 16px; background: linear-gradient(135deg, #f3e8e1, #cba590); flex: none; }
.camp .x b { font: 600 24px 'EB Garamond', serif; color: #4a3528; }
.camp.running .x { background: linear-gradient(135deg, #12939a, #0a7379); }
.camp.running .x b { color: #fff; }
.t { display: flex; gap: 10px; align-items: center; }
.t b { font-weight: 500; font-size: 15px; }
.camp p { margin: 3px 0 0; }
.grow { flex: 1; }
label { display: block; font-size: 13px; margin: 10px 0 4px; }
.chk { display: flex; gap: 8px; align-items: center; margin-top: 16px; }
.chk input { width: auto; }
textarea { width: 100%; }
.notice { color: var(--teal-deep); }
.pills { display: flex; flex-wrap: wrap; gap: 6px; }
.pills button { padding: 5px 11px; border-radius: 99px; border: 1px solid var(--line); background: #fff; font-size: 12.5px; cursor: pointer; }
.pills button.on { border-color: var(--dark); background: #e8f3f2; color: var(--teal-deep); }
.err { padding: 10px 12px; border-radius: 10px; background: #f8e7e5; color: var(--bad); font-size: 13px; }
</style>
