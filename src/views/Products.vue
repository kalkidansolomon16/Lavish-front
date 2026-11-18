<script setup>
// Products & inventory — GET /staff/products (stock per branch), receive / transfer / adjust, history.
// Products posted here are what clients see in the mobile app shop.
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api/http'
import { useAuth } from '../stores/auth'
import { ask } from '../confirm'
import { notify } from '../store'
import { exportCsv } from '../ui'
import { etb, when } from '../fmt'
import FilePicker from '../components/FilePicker.vue'
import Pager from '../components/Pager.vue'

const auth = useAuth()
const edit = computed(() => auth.can('products.create', 'products.edit', 'products.stock'))
const canCreate = computed(() => auth.can('products.create'))
const canEdit = computed(() => auth.can('products.edit'))
const canDelete = computed(() => auth.can('products.delete'))
const canStock = computed(() => auth.can('products.stock'))
const rows = ref([])
const meta = ref({ categories: [], branches: [] })
const search = ref('')
const error = ref('')
const modal = ref(null) // new | edit | receive | adjust | transfer | history
const target = ref(null)
const f = ref({})
const history = ref([])
const busy = ref(false)

async function load() {
  try {
    const res = await api.get('/staff/products', { q: search.value || undefined, include_inactive: 1 })
    rows.value = res.data
    meta.value = res.meta
  } catch (e) {
    error.value = e.message
  }
}
let t
watch(search, () => { clearTimeout(t); t = setTimeout(load, 300) })
onMounted(load)

const branches = computed(() => meta.value.branches ?? [])
const qtyAt = (p, b) => p.branches?.find((x) => x.branch_id === b.id)?.quantity ?? 0
const level = (p) => (p.stock === 0 ? 'out' : p.low_stock ? 'low' : 'ok')
const units = computed(() => rows.value.reduce((s, p) => s + (p.active ? p.stock : 0), 0))
const reservedTotal = computed(() => rows.value.reduce((s, p) => s + p.reserved, 0))
const lowCount = computed(() => rows.value.filter((p) => p.active && p.low_stock).length)

function open(kind, p = null) {
  target.value = p
  modal.value = kind
  const b0 = branches.value[0]?.id
  f.value = {
    new: { name: '', category: meta.value.categories[0] ?? 'Skincare', price: 0, opening_stock: 0, size: '', description: '', usage: '', reorder_level: 5, image: null },
    edit: p && { name: p.name, category: p.category, price: p.price, size: p.size ?? '', description: p.description ?? '', usage: p.usage ?? '', reorder_level: p.reorder_level, active: p.active, image: null },
    receive: { quantity: 1, branch_id: b0, reference: '' },
    adjust: { branch_id: b0, counted: p ? qtyAt(p, branches.value[0] ?? {}) : 0, reason: 'Count correction' },
    transfer: { from_branch_id: b0, to_branch_id: branches.value[1]?.id, quantity: 1 },
  }[kind] ?? {}
  if (kind === 'history') loadHistory(p)
}
const close = () => (modal.value = null)
async function loadHistory(p) {
  history.value = (await api.get('/staff/products/movements', { product_id: p.id, per_page: 100 }).catch(() => ({ data: [] }))).data
}
const branchName = (id) => branches.value.find((b) => b.id === id)?.name
const merge = (p) => { const i = rows.value.findIndex((x) => x.id === p.id); i >= 0 ? (rows.value[i] = p) : rows.value.unshift(p) }

async function run(question, call, done) {
  if (!(await ask(question))) return
  busy.value = true
  try {
    const p = (await call()).data
    merge(p)
    close()
    notify(done)
  } catch (e) {
    notify(e.message)
  } finally {
    busy.value = false
  }
}
async function uploadImage(id, file) {
  if (!file) return
  const fd = new FormData()
  fd.append('image', file)
  merge((await api.post(`/staff/products/${id}/image`, fd)).data)
}

const saveNew = () => run({ title: 'Add this product?', body: `${f.value.name} · ${etb(+f.value.price)} · ${+f.value.opening_stock} in stock at ${branchName(branches.value[0]?.id)}\nClients will see it in the app shop.`, ok: 'Add product' },
  async () => {
    const { image, ...body } = f.value
    const res = await api.post('/staff/products', { ...body, price: +body.price, opening_stock: +body.opening_stock, reorder_level: +body.reorder_level })
    if (image) await uploadImage(res.data.id, image)
    return res
  }, 'Product added')
