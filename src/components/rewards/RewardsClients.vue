<script setup>
// Front desk: Lavish Rewards members. Enrol a client who asks to join (existing client or a new one with their
// details), see their tier, points, every change with the balance after it, their requests to use points,
// gift cards and open bills; adjust points (managers).
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../../api/http'
import { useAuth } from '../../stores/auth'
import { ask } from '../../confirm'
import { notify } from '../../store'
import { etb, pts, day, when, TIER_COLORS } from '../../fmt'
import CheckoutDialog from '../CheckoutDialog.vue'
import Pager from '../Pager.vue'
import PhoneInput from '../PhoneInput.vue'

const auth = useAuth()
const q = ref('')
const list = ref([])
const loadingList = ref(false)
const selected = ref(null) // client id
const profile = ref(null)
const error = ref('')
const adjusting = ref(null)
const checkout = ref(null)
const branches = ref([])

async function search() {
  loadingList.value = true
  try {
    const res = await api.get('/staff/rewards/members', { q: q.value || undefined, page: listPage.value, per_page: 20 })
    list.value = res.data
    listMeta.value = res.meta
  } catch (e) {
    error.value = e.message
  } finally {
    loadingList.value = false
  }
}
let t
watch(q, () => { clearTimeout(t); t = setTimeout(search, 300) })

async function open(id) {
  selected.value = id
  profile.value = null
  error.value = ''
  try {
    profile.value = (await api.get(`/staff/rewards/clients/${id}`)).data
  } catch (e) {
    error.value = e.message
  }
}
onMounted(async () => {
  await search()
  if (list.value[0]) open(list.value[0].client.id)
  branches.value = (await api.get('/catalog/branches').catch(() => ({ data: [] }))).data
})

const r = computed(() => profile.value?.rewards)
const tierColor = computed(() => TIER_COLORS[r.value?.tier?.key] ?? 'var(--dark)')
const ICON = { earn: '＋', redeem: '−', expire: '⌛', adjust: '✎', reverse: '↺' }
const REQ = { pending: ['New', 'new'], forwarded: ['With e-commerce', 'pending'], completed: ['Done', 'paid'], rejected: ['Not approved', 'declined'], cancelled: ['Cancelled', 'cancelled'] }

async function join() {
  const c = profile.value.client
  if (!(await ask({ title: `Enrol ${c.name} in Lavish Rewards?`, body: 'They start collecting points on completed, paid visits and shop orders, and can use them from the app.', ok: 'Enrol' }))) return
  try {
    profile.value = (await api.post(`/staff/rewards/clients/${c.id}/join`)).data
    notify(`${c.name} is now a Lavish Rewards member`)
    search()
  } catch (e) { error.value = e.message }
}

// ---- enrol a client who asked to join
const enrolling = ref(null)
const found = ref([])
function openEnrol() {
  enrolling.value = { mode: 'existing', term: '', client: null, name: '', phone: '', email: '', gender: '', date_of_birth: '', preferred_branch_id: '', note: '', error: '' }
  found.value = []
}
let ft
function findClients() {
  clearTimeout(ft)
  const term = enrolling.value.term.trim()
  enrolling.value.client = null
  ft = setTimeout(async () => {
    found.value = term.length < 2 ? [] : (await api.get('/staff/rewards/members', { q: term, per_page: 8 }, { background: true }).catch(() => ({ data: [] }))).data
  }, 250)
}
async function enrol() {
  const e = enrolling.value
  e.error = ''
  const existing = e.mode === 'existing'
  if (existing && !e.client) { e.error = 'Search and choose the client.'; return }
  if (existing && e.client.member) { e.error = `${e.client.client.name} is already a member.`; return }
  const name = existing ? e.client.client.name : e.name.trim()
  if (!(await ask({ title: `Enrol ${name} in Lavish Rewards?`, body: 'They start collecting points on completed, paid visits and shop orders, and can see and use them in the Lavish app.' + (existing ? '' : '\nA client record is created; when they sign up in the app with this phone they see their points.'), ok: 'Enrol' }))) return
  try {
    const body = existing ? { client_id: e.client.client.id, note: e.note || undefined }
      : { client: { name, phone: e.phone, email: e.email || undefined, gender: e.gender || undefined, date_of_birth: e.date_of_birth || undefined, preferred_branch_id: e.preferred_branch_id || undefined }, note: e.note || undefined }
    const res = await api.post('/staff/rewards/enrol', body)
    profile.value = res.data
    selected.value = res.data.client.id
    enrolling.value = null
    notify(`${name} is now a Lavish Rewards member`)
    q.value = ''
    search()
  } catch (err) { e.error = err.message }
}

