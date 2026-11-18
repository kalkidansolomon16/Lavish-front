<script setup>
// Program settings: tiers, how points are earned, the reward catalog and program-wide numbers.
// Everyone with the page can read them; only rewards.manage can change them — always with a reason (audit log).
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api/http'
import { useAuth } from '../../stores/auth'
import { notify } from '../../store'
import { etb, pts, day, TIER_COLORS } from '../../fmt'

const auth = useAuth()
const edit = computed(() => auth.can('rewards.manage'))
const data = ref(null)
const services = ref([])
const products = ref([])
const error = ref('')
const pending = ref(null) // { title, what, run: (reason) => Promise }
const reason = ref('')
const editTier = ref(null)
const editRule = ref(null)
const editReward = ref(null)
const editSettings = ref(null)

const RULE_NAMES = { spend: 'Treatment spend', product_spend: 'Shop spend', visit: 'Completed visit', referral: 'Referral', review: 'Review after a visit', birthday: 'Birthday month', signup: 'Joining (welcome)', app_booking: 'Booking in the app' }
const RULE_ORDER = ['spend', 'visit', 'app_booking', 'product_spend', 'review', 'referral', 'birthday', 'signup']
const rules = computed(() => [...(data.value?.earn_rules ?? [])].sort((a, b) => RULE_ORDER.indexOf(a.type) - RULE_ORDER.indexOf(b.type) || (a.service ? 1 : 0) - (b.service ? 1 : 0)))
const ruleText = (r) => (r.per_etb ? `${r.points} pts per ETB ${r.per_etb.toLocaleString()}` : `${r.points} pts`) + (r.cap_per_visit ? ` · max ${r.cap_per_visit}/visit` : '')

async function load() {
  try {
    data.value = (await api.get('/staff/rewards/settings')).data
  } catch (e) {
    error.value = e.message
  }
}
onMounted(async () => {
  await load()
  const cat = await api.get('/catalog/services').catch(() => ({ data: [] }))
  services.value = cat.data
  products.value = (await api.get('/catalog/products', { per_page: 100 }).catch(() => ({ data: [] }))).data
})

// Every save goes through this: ask for a reason, then run.
function confirmWithReason(title, what, run) {
  reason.value = ''
  pending.value = { title, what, run, error: '' }
}
async function runPending() {
  if (reason.value.trim().length < 3) return
  try {
    data.value = (await pending.value.run(reason.value.trim())).data
    pending.value = null
    editTier.value = editRule.value = editReward.value = editSettings.value = null
    notify('Saved — recorded in the audit log')
  } catch (e) {
    pending.value.error = e.message
  }
}

const saveTiers = () => confirmWithReason('Save tier changes?', `${editTier.value.name}: from ${pts(editTier.value.min_points_12m)} in 12 months, ${editTier.value.earn_multiplier}× points`, (why) =>
  api.put('/staff/rewards/tiers', { reason: why, tiers: data.value.tiers.map((t) => (t.id === editTier.value.id ? { ...editTier.value, benefits: editTier.value.benefitsText.split('\n').map((s) => s.trim()).filter(Boolean) } : t)).map(({ benefitsText, key, ...t }) => t) }))

const saveRule = () => {
  const r = editRule.value
  return confirmWithReason(r.id ? 'Change this earning rule?' : 'Add this earning rule?', `${RULE_NAMES[r.type]}: ${ruleText(r)}`, (why) =>
    r.id ? api.patch(`/staff/rewards/rules/${r.id}`, { ...r, service_id: r.service_id || null, reason: why }) : api.post('/staff/rewards/rules', { ...r, service_id: r.service_id || null, reason: why }))
}

