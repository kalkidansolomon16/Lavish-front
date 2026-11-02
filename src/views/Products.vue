<script setup>
import { ref, computed } from 'vue'
import { state, actions, etb, reserved, can, BRANCHES } from '../store'
import { exportCsv } from '../ui'

const role = state.user.role
const edit = can.editProducts(role)
const short = (b) => b.replace('Addis Ababa – ', '')
const modal = ref(null) // 'new' | 'restock' | 'adjust' | 'history' | 'transfer'
const tf = ref({ from: BRANCHES[0], to: BRANCHES[1], qty: 1 })
const branch = ref(BRANCHES[0])
const target = ref(null)
const search = ref('')
const blank = () => ({ name: '', category: 'Skincare', price: 0, stock: 0 })
const form = ref(blank())
const qty = ref(1)
const ref_ = ref('')
const counted = ref(0)
const reason = ref('Count correction')

const rows = computed(() => state.products.filter((p) => (p.name + p.sku).toLowerCase().includes(search.value.toLowerCase())))
const avail = (p) => p.stock - reserved(p.id)
const level = (p) => (p.stock === 0 ? 'out' : p.stock <= p.reorder ? 'low' : 'ok')
const units = computed(() => state.products.reduce((t, p) => t + p.stock, 0))
const value = computed(() => state.products.reduce((t, p) => t + p.stock * p.price, 0))
const lowCount = computed(() => state.products.filter((p) => p.stock <= p.reorder).length)
const reservedTotal = computed(() => state.products.reduce((t, p) => t + reserved(p.id), 0))
const history = computed(() => state.movements.filter((m) => target.value && m.productId === target.value.id))
const totalIn = computed(() => history.value.filter((m) => m.qty > 0).reduce((t, m) => t + m.qty, 0))
const totalSold = computed(() => -history.value.filter((m) => m.type === 'sold').reduce((t, m) => t + m.qty, 0))

const open = (kind, p = null) => {
  modal.value = kind; target.value = p
  qty.value = 1; ref_.value = ''; reason.value = 'Count correction'; counted.value = p?.stock ?? 0
  tf.value = { from: BRANCHES[0], to: BRANCHES[1], qty: 1 }; branch.value = BRANCHES[0]
}
const close = () => (modal.value = null)

function saveNew() {
  if (!form.value.name) return
  actions.addProduct({ ...form.value, price: +form.value.price, stock: +form.value.stock })
  form.value = blank(); close()
}
function saveRestock() { if (qty.value > 0) { actions.receiveStock(target.value, +qty.value, ref_.value, branch.value); close() } }
function saveTransfer() { actions.transferStock(target.value, tf.value.from, tf.value.to, +tf.value.qty); close() }
function saveAdjust() { actions.adjustStock(target.value, Math.max(0, +counted.value), reason.value); close() }

const typeLabel = { in: 'Received', sold: 'Sold', adjust: 'Adjusted', transfer: 'Transfer' }
const typeClass = { in: 'paid', sold: 'awaiting', adjust: 'pending', transfer: '' }
const exportAll = () =>
  exportCsv('lavish-inventory', state.products.map((p) => ({ SKU: p.sku, Product: p.name, Category: p.category, Price_ETB: p.price, On_hand: p.stock, Reserved: reserved(p.id), Available: avail(p), Reorder_level: p.reorder })))
</script>