const saveEdit = () => run({ title: 'Save product changes?', body: `${f.value.name}${f.value.price !== target.value.price ? `\nPrice: ${etb(target.value.price)} → ${etb(+f.value.price)}` : ''}${!f.value.active ? '\nHidden from the app shop.' : ''}`, ok: 'Save' },
  async () => {
    const { image, ...body } = f.value
    const res = await api.patch(`/staff/products/${target.value.id}`, { ...body, price: +body.price, reorder_level: +body.reorder_level })
    if (image) await uploadImage(target.value.id, image)
    return res
  }, 'Product saved')
const saveReceive = () => run({ title: 'Receive this stock?', body: `${f.value.quantity} × ${target.value.name} into ${branchName(f.value.branch_id)}.${target.value.stock === 0 ? '\nDoctors whose patients were waiting for it are told it’s back.' : ''}`, ok: 'Receive stock' },
  () => api.post(`/staff/products/${target.value.id}/receive`, f.value), 'Stock received')
const saveTransfer = () => run({ title: 'Transfer this stock?', body: `${f.value.quantity} × ${target.value.name}\nfrom ${branchName(f.value.from_branch_id)} to ${branchName(f.value.to_branch_id)}.`, ok: 'Transfer' },
  () => api.post(`/staff/products/${target.value.id}/transfer`, f.value), 'Stock transferred')
const saveAdjust = () => {
  const before = qtyAt(target.value, { id: f.value.branch_id })
  return run({ title: 'Adjust the stock count?', body: `${target.value.name} at ${branchName(f.value.branch_id)}: ${before} → ${f.value.counted} (${f.value.reason}).`, ok: 'Adjust stock', tone: 'danger' },
    () => api.post(`/staff/products/${target.value.id}/adjust`, f.value), 'Stock adjusted')
}
async function remove(p) {
  if (!(await ask({ title: `Remove ${p.name}?`, body: 'It disappears from the app shop. Past orders keep it.', ok: 'Remove', tone: 'danger' }))) return
  try {
    await api.delete(`/staff/products/${p.id}`)
    close()
    load()
    notify('Product removed')
  } catch (e) {
    notify(e.message)
  }
}

const typeLabel = { in: 'Received', sold: 'Sold', adjust: 'Adjusted', transfer: 'Transfer' }
const typeClass = { in: 'paid', sold: 'awaiting', adjust: 'pending', transfer: '' }
const exportAll = () => exportCsv('lavish-inventory', rows.value.map((p) => ({
  SKU: p.sku, Product: p.name, Category: p.category, Price_ETB: p.price, ...Object.fromEntries(branches.value.map((b) => [b.name, qtyAt(p, b)])),
  On_hand: p.stock, Reserved: p.reserved, Available: p.available, Reorder_level: p.reorder_level, Active: p.active ? 'yes' : 'no',
})))
// Shown 25 at a time.
const localPage = ref(1)
const PER = 25
const pageRows = computed(() => rows.value.slice((localPage.value - 1) * PER, localPage.value * PER))
const localMeta = computed(() => ({ current_page: localPage.value, last_page: Math.max(1, Math.ceil(rows.value.length / PER)), per_page: PER, total: rows.value.length }))
watch(() => rows.value.length, () => { if (localPage.value > localMeta.value.last_page) localPage.value = 1 })
</script>

