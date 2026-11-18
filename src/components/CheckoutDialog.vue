<script setup>
// Front-desk checkout for one bill. Applies, in this fixed order:
//   1. tier price + voucher (or points)  2. gift card  3. cash / card / Telebirr / CBE Birr for the rest.
// Points are earned later only on the gift card + money part. Everything runs server-side in one transaction.
import { ref, watch, onMounted, computed } from 'vue'
import { api } from '../api/http'
import { ask } from '../confirm'
import { notify } from '../store'

const props = defineProps({ bill: { type: Object, required: true }, clientName: String })
const emit = defineEmits(['close', 'paid'])

const etb = (n) => `ETB ${Number(n ?? 0).toLocaleString()}`
const wallet = ref(null)
const quote = ref(null)
const error = ref('')
const busy = ref(false)
const pick = ref({ voucher_id: null, points: 0, gift_card_id: null, gift_card_code: '' })
const method = ref('cash')
const METHODS = [['cash', 'Cash'], ['card', 'Card'], ['telebirr', 'Telebirr'], ['cbe_birr', 'CBE Birr'], ['bank_transfer', 'Bank transfer']]

const opts = () => {
  const o = {}
  if (pick.value.voucher_id) o.voucher_id = pick.value.voucher_id
  if (pick.value.points > 0) o.points = pick.value.points
  if (pick.value.gift_card_id) o.gift_card_id = pick.value.gift_card_id
  else if (pick.value.gift_card_code.trim().length >= 12) o.gift_card_code = pick.value.gift_card_code.trim()
  return o
}

async function refresh() {
  error.value = ''
  try {
    quote.value = (await api.post(`/staff/payments/${props.bill.id}/quote`, opts())).data
  } catch (e) {
    error.value = e.message
    quote.value = null
  }
}
let timer
watch(pick, () => { clearTimeout(timer); timer = setTimeout(refresh, 250) }, { deep: true })

onMounted(async () => {
  try {
    wallet.value = (await api.get(`/staff/payments/${props.bill.id}/wallet`)).data
  } catch (e) {
    error.value = e.message
  }
  refresh()
})

const usingPointsAndVoucher = computed(() => pick.value.voucher_id && pick.value.points > 0)
const maxPoints = computed(() => Math.max(0, wallet.value?.points_balance ?? 0))

