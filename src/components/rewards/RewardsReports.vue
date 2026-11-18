<script setup>
// Owner report: members by tier, points issued vs redeemed, outstanding points, gift card liability.
import { ref, onMounted, computed } from 'vue'
import { api } from '../../api/http'
import { etb, TIER_COLORS } from '../../fmt'
import { exportCsv } from '../../ui'

const r = ref(null)
const error = ref('')
const iso = (d) => d.toISOString().slice(0, 10)
const from = ref(iso(new Date(Date.now() - 30 * 864e5)))
const to = ref(iso(new Date()))

async function load() {
  error.value = ''
  try {
    r.value = (await api.get('/staff/rewards/reports', { from: from.value, to: to.value })).data
  } catch (e) {
    error.value = e.message
  }
}
onMounted(load)

const tierTotal = computed(() => r.value?.members.by_tier.reduce((t, x) => t + x.count, 0) || 1)
const exportReport = () => exportCsv(`lavish-rewards-${from.value}-to-${to.value}`, [
  { Metric: 'Members', Value: r.value.members.total }, { Metric: 'New members', Value: r.value.members.new },
  { Metric: 'Points issued', Value: r.value.points.issued }, { Metric: 'Points redeemed', Value: r.value.points.redeemed },
  { Metric: 'Points expired', Value: r.value.points.expired }, { Metric: 'Points outstanding', Value: r.value.points.outstanding },
  { Metric: 'Outstanding points value (ETB)', Value: r.value.points.outstanding_value_etb },
  { Metric: 'Gift cards sold', Value: r.value.gift_cards.sold_count }, { Metric: 'Gift cards sold (ETB)', Value: r.value.gift_cards.sold_value },
  { Metric: 'Gift cards redeemed (ETB)', Value: r.value.gift_cards.redeemed_value }, { Metric: 'Gift card liability (ETB)', Value: r.value.gift_cards.liability },
  { Metric: 'Vouchers used', Value: r.value.vouchers.used }, { Metric: 'Voucher discounts (ETB)', Value: r.value.vouchers.discount_given },
  { Metric: 'Referrals rewarded', Value: r.value.referrals.rewarded },
])
</script>

<template>
  <div class="hrow">
    <div class="row" style="gap: 8px; align-items: center">
      <input v-model="from" type="date" /> <span class="note">to</span> <input v-model="to" type="date" />
      <button class="btn ghost sm" @click="load">Update</button>
    </div>
    <button v-if="r" class="btn ghost" @click="exportReport">⬇ Export CSV</button>
  </div>
  <p v-if="error" class="err">{{ error }}</p>
  <template v-if="r">
    <div class="grid g4">
      <div class="card stat gold"><div class="n">{{ etb(r.gift_cards.liability) }}</div><div class="l">Gift card liability · {{ r.gift_cards.active_cards }} active cards</div></div>
      <div class="card stat"><div class="n">{{ r.points.outstanding.toLocaleString() }}</div><div class="l">Points outstanding ≈ {{ etb(r.points.outstanding_value_etb) }}</div></div>
      <div class="card stat"><div class="n">{{ r.members.total.toLocaleString() }}</div><div class="l">Members · {{ r.members.new }} new</div></div>
      <div class="card stat"><div class="n">{{ etb(r.gift_cards.sold_value) }}</div><div class="l">Gift cards sold · {{ r.gift_cards.sold_count }}</div></div>
    </div>
    <p class="note liab">Gift card balances are prepaid money the clinic still owes in treatments — a liability, not revenue, until spent. Outstanding points are a future discount.</p>

    <div class="grid g2" style="margin-top: 16px; align-items: start">
      <div class="card">
        <h3>Members by tier</h3>
        <div class="stack"><i v-for="t in r.members.by_tier" :key="t.key" :style="{ flex: t.count || 0.0001, background: TIER_COLORS[t.key] }"></i></div>
        <div v-for="t in r.members.by_tier" :key="'l' + t.key" class="lg"><span class="sw" :style="{ background: TIER_COLORS[t.key] }"></span><span class="grow">{{ t.tier }}</span><b>{{ t.count }}</b><small>{{ Math.round((t.count / tierTotal) * 100) }}%</small></div>
        <h3 style="margin-top: 18px">Top members (12 months)</h3>
        <div v-for="(m, i) in r.top_members" :key="i" class="lg"><span class="rank">{{ i + 1 }}</span><span class="grow">{{ m.name }} <small>{{ m.tier }}</small></span><b>{{ m.points_12m.toLocaleString() }}</b></div>
      </div>
      <div class="card">
        <h3>Points in this period</h3>
        <div class="bars">
          <div v-for="[k, l, c] in [['issued', 'Issued', '#0a7379'], ['redeemed', 'Redeemed', '#cba590'], ['expired', 'Expired', '#b8b2ad']]" :key="k" class="bar">
            <span>{{ l }}</span><div><i :style="{ width: (r.points[k] / Math.max(r.points.issued, r.points.redeemed, r.points.expired, 1)) * 100 + '%', background: c }"></i></div><b>{{ r.points[k].toLocaleString() }}</b>
          </div>
        </div>
        <dl class="kv">
          <dt>Vouchers</dt><dd>{{ r.vouchers.issued }} issued · {{ r.vouchers.used }} used · {{ etb(r.vouchers.discount_given) }} off bills</dd>
          <dt>Gift cards</dt><dd>{{ etb(r.gift_cards.redeemed_value) }} spent on treatments & products<template v-if="r.gift_cards.promo_value"> · {{ etb(r.gift_cards.promo_value) }} promo cards issued</template></dd>
          <dt>Referrals</dt><dd>{{ r.referrals.new }} new · {{ r.referrals.rewarded }} rewarded</dd>
        </dl>
      </div>
    </div>
  </template>
</template>

<style scoped>
.hrow { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
.hrow input[type='date'] { width: 170px; }
.hrow .row { flex-wrap: nowrap; }
.liab { margin: 10px 2px 0; }
h3 { margin: 0 0 12px; }
.stack { display: flex; height: 14px; border-radius: 99px; overflow: hidden; margin-bottom: 10px; gap: 2px; }
.lg { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid #f0efed; font-size: 14px; }
.lg small { color: var(--muted); width: 40px; text-align: right; }
.lg .grow small { width: auto; margin-left: 4px; }
.sw { width: 10px; height: 10px; border-radius: 3px; }
.rank { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: #f3e8e1; font-size: 12px; }
.grow { flex: 1; }
.bars { display: grid; gap: 10px; margin-bottom: 16px; }
.bar { display: grid; grid-template-columns: 80px 1fr 80px; gap: 10px; align-items: center; font-size: 13.5px; }
.bar div { height: 10px; border-radius: 99px; background: #f0efed; overflow: hidden; }
.bar i { display: block; height: 100%; border-radius: inherit; }
.bar b { text-align: right; font-weight: 500; }
.kv { display: grid; grid-template-columns: 90px 1fr; gap: 8px 12px; margin: 0; font-size: 13.5px; }
.kv dt { color: var(--muted); }
.kv dd { margin: 0; }
.err { padding: 10px 12px; border-radius: 10px; background: #f8e7e5; color: var(--bad); font-size: 13px; }
</style>