const saveReward = () => {
  const r = editReward.value
  return confirmWithReason(r.id ? 'Change this reward?' : 'Add this reward?', `${r.name} · ${pts(r.points_cost)}`, (why) => {
    const body = { ...r, service_id: r.service_id || null, product_id: r.product_id || null, tier_required_id: r.tier_required_id || null, stock: r.stock === '' ? null : r.stock, available_from: r.available_from || null, available_until: r.available_until || null, reason: why }
    return r.id ? api.patch(`/staff/rewards/catalog/${r.id}`, body) : api.post('/staff/rewards/catalog', body)
  })
}
const toggleReward = (r) => confirmWithReason(r.active ? `Hide “${r.name}”?` : `Show “${r.name}” again?`, r.active ? 'Clients will no longer see it in the catalog. Vouchers already issued still work.' : 'Clients will see it in the catalog.', (why) =>
  api.patch(`/staff/rewards/catalog/${r.id}`, { active: !r.active, reason: why }))

const saveSettings = () => confirmWithReason('Save program settings?', 'Point value, expiry, caps and gift card settings.', (why) =>
  api.put('/staff/rewards/settings', { ...editSettings.value, gift_card_amounts: String(editSettings.value.gift_card_amounts).split(',').map((n) => parseInt(n, 10)).filter((n) => n >= 100), reason: why }))

const openTier = (t) => (editTier.value = { ...t, benefitsText: (t.benefits ?? []).join('\n') })
const openRule = (r) => (editRule.value = r ? { id: r.id, type: r.type, service_id: r.service?.id ?? '', points: r.points, per_etb: r.per_etb, cap_per_visit: r.cap_per_visit, label: r.label, active: r.active } : { type: 'visit', service_id: '', points: 100, per_etb: null, cap_per_visit: null, label: '', active: true })
const openReward = (r) => (editReward.value = r ? { id: r.id, name: r.name, description: r.description, points_cost: r.points_cost, reward_type: r.reward_type, value: r.value, service_id: r.service?.id ?? '', product_id: r.product?.id ?? '', tier_required_id: r.tier_required?.id ?? '', stock: r.stock ?? '', available_from: dt(r.available_from), available_until: dt(r.available_until), icon: r.icon, active: r.active } : { name: '', description: '', points_cost: 1000, reward_type: 'discount', value: 500, service_id: '', product_id: '', tier_required_id: '', stock: '', available_from: '', available_until: '', icon: 'redeem', active: true })
// ISO → value for <input type="datetime-local"> (local time)
function dt(v) { if (!v) return ''; const d = new Date(v); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16) }
const windowText = (r) => [r.available_from ? 'from ' + day(r.available_from) : '', r.available_until ? 'until ' + day(r.available_until) : ''].filter(Boolean).join(' ')
const windowState = (r) => (r.available_from && new Date(r.available_from) > new Date() ? 'Not showing yet' : r.available_until && new Date(r.available_until) < new Date() ? 'Ended' : r.available_until ? 'Showing now' : '')
const openSettings = () => (editSettings.value = { ...data.value.settings, gift_card_amounts: (data.value.settings.gift_card_amounts ?? []).join(', ') })
</script>

