<script setup>
import { useRouter } from 'vue-router'
import { ROLES, login, nav } from '../store'

const router = useRouter()
const enter = (r) => { login(r); router.push('/' + nav()[0]) }
</script>

<template>
  <div class="login">
    <div class="hero">
      <div class="hero-copy">
        <span class="eyebrow">LAVISH STAFF PORTAL</span>
        <h2>Ultra Luxury in Science and Beauty.</h2>
        <p>One home for the Lavish team — caring for every client, shaping new careers and growing a brand built on trust.</p>
      </div>

      <div class="showcase">
        <div class="motto">
          <q>Where medical science meets the art of beauty.</q>
          <small>THE LAVISH PROMISE</small>
        </div>

        <div class="pillars">
          <div class="pillar">
            <div class="ic">✚</div>
            <b>Science-led care</b>
            <span>Every treatment is planned and performed by licensed doctors, guided by evidence.</span>
          </div>
          <div class="pillar">
            <div class="ic">✦</div>
            <b>Ultra-luxury experience</b>
            <span>Calm, private spaces and personal attention from the first hello to the last follow-up.</span>
          </div>
          <div class="pillar">
            <div class="ic">❦</div>
            <b>Academy of excellence</b>
            <span>Training the next generation of aesthetic professionals with hands-on mastery.</span>
          </div>
        </div>

        <div class="promise">
          <span>Addis Ababa · Bole</span><i></i><span>Addis Ababa · Kazanchis</span><i></i><span>Hawassa</span>
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