<template>
  <div class="head">
    <div>
      <h1>Products & inventory</h1>
      <p v-if="edit">Post products with prices for the mobile app. Stock goes up when you receive products and down when an order is delivered.</p>
      <p v-else>Track stock in every branch and transfer products between branches. Every change is logged.</p>
    </div>
    <div class="row">
      <button class="btn ghost" @click="exportAll">⬇ Export</button>
      <button v-if="edit" class="btn gold" @click="open('new')">+ Add product</button>
    </div>
  </div>

  <div class="grid g4" style="margin-bottom: 20px">
    <div class="card stat gold"><div class="n">{{ units }}</div><div class="l">Units on hand</div></div>
    <div v-if="can.seeRevenue(role) || edit" class="card stat"><div class="n">{{ etb(value) }}</div><div class="l">Stock value (retail)</div></div>
    <div v-else class="card stat"><div class="n">{{ state.products.length }}</div><div class="l">Products listed</div></div>
    <div class="card stat"><div class="n">{{ reservedTotal }}</div><div class="l">Reserved for open orders</div></div>
    <div class="card stat"><div class="n" :style="{ color: lowCount ? 'var(--bad)' : '' }">{{ lowCount }}</div><div class="l">Need reorder</div></div>
  </div>

  <div class="card">
    <input v-model="search" placeholder="Search by product name or SKU…" style="max-width: 320px; margin-bottom: 12px" />
    <table>
      <thead><tr><th>Product</th><th>Price</th><th v-for="b in BRANCHES" :key="b">{{ short(b) }}</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Level</th><th></th></tr></thead>
      <tbody>
        <tr v-for="p in rows" :key="p.id">
          <td>{{ p.name }}<small>{{ p.sku }} · {{ p.category }}</small></td>
          <td>
            <input v-if="edit" :value="p.price" type="number" min="0" style="width: 100px; padding: 5px 8px" @change="actions.setPrice(p, +$event.target.value)" />
            <template v-else>{{ etb(p.price) }}</template>
          </td>
          <td v-for="b in BRANCHES" :key="b">{{ p.branches[b] }}</td>
          <td><b>{{ p.stock }}</b></td>
          <td>{{ reserved(p.id) || '—' }}</td>
          <td :style="{ color: avail(p) < 0 ? 'var(--bad)' : '' }">{{ avail(p) }}</td>
          <td>
            <span class="badge" :class="{ open: level(p) === 'out', pending: level(p) === 'low', active: level(p) === 'ok' }">
              {{ level(p) === 'out' ? 'Out of stock' : level(p) === 'low' ? 'Reorder (≤ ' + p.reorder + ')' : 'In stock' }}
            </span>
          </td>
          <td class="row">
            <button v-if="edit" class="btn gold sm" @click="open('restock', p)">+ Receive</button>
            <button v-if="edit" class="btn ghost sm" @click="open('adjust', p)">Adjust</button>
            <button v-if="can.transferStock(role)" class="btn gold sm" @click="open('transfer', p)">⇄ Transfer</button>
            <button class="btn ghost sm" @click="open('history', p)">History</button>
          </td>
        </tr>
        <tr v-if="!rows.length"><td colspan="10" class="empty">No products found</td></tr>
      </tbody>
    </table>
  </div>

  <div v-if="modal" class="modal-bg" @click.self="close">
    <form v-if="modal === 'new'" class="modal" @submit.prevent="saveNew">
      <h2>New product</h2>
      <label>Name</label><input v-model="form.name" required />
      <label>Category</label>
      <select v-model="form.category"><option>Skincare</option><option>Sun care</option><option>Aftercare</option><option>Hair</option><option>Supplements</option></select>
      <label>Price (ETB)</label><input v-model="form.price" type="number" min="0" />
      <label>Opening stock</label><input v-model="form.stock" type="number" min="0" />
      <div class="row" style="margin-top: 20px; justify-content: flex-end">
        <button type="button" class="btn ghost" @click="close">Cancel</button>
        <button class="btn gold">Save product</button>
      </div>
    </form>

    <form v-else-if="modal === 'restock'" class="modal" @submit.prevent="saveRestock">
      <h2>Receive stock</h2>
      <p class="note">{{ target.name }} · now {{ target.stock }} on hand</p>
      <label>Quantity received</label><input v-model.number="qty" type="number" min="1" required />
      <label>Receive at branch</label>
      <select v-model="branch"><option v-for="b in BRANCHES" :key="b">{{ b }}</option></select>
      <label>Supplier / invoice reference</label><input v-model="ref_" placeholder="e.g. INV-2041 · Addis Pharma" />
      <p class="serif" style="font-size: 22px; margin-top: 14px">New balance: {{ target.stock + (+qty || 0) }}</p>
      <div class="row" style="margin-top: 14px; justify-content: flex-end">
        <button type="button" class="btn ghost" @click="close">Cancel</button>
        <button class="btn gold">Add to inventory</button>
      </div>
    </form>

    <form v-else-if="modal === 'transfer'" class="modal" @submit.prevent="saveTransfer">
      <h2>Transfer stock</h2>
      <p class="note">{{ target.name }} · {{ BRANCHES.map((b) => short(b) + ' ' + target.branches[b]).join(' · ') }}</p>
      <label>From</label><select v-model="tf.from"><option v-for="b in BRANCHES" :key="b" :value="b">{{ b }} ({{ target.branches[b] }})</option></select>
      <label>To</label><select v-model="tf.to"><option v-for="b in BRANCHES.filter((x) => x !== tf.from)" :key="b" :value="b">{{ b }} ({{ target.branches[b] }})</option></select>
      <label>Quantity</label><input v-model.number="tf.qty" type="number" min="1" :max="target.branches[tf.from]" required />
      <div class="row" style="margin-top: 20px; justify-content: flex-end">
        <button type="button" class="btn ghost" @click="close">Cancel</button>
        <button class="btn gold" :disabled="tf.from === tf.to">Transfer</button>
      </div>
    </form>

    <form v-else-if="modal === 'adjust'" class="modal" @submit.prevent="saveAdjust">
      <h2>Adjust stock</h2>
      <p class="note">{{ target.name }} · system shows {{ target.stock }}</p>
      <label>Counted quantity</label><input v-model.number="counted" type="number" min="0" required />
      <label>Reason</label>
      <select v-model="reason"><option>Count correction</option><option>Damaged</option><option>Expired</option><option>Returned by client</option><option>Sample / internal use</option></select>
      <p class="serif" style="font-size: 22px; margin-top: 14px" :style="{ color: counted - target.stock < 0 ? 'var(--bad)' : 'var(--ok)' }">
        Change: {{ counted - target.stock > 0 ? '+' : '' }}{{ counted - target.stock }}
      </p>
      <div class="row" style="margin-top: 14px; justify-content: flex-end">
        <button type="button" class="btn ghost" @click="close">Cancel</button>
        <button class="btn gold">Save adjustment</button>
      </div>
    </form>

    <div v-else class="modal" style="width: min(640px, 95vw); max-height: 90vh; overflow: auto">
      <h2>{{ target.name }}</h2>
      <p class="note">{{ target.sku }} · {{ target.stock }} on hand · {{ totalIn }} received · {{ totalSold }} sold</p>
      <table style="margin-top: 12px">
        <thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Balance</th><th>Reference</th></tr></thead>
        <tbody>
          <tr v-for="m in history" :key="m.id">
            <td>{{ m.date }}<small>{{ m.by }}</small></td>
            <td><span class="badge" :class="typeClass[m.type]">{{ typeLabel[m.type] }}</span><small>{{ m.reason }}</small></td>
            <td :style="{ color: m.qty < 0 ? 'var(--bad)' : 'var(--ok)', fontWeight: 600 }">{{ m.qty > 0 ? '+' : '' }}{{ m.qty }}</td>
            <td>{{ m.balance }}</td>
            <td>{{ m.ref }}</td>
          </tr>
        </tbody>
      </table>
      <div class="row" style="margin-top: 14px; justify-content: flex-end"><button class="btn ghost" @click="close">Close</button></div>
    </div>
  </div>
</template>
