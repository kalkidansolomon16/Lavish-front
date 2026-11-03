<script setup>
import ClientLink from '../components/ClientLink.vue'
import { state, actions, clientName, etb, can } from '../store'
import { exportCsv, pushNotif } from '../ui'

const product = (id) => state.products.find((p) => p.id === id)
const short = (o) => o.status === 'placed' && (o.lines ?? []).filter((l) => product(l.productId).stock < l.qty).map((l) => product(l.productId).name)

function deliver(o) {
  const low = actions.confirmDelivery(o)
  low?.forEach((p) => pushNotif(`Low stock: ${p.name} — ${p.stock} left`, ['ecommerce', 'gm', 'ceo'], '/products'))
}
const exportAll = () => exportCsv('lavish-orders', state.orders.map((o) => ({ Order: o.id, Client: clientName(o.clientId), Items: o.items, Total_ETB: o.total, Payment: o.payment, Address: o.address, Status: o.status })))
</script>

<template>
  <div class="head">
    <div>
      <h1>Product orders</h1>
      <p>Orders placed by clients in the mobile app. Confirming delivery deducts stock and notifies the client in the app.</p>
    </div>
    <button class="btn ghost" @click="exportAll">⬇ Export CSV</button>
  </div>
  <div class="card">
    <table>
      <thead><tr><th>Order</th><th>Client</th><th>Items</th><th>Total</th><th>Payment</th><th>Deliver to</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="o in state.orders" :key="o.id">
          <td>#{{ o.id }}<small>{{ o.date }}</small></td>
          <td><ClientLink :id="o.clientId" /></td>
          <td>
            {{ o.items }}
            <small v-if="short(o)?.length" style="color: var(--bad)">⚠ Not enough stock: {{ short(o).join(', ') }}</small>
            <small v-else-if="o.status === 'placed'">Stock reserved ✓</small>
            <small v-else>Stock deducted ✓</small>
          </td>
          <td>{{ etb(o.total) }}</td>
          <td>
            <span class="badge" :class="o.payment === 'paid' ? 'paid' : 'unpaid'">{{ o.payment === 'paid' ? 'paid' : 'not paid' }}</span>
            <small>{{ o.method || '—' }}</small>
            <button v-if="o.payment !== 'paid' && can('orders.deliver')" class="btn ghost sm" style="margin-top: 4px" @click="actions.markOrderPaid(o)">Mark paid</button>
          </td>
          <td>{{ o.address }}</td>
          <td><span class="badge" :class="o.status">{{ o.status }}</span><small v-if="o.notified">Client notified ✓</small></td>
          <td><button v-if="o.status === 'placed' && can('orders.deliver')" class="btn gold sm" @click="deliver(o)">Confirm delivery</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