<template>
  <p v-if="error" class="err">{{ error }}</p>
  <template v-if="data">
    <p v-if="!edit" class="note" style="margin-bottom: 14px">You can see how the program works. Only managers with “Run Lavish Rewards” can change it.</p>

    <h3 class="sec">Tiers <small>— set by points earned in the last 12 months; spending points never lowers a tier</small></h3>
    <div class="tiers">
      <div v-for="t in data.tiers" :key="t.id" class="card tier" :style="{ '--tc': TIER_COLORS[t.key] ?? 'var(--dark)' }">
        <div class="tt"><b>{{ t.name }}</b><span>{{ t.earn_multiplier }}× points</span></div>
        <p class="q">{{ t.min_points_12m ? `From ${t.min_points_12m.toLocaleString()} pts / 12 months` : 'From sign-up' }}</p>
        <ul><li v-for="b in t.benefits" :key="b">{{ b }}</li></ul>
        <p v-if="t.service_discount_percent" class="tag">{{ t.service_discount_percent }}% off treatments</p>
        <button v-if="edit" class="btn ghost sm" @click="openTier(t)">Edit</button>
      </div>
    </div>

    <div class="grid g2" style="margin-top: 18px; align-items: start">
      <div class="card">
        <div class="hrow"><h3>Ways to earn</h3><button v-if="edit" class="btn ghost sm" @click="openRule(null)">+ Rule</button></div>
        <table>
          <tbody>
            <tr v-for="r in rules" :key="r.id" :class="{ off: !r.active }">
              <td><b>{{ RULE_NAMES[r.type] }}</b><small v-if="r.service">Bonus on {{ r.service.name }}</small><small v-if="r.label">“{{ r.label }}”</small></td>
              <td>{{ ruleText(r) }}</td>
              <td style="text-align: right"><button v-if="edit" class="btn ghost sm" @click="openRule(r)">Edit</button></td>
            </tr>
          </tbody>
        </table>
        <p class="note" style="margin-top: 10px">Points are credited by the server only when a visit is completed <b>and</b> paid. No points on gift card purchases, tips or the part paid with a voucher or points.</p>
      </div>

      <div class="card">
        <div class="hrow"><h3>Program numbers</h3><button v-if="edit" class="btn ghost sm" @click="openSettings">Edit</button></div>
        <dl class="kv">
          <dt>Point value</dt><dd>1 point = {{ etb(data.settings.point_value_etb) }} off · 1,000 pts = {{ etb(1000 * data.settings.point_value_etb) }}</dd>
          <dt>Points expire</dt><dd>{{ data.settings.points_expiry_months }} months after they’re earned (reminder {{ data.settings.expiry_reminder_days }} days before)</dd>
          <dt>Vouchers valid</dt><dd>{{ data.settings.voucher_valid_days }} days</dd>
          <dt>Caps</dt><dd>{{ pts(data.settings.max_points_per_visit) }} per visit · {{ pts(data.settings.max_points_per_day) }} per day · {{ data.settings.max_referrals_per_year }} referral rewards a year</dd>
          <dt>Gift cards</dt><dd>Valid {{ data.settings.gift_card_expiry_months }} months · promo cards {{ data.settings.promo_card_expiry_months }} months · low-balance alert at {{ data.settings.gift_card_low_balance_percent }}%</dd>
          <dt>App amounts</dt><dd>{{ (data.settings.gift_card_amounts ?? []).map(etb).join(' · ') }}</dd>
        </dl>
      </div>
    </div>

    <div class="card" style="margin-top: 18px">
      <h3>How members use their points</h3>
      <p class="note" style="margin: 6px 0 0">In the app a member chooses <b>Use my points</b>: a discount on shop products, on a treatment, or something else, how many points, and a note.
        Reception handles it under <b>Points requests</b> — treatment requests come off the client’s bill, shop requests go to e-commerce, who take them off the order.
        1 point = {{ etb(data.settings.point_value_etb) }} off. The points are taken only when the request is done, and the client sees what they were used for and the balance left.</p>
    </div>
  </template>

  <!-- Edit tier -->
  <div v-if="editTier" class="modal-bg" @click.self="editTier = null">
    <form class="modal" style="width: min(520px, 95vw)" @submit.prevent="saveTiers">
      <h2>Edit {{ editTier.name }}</h2>
      <label>Name</label><input v-model="editTier.name" required />
      <div class="grid g2"><div><label>Points in 12 months to qualify</label><input v-model.number="editTier.min_points_12m" type="number" min="0" required /></div>
        <div><label>Earn multiplier</label><input v-model.number="editTier.earn_multiplier" type="number" step="0.05" min="1" required /></div></div>
      <div class="grid g2"><div><label>% off treatments (exclusive price)</label><input v-model.number="editTier.service_discount_percent" type="number" min="0" max="50" /></div>
        <div><label class="chk"><input v-model="editTier.points_never_expire" type="checkbox" /> Points never expire</label></div></div>
      <label>Benefits (one per line — shown in the app)</label><textarea v-model="editTier.benefitsText" rows="4"></textarea>
      <div class="row" style="justify-content: flex-end; margin-top: 14px"><button type="button" class="btn ghost" @click="editTier = null">Cancel</button><button class="btn gold">Save</button></div>
    </form>
  </div>

  <!-- Edit rule -->
  <div v-if="editRule" class="modal-bg" @click.self="editRule = null">
    <form class="modal" @submit.prevent="saveRule">
      <h2>{{ editRule.id ? 'Edit rule' : 'New earning rule' }}</h2>
      <label>When</label>
      <select v-model="editRule.type" :disabled="!!editRule.id"><option v-for="(l, k) in RULE_NAMES" :key="k" :value="k">{{ l }}</option></select>
      <template v-if="editRule.type === 'visit'"><label>Only for this treatment (bonus) — leave empty for every visit</label>
        <select v-model="editRule.service_id"><option value="">Every visit</option><option v-for="s in services" :key="s.id" :value="s.id">{{ s.name }}</option></select></template>
      <div class="grid g2"><div><label>Points</label><input v-model.number="editRule.points" type="number" min="0" required /></div>
        <div v-if="['spend', 'product_spend'].includes(editRule.type)"><label>…per ETB spent</label><input v-model.number="editRule.per_etb" type="number" min="1" required /></div></div>
      <label>Wording in the app (optional)</label><input v-model="editRule.label" placeholder="e.g. Double points on HydraFacial this month" />
      <label class="chk"><input v-model="editRule.active" type="checkbox" /> Active</label>
      <div class="row" style="justify-content: flex-end; margin-top: 14px"><button type="button" class="btn ghost" @click="editRule = null">Cancel</button><button class="btn gold">Save</button></div>
    </form>
  </div>

  <!-- Edit reward -->
  <div v-if="editReward" class="modal-bg" @click.self="editReward = null">
    <form class="modal" style="width: min(560px, 95vw)" @submit.prevent="saveReward">
      <h2>{{ editReward.id ? 'Edit reward' : 'New reward' }}</h2>
      <label>Name</label><input v-model="editReward.name" required />
      <label>Description (shown in the app)</label><input v-model="editReward.description" />
      <div class="grid g2"><div><label>Points cost</label><input v-model.number="editReward.points_cost" type="number" min="1" required /></div>
        <div><label>Type</label><select v-model="editReward.reward_type"><option value="discount">Amount off a treatment</option><option value="free_service">Free treatment</option><option value="product">Free product</option></select></div></div>
      <div v-if="editReward.reward_type === 'discount'"><label>ETB off</label><input v-model.number="editReward.value" type="number" min="1" required /></div>
      <div v-if="editReward.reward_type === 'free_service'"><label>Treatment</label><select v-model="editReward.service_id" required><option v-for="s in services" :key="s.id" :value="s.id">{{ s.name }} — {{ etb(s.price) }}</option></select></div>
      <div v-if="editReward.reward_type === 'product'"><label>Product</label><select v-model="editReward.product_id" required><option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option></select></div>
      <div class="grid g2"><div><label>Only for tier</label><select v-model="editReward.tier_required_id"><option value="">Everyone</option><option v-for="t in data.tiers" :key="t.id" :value="t.id">{{ t.name }}</option></select></div>
        <div><label>Stock (empty = unlimited)</label><input v-model="editReward.stock" type="number" min="0" /></div></div>
      <div class="grid g2"><div><label>Show from <small class="note">(optional)</small></label><input v-model="editReward.available_from" type="datetime-local" /></div>
        <div><label>Show until <small class="note">(optional)</small></label><input v-model="editReward.available_until" type="datetime-local" :min="editReward.available_from || undefined" /></div></div>
      <p class="note">For holiday rewards: it appears in the app only between these dates and hides by itself afterwards. Leave empty to show it all year.</p>
      <div class="row" style="justify-content: flex-end; margin-top: 14px"><button type="button" class="btn ghost" @click="editReward = null">Cancel</button><button class="btn gold">Save</button></div>
    </form>
  </div>

  <!-- Edit settings -->
  <div v-if="editSettings" class="modal-bg" @click.self="editSettings = null">
    <form class="modal" style="width: min(620px, 95vw); max-height: 90vh; overflow: auto" @submit.prevent="saveSettings">
      <h2>Program numbers</h2>
      <div class="grid g2">
        <div><label>1 point is worth (ETB)</label><input v-model.number="editSettings.point_value_etb" type="number" step="0.01" min="0.01" required /></div>
        <div><label>Points expire after (months)</label><input v-model.number="editSettings.points_expiry_months" type="number" min="1" required /></div>
        <div><label>Expiry reminder (days before)</label><input v-model.number="editSettings.expiry_reminder_days" type="number" min="1" required /></div>
        <div><label>Vouchers valid (days)</label><input v-model.number="editSettings.voucher_valid_days" type="number" min="1" required /></div>
        <div><label>Max points per visit</label><input v-model.number="editSettings.max_points_per_visit" type="number" min="1" required /></div>
        <div><label>Max points per day</label><input v-model.number="editSettings.max_points_per_day" type="number" min="1" required /></div>
        <div><label>Referral rewards per year</label><input v-model.number="editSettings.max_referrals_per_year" type="number" min="0" required /></div>
        <div><label>Gift cards valid (months)</label><input v-model.number="editSettings.gift_card_expiry_months" type="number" min="1" required /></div>
        <div><label>Promo cards valid (months)</label><input v-model.number="editSettings.promo_card_expiry_months" type="number" min="1" required /></div>
        <div><label>Low-balance alert at (%)</label><input v-model.number="editSettings.gift_card_low_balance_percent" type="number" min="1" max="90" required /></div>
      </div>
      <label>Gift card amounts offered in the app (ETB, comma-separated)</label><input v-model="editSettings.gift_card_amounts" />
      <div class="row" style="justify-content: flex-end; margin-top: 14px"><button type="button" class="btn ghost" @click="editSettings = null">Cancel</button><button class="btn gold">Save</button></div>
    </form>
  </div>

  <!-- Reason step for every change -->
  <div v-if="pending" class="modal-bg reason-bg" @click.self="pending = null">
    <form class="modal" @submit.prevent="runPending">
      <h2>{{ pending.title }}</h2>
      <p class="note">{{ pending.what }}</p>
      <label style="margin-top: 12px">Reason (saved in the audit log)</label>
      <input v-model="reason" required minlength="3" autofocus placeholder="e.g. Owner approved new tier thresholds" />
      <p v-if="pending.error" class="err">{{ pending.error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 14px"><button type="button" class="btn ghost" @click="pending = null">Cancel</button><button class="btn gold" :disabled="reason.trim().length < 3">Save change</button></div>
    </form>
  </div>
</template>

<style scoped>
.sec { margin: 0 0 10px; }
.sec small, h3 small { font-weight: 400; font-size: 13px; color: var(--muted); font-family: Roboto, sans-serif; }
.tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.tier { position: relative; padding: 18px 18px 16px; border-top: 4px solid var(--tc); display: flex; flex-direction: column; gap: 6px; }
.tt { display: flex; justify-content: space-between; align-items: baseline; }
.tt b { font: 600 22px 'EB Garamond', serif; color: var(--tc); }
.tt span { font-size: 12px; padding: 2px 8px; border-radius: 99px; background: color-mix(in srgb, var(--tc) 12%, #fff); color: var(--tc); }
.q { margin: 0; font-size: 13px; color: var(--muted); }
.tier ul { margin: 4px 0; padding-left: 18px; font-size: 13px; line-height: 1.6; flex: 1; }
.tag { margin: 0; font-size: 12px; color: var(--teal-deep); }
.tier .btn { align-self: flex-start; }
.hrow { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 8px; }
.hrow h3 { margin: 0; }
td small { display: block; color: var(--muted); font-size: 12px; }
tr.off { opacity: .5; }
.kv { display: grid; grid-template-columns: 130px 1fr; gap: 8px 14px; margin: 0; font-size: 13.5px; }
.kv dt { color: var(--muted); }
.kv dd { margin: 0; }
label { display: block; font-size: 13px; margin: 10px 0 4px; }
.chk { display: flex; align-items: center; gap: 8px; margin-top: 30px; }
.chk input { width: auto; }
textarea { width: 100%; }
.reason-bg { z-index: 30; }
.err { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: #f8e7e5; color: var(--bad); font-size: 13px; }
@media (max-width: 1000px) { .tiers { grid-template-columns: 1fr; } }
</style>
