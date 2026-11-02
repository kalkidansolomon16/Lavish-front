<script setup>
import { useRouter } from 'vue-router'
import { ROLES, login } from '../store'
import { ui } from '../ui'
import BarChart from '../components/BarChart.vue'

const router = useRouter()
const enter = (r) => { login(r); router.push('/dashboard') }
</script>

<template>
  <div class="login">
    <div class="hero">
      <div class="hero-copy">
        <span class="eyebrow">LAVISH STAFF PORTAL</span>
        <h2>Ultra Luxury in Science and Beauty.</h2>
        <p>Six portals — CEO, General Manager, Reception, E-commerce, Doctors and Academy — connected to the Lavish mobile app.</p>
      </div>

      <div class="floaters">
        <div class="glass f1">
          <div class="g-title">Weekly revenue <small>ETB</small></div>
          <BarChart :data="ui.revenue" money />
        </div>

        <div class="glass f2">
          <span class="dot ok">✓</span>
          <div><b>Appointment approved</b><small>Dr. Meron Alemu was notified instantly</small></div>
        </div>

        <div class="glass f3">
          <div class="g-title">Client chat</div>
          <div class="mini-bubble">Hi Doctor, is mild dryness normal after the facial?</div>
          <div class="mini-bubble me">Yes — use the Hydra Cream twice daily. 🌿</div>
        </div>

        <div class="glass f4">
          <div class="pill"><b>3</b><small>pending approvals</small></div>
          <div class="pill"><b>2</b><small>orders to deliver</small></div>
          <div class="pill"><b>5</b><small>academy students</small></div>
        </div>

        <div class="glass f5">
          <span class="dot">🔔</span>
          <div><b>New complaint received</b><small>General Manager has been alerted</small></div>
        </div>
      </div>
    </div>

    <div class="box">
      <div class="inner">
        <img src="/img/logo-white.png" alt="Lavish Medical Spa" />
        <p>Staff portal · prototype demo<br />Choose a portal to preview it</p>
        <div class="roles" style="grid-template-columns: 1fr 1fr">
          <button v-for="(r, key) in ROLES" :key="key" @click="enter(key)">
            <b>{{ r.label }}</b><span>{{ r.blurb }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