async function pay() {
  const q = quote.value
  if (!q) return
  const parts = [
    q.tier_discount && `Tier price (${q.tier}): −${etb(q.tier_discount)}`,
    q.voucher_discount && `Voucher: −${etb(q.voucher_discount)}`,
    q.points_used && `${q.points_used.toLocaleString()} points: −${etb(q.points_discount)}`,
    q.gift_card_amount && `Gift card ${q.gift_card.masked_code}: −${etb(q.gift_card_amount)}`,
    q.to_pay ? `${METHODS.find((m) => m[0] === method.value)[1]}: ${etb(q.to_pay)}` : 'Nothing left to pay in money',
  ].filter(Boolean)
  if (!(await ask({ title: `Check out ${etb(q.price)}?`, body: `${props.clientName ?? ''} · ${props.bill.description}\n\n${parts.join('\n')}`, ok: q.to_pay ? `Take ${etb(q.to_pay)}` : 'Close the bill' }))) return
  busy.value = true
  try {
    const res = await api.post(`/staff/payments/${props.bill.id}/checkout`, { ...opts(), method: q.to_pay ? method.value : undefined })
    notify(`${props.bill.description} paid`)
    emit('paid', res.data)
    emit('close')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="modal-bg" @click.self="emit('close')">
    <div class="modal co">
      <div class="co-head">
        <div>
          <span class="eyebrow">CHECKOUT</span>
          <h2>{{ bill.description }}</h2>
          <p class="note">{{ clientName }}</p>
        </div>
        <button class="btn ghost sm" @click="emit('close')">✕</button>
      </div>

      <div v-if="!wallet && !error" class="note">Loading wallet…</div>
      <template v-if="wallet">
        <div class="co-step">
          <span class="n">1</span>
          <div class="grow">
            <b>Voucher or points</b>
            <div class="chips">
              <button class="chipbtn" :class="{ on: !pick.voucher_id }" @click="pick.voucher_id = null">No voucher</button>
              <button v-for="v in wallet.vouchers" :key="v.id" class="chipbtn" :class="{ on: pick.voucher_id === v.id, off: v.applies === false }" :disabled="v.applies === false" :title="v.applies === false ? 'Not for this treatment' : ''" @click="pick.voucher_id = v.id">
                {{ v.name }} <small>{{ v.code }}</small>
              </button>
            </div>
            <div class="pts">
              <label>Use points <small>({{ maxPoints.toLocaleString() }} available · 1 point = ETB {{ wallet.point_value_etb }})</small></label>
              <div class="row" style="gap: 8px; align-items: center">
                <input v-model.number="pick.points" type="range" min="0" :max="maxPoints" step="50" style="flex: 1; padding: 0" />
                <input v-model.number="pick.points" type="number" min="0" :max="maxPoints" style="width: 100px" />
              </div>
              <small v-if="usingPointsAndVoucher" class="note">Voucher and points can be combined; the voucher is applied first.</small>
            </div>
          </div>
        </div>

        <div class="co-step">
          <span class="n">2</span>
          <div class="grow">
            <b>Gift card</b>
            <div class="chips">
              <button class="chipbtn" :class="{ on: !pick.gift_card_id }" @click="pick.gift_card_id = null">{{ pick.gift_card_code ? 'Code below' : 'No gift card' }}</button>
              <button v-for="g in wallet.gift_cards" :key="g.id" class="chipbtn" :class="{ on: pick.gift_card_id === g.id, off: g.applies === false }" :disabled="g.applies === false" @click="pick.gift_card_id = g.id; pick.gift_card_code = ''">
                {{ g.label }} <small>{{ g.masked_code }} · {{ etb(g.balance) }}</small>
              </button>
            </div>
            <input v-if="!pick.gift_card_id" v-model="pick.gift_card_code" class="code" placeholder="…or type / scan a card code: XXXX-XXXX-XXXX-XXXX" autocomplete="off" />
          </div>
        </div>

        <div class="co-step">
          <span class="n">3</span>
          <div class="grow">
            <b>Pay the rest</b>
            <div class="chips">
              <button v-for="[k, l] in METHODS" :key="k" class="chipbtn" :class="{ on: method === k }" :disabled="quote && !quote.to_pay" @click="method = k">{{ l }}</button>
            </div>
          </div>
        </div>
      </template>

      <div v-if="quote" class="co-sum">
        <div><span>Price</span><b>{{ etb(quote.price) }}</b></div>
        <div v-if="quote.already_applied.discount || quote.already_applied.gift_card"><span>Already applied in the app</span><b>−{{ etb(quote.already_applied.discount + quote.already_applied.gift_card) }}</b></div>
        <div v-if="quote.tier_discount"><span>{{ quote.tier }} price</span><b>−{{ etb(quote.tier_discount) }}</b></div>
        <div v-if="quote.voucher_discount"><span>Voucher {{ quote.voucher.code }}</span><b>−{{ etb(quote.voucher_discount) }}</b></div>
        <div v-if="quote.points_discount"><span>{{ quote.points_used.toLocaleString() }} points</span><b>−{{ etb(quote.points_discount) }}</b></div>
        <div v-if="quote.gift_card_amount"><span>Gift card {{ quote.gift_card.masked_code }} <small>({{ etb(quote.gift_card_balance_after) }} left after)</small></span><b>−{{ etb(quote.gift_card_amount) }}</b></div>
        <div class="total"><span>To pay now</span><b>{{ etb(quote.to_pay) }}</b></div>
        <p class="earn">✦ The client will earn about <b>{{ quote.points_to_earn.toLocaleString() }} points</b> when the visit is completed (no points on the voucher / points part).</p>
      </div>

      <p v-if="error" class="err" role="alert">{{ error }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 16px">
        <button class="btn ghost" @click="emit('close')">Cancel</button>
        <button class="btn gold" :disabled="!quote || busy" @click="pay">{{ busy ? 'Saving…' : quote && !quote.to_pay ? 'Close the bill' : `Take ${etb(quote?.to_pay)}` }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.co { width: min(640px, 95vw); max-height: 92vh; overflow: auto; }
.co-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.co-head h2 { margin: 4px 0 0; }
.co-step { display: flex; gap: 14px; padding: 14px 0; border-top: 1px solid var(--line); }
.co-step .n { flex: none; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--dark); color: #fff; font-size: 13px; }
.co-step b { display: block; margin-bottom: 8px; font-weight: 500; }
.grow { flex: 1; min-width: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chipbtn { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line); background: #fff; font-size: 12.5px; cursor: pointer; text-align: left; }
.chipbtn small { color: var(--muted); margin-left: 4px; }
.chipbtn.on { border-color: var(--dark); background: #e8f3f2; color: var(--teal-deep); }
.chipbtn:disabled { opacity: .45; cursor: not-allowed; }
.pts { margin-top: 12px; }
.pts label { display: block; font-size: 13px; margin-bottom: 4px; }
.pts small, .note { color: var(--muted); }
.code { width: 100%; margin-top: 8px; font-family: ui-monospace, monospace; letter-spacing: 1px; text-transform: uppercase; }
.co-sum { margin-top: 6px; padding: 14px 16px; border-radius: 12px; background: #f6f5f4; }
.co-sum > div { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; font-size: 14px; }
.co-sum > div span small { color: var(--muted); }
.co-sum .total { margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--line); font-size: 17px; }
.co-sum .total b { color: var(--teal-deep); }
.earn { margin: 10px 0 0; font-size: 12.5px; color: #8a6a55; }
.err { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: #f8e7e5; color: var(--bad); font-size: 13px; }
</style>