async function saveAdjust() {
  const a = adjusting.value
  const n = Math.trunc(Number(a.points)) * (a.sign === '-' ? -1 : 1)
  if (!n || !a.reason.trim()) return
  const c = profile.value.client
  if (!(await ask({ title: n > 0 ? `Add ${pts(n)}?` : `Remove ${pts(-n)}?`, body: `${c.name}\nReason: ${a.reason.trim()}\n\nThis change is written to the audit log.`, ok: n > 0 ? 'Add points' : 'Remove points', tone: n > 0 ? 'primary' : 'danger' }))) return
  try {
    profile.value = (await api.post(`/staff/rewards/clients/${c.id}/adjust`, { points: n, reason: a.reason.trim() })).data
    adjusting.value = null
    notify('Points updated')
    search()
  } catch (e) {
    a.error = e.message
  }
}
const listPage = ref(1)
const listMeta = ref({})
</script>

<template>
  <div class="rc">
    <aside class="card rc-list">
      <button v-if="auth.can('rewards.enroll')" class="btn gold" style="width: 100%; margin-bottom: 10px" @click="openEnrol">+ Enrol a client</button>
      <input v-model="q" class="search-in" placeholder="Search any client by name or phone…" />
      <p class="note" style="margin: 8px 2px">{{ q ? 'All clients (members and not)' : 'Members by points (last 12 months)' }}</p>
      <button v-for="m in list" :key="m.client.id" class="rc-row" :class="{ on: selected === m.client.id }" @click="open(m.client.id)">
        <span class="dot" :style="{ background: TIER_COLORS[m.tier?.key] ?? '#d9d6d2' }"></span>
        <span class="grow"><b>{{ m.client.name }}</b><small>{{ m.member ? m.tier?.name : 'Not a member' }} · {{ m.client.phone }}</small></span>
        <span class="p">{{ m.member ? m.points_balance.toLocaleString() : '—' }}</span>
      </button>
      <p v-if="!loadingList && !list.length" class="empty">{{ q ? 'No clients found' : 'No members yet — enrol clients who ask to join' }}</p>
    <Pager :meta="listMeta" @go="(n) => { listPage = n; search() }" />
    </aside>

    <section class="rc-main">
      <p v-if="error" class="err">{{ error }}</p>
      <div v-if="!profile && selected" class="card note">Loading…</div>
      <template v-if="profile">
        <div class="card rc-hero" :style="{ '--tc': tierColor }">
          <div class="who">
            <span class="eyebrow">{{ r.member ? (r.tier?.name ?? '').toUpperCase() + ' MEMBER' : 'NOT A MEMBER YET' }}</span>
            <h2>{{ profile.client.name }}</h2>
            <p class="note">{{ profile.client.phone }}<template v-if="r.member"> · Member since {{ day(r.joined_at) }}<template v-if="profile.enrolled_by"> · enrolled by {{ profile.enrolled_by }}</template> · Referral code <b>{{ r.referral_code }}</b></template></p>
          </div>
          <div class="bal">
            <b>{{ r.points_balance.toLocaleString() }}</b><span>points · worth {{ etb(r.points_value_etb) }}</span>
            <span v-if="r.held_points" class="held">{{ r.held_points.toLocaleString() }} held by open requests</span>
          </div>
          <div class="acts">
            <button v-if="!r.member && auth.can('rewards.enroll')" class="btn gold sm" @click="join">Enrol in Lavish Rewards</button>
            <span v-else-if="!r.member" class="note" style="color: #fff">Not enrolled — ask reception or a manager to enrol them.</span>
            <button v-if="r.member && auth.can('rewards.adjust')" class="btn ghost sm" @click="adjusting = { sign: '+', points: 100, reason: '', error: '' }">Adjust points</button>
          </div>
          <div v-if="r.next_tier" class="prog">
            <div class="bar"><i :style="{ width: r.next_tier.progress * 100 + '%' }"></i></div>
            <small>{{ r.points_12m.toLocaleString() }} pts in the last 12 months · {{ r.next_tier.points_needed.toLocaleString() }} more for <b>{{ r.next_tier.name }}</b></small>
          </div>
          <div v-else class="prog"><small>Top tier — {{ r.points_12m.toLocaleString() }} pts in the last 12 months</small></div>
        </div>

        <div class="grid g4 rc-stats">
          <div class="card stat"><div class="n">{{ r.tier?.earn_multiplier }}×</div><div class="l">Earn rate</div></div>
          <div class="card stat"><div class="n">{{ r.lifetime_points.toLocaleString() }}</div><div class="l">Lifetime points</div></div>
          <div class="card stat" :class="{ gold: r.expiring_soon }"><div class="n">{{ r.expiring_soon ? r.expiring_soon.points.toLocaleString() : 0 }}</div><div class="l">{{ r.expiring_soon ? 'Expire ' + day(r.expiring_soon.on) : 'Nothing expiring soon' }}</div></div>
          <div class="card stat"><div class="n">{{ etb(profile.wallet.gift_cards.reduce((t, g) => t + g.balance, 0)) }}</div><div class="l">On gift cards</div></div>
        </div>

        <div v-if="profile.open_bills.length" class="card rc-bills">
          <h3>Open bills</h3>
          <div v-for="b in profile.open_bills" :key="b.id" class="bill">
            <span class="grow"><b>{{ b.description }}</b><small>{{ etb(b.amount) }}<template v-if="b.discount_amount || b.gift_card_amount"> · {{ etb(b.due_amount) }} left after credits applied in the app</template></small></span>
            <button class="btn gold sm" @click="checkout = b">Check out</button>
          </div>
        </div>

        <div v-if="profile.requests?.length" class="card">
          <h3>Requests to use points</h3>
          <div v-for="x in profile.requests" :key="x.id" class="hist">
            <span class="grow"><b>{{ x.kind_label }} · {{ pts(x.points_used ?? x.points) }}</b><small>{{ when(x.created_at) }}<template v-if="x.note"> · “{{ x.note }}”</template><template v-if="x.bill"> · {{ etb(x.discount_etb) }} off {{ x.bill.description }}</template><template v-if="x.staff_note"> · Lavish: {{ x.staff_note }}</template><template v-if="x.handled_by"> · {{ x.handled_by }}</template></small></span>
            <span class="badge" :class="REQ[x.status]?.[1]">{{ REQ[x.status]?.[0] }}</span>
          </div>
        </div>

        <div class="grid g2">
          <div class="card">
            <h3>Wallet</h3>
            <p v-if="!profile.wallet.vouchers.length && !profile.wallet.gift_cards.length" class="empty">No vouchers or gift cards</p>
            <div v-for="v in profile.wallet.vouchers" :key="'v' + v.id" class="wl"><span class="ic">🎟</span><span class="grow"><b>{{ v.name }}</b><small>{{ v.code }} · use by {{ day(v.expires_at) }}</small></span></div>
            <div v-for="g in profile.wallet.gift_cards" :key="'g' + g.id" class="wl"><span class="ic">🎁</span><span class="grow"><b>{{ g.label }}</b><small>{{ g.masked_code }}</small></span><b>{{ etb(g.balance) }}</b></div>
            <template v-if="profile.referrals.length">
              <h4>Friends referred</h4>
              <div v-for="(f, i) in profile.referrals" :key="i" class="wl"><span class="ic">🤝</span><span class="grow">{{ f.name }}</span><span class="badge" :class="f.status === 'rewarded' ? 'paid' : 'pending'">{{ f.status }}</span></div>
            </template>
          </div>
          <div class="card">
            <h3>Points history</h3>
            <p v-if="!profile.history.length" class="empty">No points yet</p>
            <div v-for="h in profile.history" :key="h.id" class="hist">
              <span class="hic" :class="h.points > 0 ? 'up' : 'down'">{{ ICON[h.type] }}</span>
              <span class="grow"><b>{{ h.description }}</b><small>{{ when(h.created_at) }}<template v-if="h.by"> · by {{ h.by }}</template><template v-if="h.reason"> · “{{ h.reason }}”</template></small></span>
              <span class="amt"><b :class="h.points > 0 ? 'pos' : 'neg'">{{ h.points > 0 ? '+' : '' }}{{ h.points.toLocaleString() }}</b><small v-if="h.balance_after != null">{{ h.balance_after.toLocaleString() }} left</small></span>
            </div>
          </div>
        </div>
      </template>
    </section>
  </div>

  <div v-if="enrolling" class="modal-bg" @click.self="enrolling = null">
    <form class="modal" style="width: min(600px, 95vw); max-height: 92vh; overflow: auto" @submit.prevent="enrol">
      <h2>Enrol a client in Lavish Rewards</h2>
      <p class="note">Only clients who ask to join are enrolled. Members collect points on completed, paid visits and shop orders, and see and use them in the Lavish app.</p>
      <div class="seg">
        <button type="button" :class="{ on: enrolling.mode === 'existing' }" @click="enrolling.mode = 'existing'">Existing client</button>
        <button type="button" :class="{ on: enrolling.mode === 'new' }" @click="enrolling.mode = 'new'">New client</button>
      </div>
      <template v-if="enrolling.mode === 'existing'">
        <label>Find the client</label>
        <input v-model="enrolling.term" placeholder="Name or phone" autofocus @input="findClients" />
        <div v-if="found.length && !enrolling.client" class="sugg-list">
          <button v-for="c in found" :key="c.client.id" type="button" :disabled="c.member" @click="enrolling.client = c; enrolling.term = c.client.name; found = []">
            {{ c.client.name }} <small>{{ c.client.phone }}{{ c.member ? ' · already a member' : '' }}</small>
          </button>
        </div>
        <p v-if="enrolling.client" class="ok">✓ {{ enrolling.client.client.name }} · {{ enrolling.client.client.phone }}</p>
        <p v-else class="note">Not in the system yet? Choose “New client”.</p>
      </template>
      <div v-else class="grid g2">
        <div><label>Full name</label><input v-model="enrolling.name" required maxlength="120" /></div>
        <div><label>Phone</label><PhoneInput v-model="enrolling.phone" required /></div>
        <div><label>Email (optional)</label><input v-model="enrolling.email" type="email" /></div>
        <div><label>Gender</label><select v-model="enrolling.gender"><option value="">—</option><option>Female</option><option>Male</option></select></div>
        <div><label>Date of birth (birthday points)</label><input v-model="enrolling.date_of_birth" type="date" /></div>
        <div><label>Preferred branch</label><select v-model="enrolling.preferred_branch_id"><option value="">—</option><option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option></select></div>
      </div>
      <label>Note (optional)</label><input v-model="enrolling.note" maxlength="255" placeholder="e.g. Asked at the desk after her facial" />
      <p v-if="enrolling.error" class="err">{{ enrolling.error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 16px"><button type="button" class="btn ghost" @click="enrolling = null">Cancel</button><button class="btn gold">Enrol</button></div>
    </form>
  </div>

  <div v-if="adjusting" class="modal-bg" @click.self="adjusting = null">
    <form class="modal" @submit.prevent="saveAdjust">
      <h2>Adjust points</h2>
      <p class="note">Manual changes need a reason and are written to the audit log.</p>
      <div class="row" style="gap: 8px; margin-top: 12px">
        <select v-model="adjusting.sign" style="width: 110px"><option value="+">Add</option><option value="-">Remove</option></select>
        <input v-model.number="adjusting.points" type="number" min="1" required style="flex: 1" />
      </div>
      <label style="margin-top: 12px">Reason</label>
      <input v-model="adjusting.reason" required minlength="4" placeholder="e.g. Waited 40 minutes past the appointment time" />
      <p v-if="adjusting.error" class="err">{{ adjusting.error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 16px"><button type="button" class="btn ghost" @click="adjusting = null">Cancel</button><button class="btn gold">Save</button></div>
    </form>
  </div>

  <CheckoutDialog v-if="checkout" :bill="checkout" :client-name="profile?.client.name" @close="checkout = null" @paid="open(selected)" />
</template>

<style scoped>
.rc { display: grid; grid-template-columns: 300px 1fr; gap: 18px; align-items: start; }
.rc-list { padding: 14px; max-height: calc(100vh - 210px); overflow: auto; position: sticky; top: 16px; }
.search-in { width: 100%; }
.rc-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: 0; border-radius: 10px; background: none; text-align: left; cursor: pointer; }
.rc-row:hover { background: #f6f5f4; }
.rc-row.on { background: #e8f3f2; }
.rc-row .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.rc-row b { display: block; font-weight: 500; font-size: 13.5px; }
.rc-row small { display: block; color: var(--muted); font-size: 11.5px; }
.rc-row .p { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--teal-deep); }
.grow { flex: 1; min-width: 0; }
.rc-main { display: grid; gap: 16px; min-width: 0; }
.rc-hero { position: relative; display: grid; grid-template-columns: 1fr auto; gap: 14px 20px; padding: 22px 24px; color: #fff; border: 0; overflow: hidden;
  background: radial-gradient(600px 300px at 90% 0%, rgba(255, 255, 255, .16), transparent 60%), linear-gradient(135deg, var(--tc), color-mix(in srgb, var(--tc) 70%, #000)); }
.rc-hero .eyebrow { color: rgba(255, 255, 255, .75); letter-spacing: 3px; font-size: 11px; }
.rc-hero h2 { margin: 6px 0 2px; color: #fff; }
.rc-hero .note { color: rgba(255, 255, 255, .8); }
.rc-hero .bal { text-align: right; }
.rc-hero .bal b { display: block; font: 500 40px/1 'EB Garamond', serif; }
.rc-hero .bal span { font-size: 12.5px; opacity: .85; }
.rc-hero .bal .held { display: block; margin-top: 4px; font-size: 11.5px; }
.amt { text-align: right; }
.amt small { display: block; color: var(--muted); font-size: 11.5px; }
.seg { display: inline-flex; gap: 4px; padding: 4px; border-radius: 12px; background: #f3f2f0; margin-top: 8px; }
.seg button { padding: 7px 14px; border: 0; border-radius: 9px; background: none; cursor: pointer; font-size: 13px; }
.seg button.on { background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .1); color: var(--teal-deep); }
.sugg-list { display: grid; border: 1px solid var(--line); border-radius: 10px; margin-top: 4px; overflow: hidden; }
.sugg-list button { padding: 8px 10px; border: 0; background: #fff; text-align: left; cursor: pointer; }
.sugg-list button:hover:not(:disabled) { background: #f6f5f4; }
.sugg-list button:disabled { opacity: .5; cursor: default; }
.sugg-list small { color: var(--muted); }
.ok { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: #e6f3ef; color: var(--teal-deep); font-size: 13px; }
select, input { width: 100%; }
.rc-hero .acts { display: flex; flex-wrap: wrap; gap: 8px; }
.rc-hero .acts .btn.ghost { color: #fff; border-color: rgba(255, 255, 255, .45); }
.rc-hero .acts .btn:not(.gold):not(.ghost) { background: #fff; color: var(--ink); border-color: #fff; }
.prog { grid-column: 1 / -1; }
.prog .bar { height: 8px; border-radius: 99px; background: rgba(255, 255, 255, .22); overflow: hidden; }
.prog .bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #f3e8e1, #cba590); }
.prog small { display: block; margin-top: 6px; opacity: .9; }
.rc-stats { margin: 0; }
.rc-bills h3, .card h3 { margin: 0 0 10px; }
.bill { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); }
.bill b { display: block; font-weight: 500; }
.bill small, .wl small, .hist small { display: block; color: var(--muted); font-size: 12px; }
.wl, .hist { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid #f0efed; }
.wl b, .hist b { font-weight: 500; }
.wl .ic { font-size: 18px; }
h4 { margin: 14px 0 4px; font-size: 13px; color: var(--muted); font-weight: 500; }
.hic { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; font-size: 13px; flex: none; }
.hic.up { background: #e8f3f2; color: var(--teal-deep); }
.hic.down { background: #f8e7e5; color: var(--bad); }
.pos { color: var(--teal-deep); }
.neg { color: var(--bad); }
.ladder { display: grid; gap: 8px; margin-top: 12px; max-height: 60vh; overflow: auto; }
.rung { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: #fff; text-align: left; cursor: pointer; }
.rung:hover:not(:disabled) { border-color: var(--dark); }
.rung:disabled { opacity: .45; cursor: not-allowed; }
.rung b { display: block; font-weight: 500; }
.rung small { color: var(--muted); }
.rung .cost { font-weight: 500; color: var(--teal-deep); white-space: nowrap; }
.err { padding: 10px 12px; border-radius: 10px; background: #f8e7e5; color: var(--bad); font-size: 13px; }
label { display: block; font-size: 13px; margin-bottom: 4px; }
@media (max-width: 1000px) { .rc { grid-template-columns: 1fr; } .rc-list { position: static; max-height: 300px; } }
</style>
