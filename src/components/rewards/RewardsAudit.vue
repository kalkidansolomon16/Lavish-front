<script setup>
// Every manual change to points, gift cards and program settings — who, when and why.
import { ref, onMounted } from 'vue'
import { api } from '../../api/http'
import { when } from '../../fmt'
import Pager from '../Pager.vue'

const rows = ref([])
const entity = ref('')
const error = ref('')
const LABEL = {
  'points.adjust': 'Points adjusted', 'gift_card.void': 'Gift card voided', 'gift_card.promo': 'Promo card issued', 'gift_card.sold': 'Gift card sold',
  'rewards.settings': 'Program numbers changed', 'rewards.tiers': 'Tiers changed', 'rewards.rule.create': 'Earning rule added', 'rewards.rule.update': 'Earning rule changed',
  'rewards.catalog.create': 'Reward added', 'rewards.catalog.update': 'Reward changed', 'rewards.campaign.create': 'Campaign created', 'rewards.campaign.update': 'Campaign changed',
}
async function load() {
  try {
    const res = await api.get('/staff/rewards/audit', { entity: entity.value || undefined, page: page.value, per_page: 30 })
    rows.value = res.data
    meta.value = res.meta
  } catch (e) {
    error.value = e.message
  }
}
onMounted(load)
const summary = (a) => {
  if (a.action === 'points.adjust') return `${a.after.change > 0 ? '+' : ''}${a.after.change} pts · balance ${a.before.points_balance} → ${a.after.points_balance}`
  if (a.action === 'gift_card.void') return `Balance ETB ${a.before.balance}${a.after.reissued_as ? ' moved to a new card' : ''}`
  if (a.after?.value) return `ETB ${Number(a.after.value).toLocaleString()}`
  return ''
}
const page = ref(1)
const meta = ref({})
</script>

<template>
  <div class="row" style="gap: 8px; margin-bottom: 14px">
    <select v-model="entity" style="width: 220px" @change="load">
      <option value="">Everything</option><option value="client">Client points</option><option value="gift_card">Gift cards</option>
      <option value="loyalty_settings">Program numbers</option><option value="loyalty_tiers">Tiers</option><option value="earn_rule">Earning rules</option>
      <option value="reward">Reward catalog</option><option value="campaign">Campaigns</option>
    </select>
  </div>
  <p v-if="error" class="err">{{ error }}</p>
  <div class="card">
    <table>
      <thead><tr><th>When</th><th>What</th><th>Details</th><th>Reason</th><th>By</th></tr></thead>
      <tbody>
        <tr v-for="a in rows" :key="a.id">
          <td style="white-space: nowrap">{{ when(a.created_at) }}</td>
          <td>{{ LABEL[a.action] ?? a.action }}<small>{{ a.entity }} #{{ a.entity_id ?? '—' }}</small></td>
          <td>{{ summary(a) }}</td>
          <td>{{ a.reason ?? '—' }}</td>
          <td>{{ a.by ?? 'System' }}</td>
        </tr>
        <tr v-if="!rows.length"><td colspan="5" class="empty">Nothing yet</td></tr>
      </tbody>
    </table>
    <Pager :meta="meta" label="changes" @go="(n) => { page = n; load() }" />
  </div>
</template>

<style scoped>
td small { display: block; color: var(--muted); font-size: 12px; }
.err { padding: 10px 12px; border-radius: 10px; background: #f8e7e5; color: var(--bad); font-size: 13px; }
</style>
