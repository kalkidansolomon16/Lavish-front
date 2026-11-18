<script setup>
// Lavish Rewards — members (enrolled at the desk), their points, requests to use points, and the program.
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../stores/auth'
import PointsRequests from '../components/rewards/PointsRequests.vue'
import RewardsClients from '../components/rewards/RewardsClients.vue'
import RewardsProgram from '../components/rewards/RewardsProgram.vue'
import RewardsCampaigns from '../components/rewards/RewardsCampaigns.vue'
import RewardsReports from '../components/rewards/RewardsReports.vue'
import RewardsAudit from '../components/rewards/RewardsAudit.vue'

const auth = useAuth()
const TABS = [
  { key: 'clients', label: 'Members', show: () => true },
  { key: 'requests', label: 'Points requests', show: () => auth.can('rewards.requests') },
  { key: 'program', label: 'Program', show: () => true },
  { key: 'campaigns', label: 'Campaigns', show: () => true },
  { key: 'reports', label: 'Reports', show: () => auth.can('finance.revenue') },
  { key: 'audit', label: 'Audit log', show: () => auth.can('rewards.manage') },
]
const tabs = computed(() => TABS.filter((t) => t.show()))
const route = useRoute()
const tab = ref(tabs.value.some((t) => t.key === route.query.tab) ? route.query.tab : 'clients')
</script>

<template>
  <div class="head">
    <div>
      <h1>Lavish Rewards</h1>
      <p>Clients who want the program are enrolled here at the desk. Members earn points on completed, paid visits and shop orders, and ask in the app to use them — on a treatment, shop products or something else.</p>
    </div>
  </div>
  <div class="tabs">
    <button v-for="t in tabs" :key="t.key" :class="{ on: tab === t.key }" @click="tab = t.key">{{ t.label }}</button>
  </div>
  <RewardsClients v-if="tab === 'clients'" />
  <PointsRequests v-else-if="tab === 'requests'" />
  <RewardsProgram v-else-if="tab === 'program'" />
  <RewardsCampaigns v-else-if="tab === 'campaigns'" />
  <RewardsReports v-else-if="tab === 'reports'" />
  <RewardsAudit v-else-if="tab === 'audit'" />
</template>