<template>
  <div class="head">
    <div>
      <h1>Products & inventory</h1>
      <p v-if="edit">Post products with prices for the mobile app shop. Stock goes up when you receive products and down when an order is delivered.</p>
      <p v-else>Track stock in every branch and transfer products between branches. Every change is logged.</p>
    </div>
    <div class="row">
      <button class="btn ghost" @click="exportAll">⬇ Export</button>
      <button v-if="canCreate" class="btn gold" @click="open('new')">+ Add product</button>
    </div>
  </div>

  <div class="grid g4" style="margin-bottom: 20px">
    <div class="card stat gold"><div class="n">{{ units }}</div><div class="l">Units on hand</div></div>
    <div v-if="meta.stock_value !== undefined" class="card stat"><div class="n">{{ etb(meta.stock_value) }}</div><div class="l">Stock value (retail)</div></div>
    <div v-else class="card stat"><div class="n">{{ rows.length }}</div><div class="l">Products listed</div></div>
    <div class="card stat"><div class="n">{{ reservedTotal }}</div><div class="l">Reserved for open orders</div></div>
    <div class="card stat"><div class="n" :style="{ color: lowCount ? 'var(--bad)' : '' }">{{ lowCount }}</div><div class="l">Need reorder</div></div>
  </div>
  <p v-if="error" class="note" style="color: var(--bad)">{{ error }}</p>

  <div class="card">
    <input v-model="search" placeholder="Search by product name or SKU…" style="max-width: 320px; margin-bottom: 12px" />
    <table>
      <thead><tr><th>Product</th><th>Price</th><th v-for="b in branches" :key="b.id">{{ b.name }}</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Level</th><th></th></tr></thead>
      <tbody>
        <tr v-for="p in pageRows" :key="p.id" :class="{ off: !p.active }">
          <td><span class="pimg" :style="p.image_url ? { backgroundImage: `url(${p.image_url})` } : { background: `hsl(${p.hue ?? 30} 40% 85%)` }"></span>{{ p.name }}<small>{{ p.sku }} · {{ p.category }}<template v-if="p.size"> · {{ p.size }}</template><template v-if="!p.active"> · hidden</template></small></td>
          <td>{{ etb(p.price) }}</td>
          <td v-for="b in branches" :key="b.id">{{ qtyAt(p, b) }}</td>
          <td><b>{{ p.stock }}</b></td>
          <td>{{ p.reserved || '—' }}</td>
          <td :style="{ color: p.available < 0 ? 'var(--bad)' : '' }">{{ p.available }}</td>
          <td><span class="badge" :class="{ open: level(p) === 'out', pending: level(p) === 'low', active: level(p) === 'ok' }">{{ level(p) === 'out' ? 'Out of stock' : level(p) === 'low' ? 'Reorder (≤ ' + p.reorder_level + ')' : 'In stock' }}</span></td>
          <td class="row">
            <button v-if="canStock" class="btn gold sm" @click="open('receive', p)">+ Receive</button>
            <button v-if="canEdit" class="btn ghost sm" @click="open('edit', p)">Edit</button>
            <button v-if="canStock" class="btn ghost sm" @click="open('adjust', p)">Adjust</button>
            <button v-if="auth.can('products.transfer') && branches.length > 1" class="btn gold sm" @click="open('transfer', p)">⇄ Transfer</button>
            <button class="btn ghost sm" @click="open('history', p)">History</button>
          </td>
        </tr>
        <tr v-if="!rows.length"><td :colspan="7 + branches.length" class="empty">{{ search ? 'No products found' : 'No products yet — add the first one.' }}</td></tr>
      </tbody>
    </table>
    <Pager :meta="localMeta" label="products" @go="(n) => (localPage = n)" />
  </div>

  <div v-if="modal" class="modal-bg" @click.self="close">
    <form v-if="modal === 'new' || modal === 'edit'" class="modal" style="width: min(600px, 95vw); max-height: 92vh; overflow: auto" @submit.prevent="modal === 'new' ? saveNew() : saveEdit()">
      <h2>{{ modal === 'new' ? 'New product' : 'Edit ' + target.name }}</h2>
      <label>Name</label><input v-model="f.name" required />
      <div class="qgrid">
        <div><label>Category</label><select v-model="f.category"><option v-for="c in meta.categories" :key="c">{{ c }}</option></select></div>
        <div><label>Size</label><input v-model="f.size" placeholder="e.g. 30 ml" /></div>
        <div><label>Price (ETB)</label><input v-model.number="f.price" type="number" min="0" required /></div>
        <div><label>Reorder when stock is at or below</label><input v-model.number="f.reorder_level" type="number" min="0" /></div>
        <div v-if="modal === 'new'"><label>Opening stock ({{ branchName(branches[0]?.id) }})</label><input v-model.number="f.opening_stock" type="number" min="0" /></div>
      </div>
      <label>Photo <small class="note">(shown in the app shop)</small></label>
      <FilePicker v-model="f.image" accept="image/*" :current="modal === 'edit' ? target?.image_url ?? '' : ''" title="Add a product photo" hint="Square photo on a plain background works best · JPG, PNG or WebP · up to 4 MB" :max-mb="4" />
      <label>Description (shown in the app)</label><textarea v-model="f.description" rows="3"></textarea>
      <label>How to use</label><textarea v-model="f.usage" rows="2"></textarea>
      <label v-if="modal === 'edit'" class="row" style="color: var(--ink); margin-top: 12px"><input v-model="f.active" type="checkbox" style="width: auto" /> Show in the app shop</label>
      <div class="row" style="margin-top: 20px; justify-content: space-between">
        <button v-if="modal === 'edit' && canDelete" type="button" class="btn danger" @click="remove(target)">Remove</button><span v-else></span>
        <div class="row"><button type="button" class="btn ghost" @click="close">Cancel</button><button class="btn gold" :disabled="busy">Save product</button></div>
      </div>
    </form>

    <form v-else-if="modal === 'receive'" class="modal" @submit.prevent="saveReceive">
      <h2>Receive stock</h2>
      <p class="note">{{ target.name }} · now {{ target.stock }} on hand</p>
      <label>Quantity received</label><input v-model.number="f.quantity" type="number" min="1" required />
      <label>Receive at branch</label>
      <select v-model.number="f.branch_id"><option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }} ({{ qtyAt(target, b) }})</option></select>
      <label>Supplier / invoice reference</label><input v-model="f.reference" placeholder="e.g. INV-2041 · Addis Pharma" />
      <p class="serif" style="font-size: 22px; margin-top: 14px">New balance: {{ target.stock + (+f.quantity || 0) }}</p>
      <div class="row" style="margin-top: 14px; justify-content: flex-end"><button type="button" class="btn ghost" @click="close">Cancel</button><button class="btn gold" :disabled="busy">Add to inventory</button></div>
    </form>

    <form v-else-if="modal === 'transfer'" class="modal" @submit.prevent="saveTransfer">
      <h2>Transfer stock</h2>
      <p class="note">{{ target.name }} · {{ branches.map((b) => b.name + ' ' + qtyAt(target, b)).join(' · ') }}</p>
      <label>From</label><select v-model.number="f.from_branch_id"><option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }} ({{ qtyAt(target, b) }})</option></select>
      <label>To</label><select v-model.number="f.to_branch_id"><option v-for="b in branches.filter((x) => x.id !== f.from_branch_id)" :key="b.id" :value="b.id">{{ b.name }} ({{ qtyAt(target, b) }})</option></select>
      <label>Quantity</label><input v-model.number="f.quantity" type="number" min="1" :max="qtyAt(target, { id: f.from_branch_id })" required />
      <div class="row" style="margin-top: 20px; justify-content: flex-end"><button type="button" class="btn ghost" @click="close">Cancel</button><button class="btn gold" :disabled="busy || f.from_branch_id === f.to_branch_id">Transfer</button></div>
    </form>

    <form v-else-if="modal === 'adjust'" class="modal" @submit.prevent="saveAdjust">
      <h2>Adjust stock</h2>
      <label>Branch</label>
      <select v-model.number="f.branch_id" @change="f.counted = qtyAt(target, { id: f.branch_id })"><option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }} (system: {{ qtyAt(target, b) }})</option></select>
      <label>Counted quantity</label><input v-model.number="f.counted" type="number" min="0" required />
      <label>Reason</label>
      <select v-model="f.reason"><option>Count correction</option><option>Damaged</option><option>Expired</option><option>Returned by client</option><option>Sample / internal use</option></select>
      <p class="serif" style="font-size: 22px; margin-top: 14px" :style="{ color: f.counted - qtyAt(target, { id: f.branch_id }) < 0 ? 'var(--bad)' : 'var(--ok)' }">
        Change: {{ f.counted - qtyAt(target, { id: f.branch_id }) > 0 ? '+' : '' }}{{ f.counted - qtyAt(target, { id: f.branch_id }) }}
      </p>
      <div class="row" style="margin-top: 14px; justify-content: flex-end"><button type="button" class="btn ghost" @click="close">Cancel</button><button class="btn gold" :disabled="busy">Save adjustment</button></div>
    </form>

    <div v-else class="modal" style="width: min(680px, 95vw); max-height: 90vh; overflow: auto">
      <h2>{{ target.name }}</h2>
      <p class="note">{{ target.sku }} · {{ target.stock }} on hand · {{ target.reserved }} reserved</p>
      <table style="margin-top: 12px">
        <thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Balance</th><th>Reference</th></tr></thead>
        <tbody>
          <tr v-for="m in history" :key="m.id">
            <td>{{ when(m.created_at) }}<small>{{ m.by }}</small></td>
            <td><span class="badge" :class="typeClass[m.type]">{{ typeLabel[m.type] }}</span><small>{{ m.type === 'transfer' ? `${m.from_branch} → ${m.to_branch}` : m.reason }}</small></td>
            <td :style="{ color: m.quantity < 0 ? 'var(--bad)' : 'var(--ok)', fontWeight: 600 }">{{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}</td>
            <td>{{ m.balance_after }}</td>
            <td>{{ m.reference ?? '—' }}</td>
          </tr>
          <tr v-if="!history.length"><td colspan="5" class="empty">No movements yet</td></tr>
        </tbody>
      </table>
      <div class="row" style="margin-top: 14px; justify-content: flex-end"><button class="btn ghost" @click="close">Close</button></div>
    </div>
  </div>
</template>

<style scoped>
td small { display: block; color: var(--muted); font-size: 12px; }
tr.off { opacity: .55; }
.pimg { display: inline-block; width: 30px; height: 30px; border-radius: 8px; background-size: cover; background-position: center; vertical-align: middle; margin-right: 8px; float: left; }
label { display: block; font-size: 13px; margin: 10px 0 4px; }
textarea { width: 100%; }
</style>
