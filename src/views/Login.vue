<script setup>
// Staff sign-in against the Lavish API (phone in any format, or email).
// Accounts created by a manager hold a temporary password: step 2 asks for a new one.
import { ask } from '../confirm'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const router = useRouter()
const auth = useAuth()

const form = ref({ login: '', password: '' })
const pw = ref({ current: '', next: '', confirm: '' })
const busy = ref(false)
const error = ref('')
const fieldErrors = ref({})
const step = computed(() => (auth.needsNewPassword ? 'password' : 'login'))

async function signIn() {
  error.value = ''
  busy.value = true
  try {
    await auth.login(form.value.login.trim(), form.value.password)
    if (auth.needsNewPassword) pw.value.current = form.value.password
    else router.push(auth.home)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function setPassword() {
  error.value = ''
  fieldErrors.value = {}
  busy.value = true
  try {
    await auth.changePassword(pw.value.current, pw.value.next, pw.value.confirm)
    router.push(auth.home)
  } catch (e) {
    error.value = e.code === 'validation_failed' ? '' : e.message
    fieldErrors.value = e.errors
  } finally {
    busy.value = false
  }
}

async function cancel() {
  if (!(await ask({ title: 'Use another account?', body: 'You will be signed out without changing the temporary password.', ok: 'Sign out', tone: 'danger' }))) return
  await auth.logout()
  form.value.password = ''
}

const input = 'w-full rounded-input border border-white/15 bg-white/95 px-4 py-3 text-ink outline-none transition focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/25'

// ───────────────────────── Hero (visual only) ─────────────────────────
const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const headline = [
  { w: 'Ultra' }, { w: 'Luxury' }, { w: 'in', br: true },
  { w: 'Science', gold: true }, { w: '&', gold: true }, { w: 'Beauty.', gold: true },
]
// Wording, services and addresses follow lavishmedicalspa.com
// Headline split into its two lines, keeping one running index for the stagger
const headlineLines = headline.reduce((lines, w, i) => {
  lines[lines.length - 1].push({ ...w, i })
  if (w.br) lines.push([])
  return lines
}, [[]])
const stats = [
  { to: 3, suffix: '', label: 'Branches' },
  { to: 6, suffix: '', label: 'Specialties' },
  { to: 8, suffix: '', label: 'Signature treatments' },
]
const counts = ref(stats.map((s) => (reduced ? s.to : 0)))
const treatments = ['Signature HydraFacial', 'Botox & Dermal Fillers', 'HIFU Face & Neck Lift', 'PRP Skin Rejuvenation', 'Morpheus8 & Microneedling', 'Hair Restoration Solutions', 'Body Contouring & Skin Tightening', 'Advanced Dermatology Treatments']
const pillars = [
  { ic: '✚', t: 'Premium Dermatology' },
  { ic: '✦', t: 'Aesthetic' },
  { ic: '❀', t: 'Sexual Wellness' },
  { ic: '◈', t: 'Body Transformation' },
  { ic: '❦', t: 'Hair Transplant' },
  { ic: '☾', t: 'Massage Therapy' },
]
const haven = [
  { t: 'Wellness', d: 'Care that starts with healthy skin and a calm mind.' },
  { t: 'Beauty', d: 'World-class aesthetics, planned by licensed doctors.' },
  { t: 'Confidence', d: 'Results our clients carry with them every day.' },
]
const journey = [
  { t: 'Consult', d: 'A private conversation with a licensed doctor about the goals and the science behind them.' },
  { t: 'Treat', d: 'Calm rooms, proven technology and a team that knows every client by name.' },
  { t: 'Follow up', d: 'Aftercare, prescriptions and check-ins until the result is exactly right.' },
]
const cities = [
  { name: 'Addis Ababa', note: 'Bole, Adorsam Apartments, 5th floor', x: 90, y: 128 },
  { name: 'Adama', note: 'Kanab Mall, 3rd floor, near the Post Office', x: 232, y: 158 },
  { name: 'Dire Dawa', note: 'Sabian Ozie Plaza, 4th floor', x: 520, y: 72 },
]
const route = 'M90 128 C 140 170, 190 168, 232 158 C 330 135, 430 60, 520 72'

const hero = ref(null)
const canvas = ref(null)
const loginInput = ref(null)
const progress = ref(0)
const scrolled = ref(false)
const jp = ref(0) // journey progress 0..1

let io, raf, countTimer
const clamp = (v) => Math.min(1, Math.max(0, v))

function onScroll() {
  const el = hero.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  progress.value = max > 0 ? el.scrollTop / max : 0
  scrolled.value = el.scrollTop > 40
  const j = el.querySelector('.journey')
  if (j) {
    const r = j.getBoundingClientRect(), h = el.getBoundingClientRect()
    jp.value = clamp((h.top + h.height * 0.62 - r.top) / r.height)
  }
}
function spotlight(e) {
  const r = hero.value.getBoundingClientRect()
  hero.value.style.setProperty('--mx', e.clientX - r.left + 'px')
  hero.value.style.setProperty('--my', e.clientY - r.top + 'px')
}
function tilt(e) {
  const c = e.currentTarget, r = c.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
  c.style.setProperty('--ry', (x - 0.5) * 14 + 'deg')
  c.style.setProperty('--rx', (0.5 - y) * 14 + 'deg')
  c.style.setProperty('--gx', x * 100 + '%')
  c.style.setProperty('--gy', y * 100 + '%')
}
function untilt(e) {
  const c = e.currentTarget
  c.style.setProperty('--rx', '0deg')
  c.style.setProperty('--ry', '0deg')
}
const explore = () => hero.value?.querySelector('.more')?.scrollIntoView({ behavior: 'smooth' })
// "Sign in to the portal": bring the card into view, make it glow, put the cursor in the first field
const glass = ref(null)
const flash = ref(false)
function focusSignIn() {
  const card = glass.value
  if (!card) return
  card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  flash.value = false
  requestAnimationFrame(() => { flash.value = true })
  setTimeout(() => { flash.value = false }, 1600)
  setTimeout(() => (loginInput.value ?? card.querySelector('input'))?.focus({ preventScroll: true }), 350)
}

// Gold dust rising through the hero
function startDust() {
  const cv = canvas.value
  if (!cv || reduced) return
  const ctx = cv.getContext('2d')
  let w, h, dots
  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = cv.clientWidth; h = cv.clientHeight
    cv.width = w * dpr; cv.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  size()
  const make = (y) => ({ x: Math.random() * w, y: y ?? Math.random() * h, r: Math.random() * 1.8 + 0.4, s: Math.random() * 0.35 + 0.12, a: Math.random() * 0.6 + 0.2, t: Math.random() * 6.28 })
  dots = Array.from({ length: 70 }, () => make())
  window.addEventListener('resize', size)
  const frame = () => {
    ctx.clearRect(0, 0, w, h)
    for (const d of dots) {
      d.y -= d.s; d.t += 0.02; d.x += Math.sin(d.t) * 0.25
      if (d.y < -10) Object.assign(d, make(h + 10))
      const tw = d.a * (0.6 + 0.4 * Math.sin(d.t * 2))
      ctx.beginPath()
      ctx.fillStyle = `rgba(243, 214, 190, ${tw})`
      ctx.shadowColor = 'rgba(203, 165, 144, .9)'
      ctx.shadowBlur = 8
      ctx.arc(d.x, d.y, d.r, 0, 6.283)
      ctx.fill()
    }
    raf = requestAnimationFrame(frame)
  }
  frame()
  onBeforeUnmount(() => window.removeEventListener('resize', size))
}

function countUp() {
  if (reduced) return
  const start = performance.now(), dur = 1800
  const tick = (now) => {
    const p = clamp((now - start) / dur), e = 1 - Math.pow(1 - p, 3)
    counts.value = stats.map((s) => Math.round(s.to * e))
    if (p < 1) countTimer = requestAnimationFrame(tick)
  }
  countTimer = requestAnimationFrame(tick)
}

onMounted(() => {
  hero.value?.addEventListener('scroll', onScroll, { passive: true })
  io = new IntersectionObserver((entries) => entries.forEach((e) => {
    // also reveal anything already scrolled past, so a fast scroll never leaves a gap
    if (e.isIntersecting || e.boundingClientRect.bottom < e.rootBounds?.top) { e.target.dataset.in = ''; io.unobserve(e.target) }
  }), { threshold: 0.18 })
  hero.value?.querySelectorAll('.reveal').forEach((el) => io.observe(el))
  startDust()
  setTimeout(countUp, 1100)
})
onBeforeUnmount(() => {
  hero.value?.removeEventListener('scroll', onScroll)
  io?.disconnect()
  cancelAnimationFrame(raf)
  cancelAnimationFrame(countTimer)
})
</script>

<template>
  <div class="login">
    <!-- ═════════════ HERO ═════════════ -->
    <div ref="hero" class="lx" @mousemove="spotlight">
      <!-- Background that stays in view while the story scrolls -->
      <div class="stage" aria-hidden="true">
        <div class="aurora a1"></div><div class="aurora a2"></div><div class="aurora a3"></div>
        <div class="grain"></div>
        <canvas ref="canvas" class="dust"></canvas>
        <div class="spot"></div>
      </div>
      <span class="progress" :style="{ transform: `scaleX(${progress})` }"></span>

      <!-- Screen 1 -->
      <section class="first">
        <div class="photo" aria-hidden="true"><img src="/img/clinic-reception.jpg" alt="" /></div>
        <div class="copy">
          <span class="eyebrow fade" style="--d: .1s"><i></i>WELCOME TO LAVISH MEDICAL SPA</span>
          <h1 class="title">
            <span v-for="(line, l) in headlineLines" :key="l" class="hl">
              <span v-for="w in line" :key="w.i" class="word" :class="{ gold: w.gold }" :style="{ '--i': w.i }">{{ w.w }}</span>
            </span>
          </h1>
          <p class="lead fade" style="--d: 1s">Experience <b>world-class aesthetics</b> right here at home. This is the staff portal for the team that makes it happen.</p>

          <div class="stats fade" style="--d: 1.25s">
            <div v-for="(s, i) in stats" :key="s.label" class="stat">
              <b>{{ counts[i] }}{{ s.suffix }}</b><span>{{ s.label }}</span>
            </div>
          </div>
        </div>

        <span class="badge fade" style="--d: 1.6s"><i></i>Bole · Addis Ababa</span>

        <button class="cue" :class="{ gone: scrolled }" @click="explore">
          <span class="mouse"><i></i></span>Scroll to explore
        </button>
      </section>

      <!-- The story -->
      <div class="more">
        <div class="marquee reveal" aria-hidden="true">
          <div class="row r1"><span v-for="(t, i) in [...treatments, ...treatments]" :key="'a' + i">{{ t }}<i>✦</i></span></div>
          <div class="row r2"><span v-for="(t, i) in [...treatments, ...treatments].reverse()" :key="'b' + i">{{ t }}<i>✦</i></span></div>
        </div>

        <section class="sec">
          <span class="eyebrow reveal"><i></i>A HAVEN OF TRANQUILITY</span>
          <h2 class="h reveal">Allow your body, mind and soul <em>sense a haven of tranquility.</em></h2>
          <div class="haven">
            <div class="frame reveal"><img src="/img/clinic-reception.jpg" alt="The Lavish reception in Bole, Addis Ababa" loading="lazy" /></div>
            <ul class="trio">
              <li v-for="(h, i) in haven" :key="h.t" class="reveal" :style="{ '--d': i * 0.12 + 's' }"><strong>{{ h.t }}</strong><span>{{ h.d }}</span></li>
            </ul>
          </div>
        </section>

        <section class="sec">
          <span class="eyebrow reveal"><i></i>OUR SERVICES</span>
          <h2 class="h reveal">The best of <em>our services.</em></h2>
          <div class="cards">
            <article v-for="(p, i) in pillars" :key="p.t" class="card reveal" :style="{ '--d': (i % 3) * 0.1 + 's' }" @mousemove="tilt" @mouseleave="untilt">
              <div class="glare"></div>
              <span class="ic">{{ p.ic }}</span>
              <b>{{ p.t }}</b>
              <span class="num">0{{ i + 1 }}</span>
            </article>
          </div>
        </section>
        <section class="sec journey" :style="{ '--jp': jp }">
          <span class="eyebrow reveal"><i></i>THE LAVISH JOURNEY</span>
          <h2 class="h reveal">From first hello <em>to final result.</em></h2>
          <ol class="steps">
            <span class="line"><span class="fill"></span></span>
            <li v-for="(s, i) in journey" :key="s.t" class="step reveal" :class="{ lit: jp > (i + 0.35) / 3 }">
              <span class="dot">{{ i + 1 }}</span>
              <div><strong>{{ s.t }}</strong><p>{{ s.d }}</p></div>
            </li>
          </ol>
        </section>

        <section class="sec">
          <span class="eyebrow reveal"><i></i>OUR BRANCHES</span>
          <h2 class="h reveal">One standard of care, <em>three cities.</em></h2>
          <div class="map reveal">
            <svg viewBox="0 0 600 220" aria-hidden="true">
              <defs>
                <linearGradient id="lxRoute" x1="0" x2="1">
                  <stop offset="0" stop-color="#f6e3d4" /><stop offset="1" stop-color="#cba590" />
                </linearGradient>
              </defs>
              <path :d="route" class="route-bg" />
              <path :d="route" class="route" pathLength="1" />
              <circle v-if="!reduced" r="5" class="traveller">
                <animateMotion :path="route" dur="5s" begin="1.6s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
              </circle>
              <g v-for="(c, i) in cities" :key="c.name" class="pin" :style="{ '--d': 0.6 + i * 0.45 + 's' }">
                <circle :cx="c.x" :cy="c.y" r="18" class="halo" />
                <circle :cx="c.x" :cy="c.y" r="6" class="core" />
                <text :x="c.x" :y="c.y - 26" text-anchor="middle">{{ c.name }}</text>
              </g>
            </svg>
          </div>
          <div class="cities">
            <div v-for="(c, i) in cities" :key="c.name" class="city reveal" :style="{ '--d': i * 0.12 + 's' }">
              <strong>{{ c.name }}</strong><small>{{ c.note }}</small>
            </div>
          </div>
        </section>

        <section class="sec closing reveal">
          <svg class="bloom" viewBox="-260 -260 520 520" aria-hidden="true">
            <defs>
              <linearGradient id="lxGold" x1="0" y1="-1" x2="0" y2="1">
                <stop offset="0" stop-color="#fbeee4" />
                <stop offset=".45" stop-color="#cba590" />
                <stop offset="1" stop-color="#8f6a55" />
              </linearGradient>
              <radialGradient id="lxCore">
                <stop offset="0" stop-color="#fff3ea" stop-opacity=".9" />
                <stop offset="1" stop-color="#cba590" stop-opacity="0" />
              </radialGradient>
            </defs>
            <g class="rings">
              <circle r="238" class="ring thin" />
              <circle r="212" class="ring dash" />
              <circle r="236" cy="0" cx="0" class="ring glow" pathLength="1" />
            </g>
            <g class="orbit">
              <circle cx="0" cy="-212" r="4" class="sat" />
              <circle cx="0" cy="212" r="2.5" class="sat dim" />
            </g>
            <g class="petals">
              <path v-for="i in 8" :key="'b' + i" class="petal" :style="{ '--i': i, transform: `rotate(${(i - 1) * 45}deg)` }"
                d="M0 0 C 46 -52, 46 -140, 0 -196 C -46 -140, -46 -52, 0 0" pathLength="1" />
              <path v-for="i in 8" :key="'s' + i" class="petal small" :style="{ '--i': i + 8, transform: `rotate(${(i - 1) * 45 + 22.5}deg)` }"
                d="M0 0 C 30 -40, 30 -98, 0 -138 C -30 -98, -30 -40, 0 0" pathLength="1" />
            </g>
            <circle r="70" fill="url(#lxCore)" class="core" />
            <circle r="16" class="seed" />
          </svg>
          <span class="eyebrow"><i></i>WHAT ARE YOU WAITING FOR…</span>
          <q>Elevating the standards of dermatology <em>and aesthetics in Ethiopia.</em></q>
          <button class="cta" @click="focusSignIn">Sign in to the portal <span>→</span></button>
        </section>
      </div>
    </div>

    <!-- ═════════════ SIGN IN ═════════════ -->
    <div class="box">
      <div class="inner">
        <div ref="glass" class="glass" :class="{ flash }">
          <img class="logo" src="/img/logo-white.png" alt="Lavish Medical Spa" />
          <form v-if="step === 'login'" class="mt-6 flex flex-col gap-4 text-left" @submit.prevent="signIn">
            <p class="text-center text-mint">Staff portal · sign in with your phone number or email</p>
            <label class="flex flex-col gap-1.5 text-sm text-mint">
              Phone or email
              <input ref="loginInput" v-model="form.login" :class="input" autocomplete="username" placeholder="0911 22 33 44" required />
            </label>
            <label class="flex flex-col gap-1.5 text-sm text-mint">
              Password
              <input v-model="form.password" :class="input" type="password" autocomplete="current-password" required />
            </label>
            <p v-if="error" class="err" role="alert">{{ error }}</p>
            <button class="go mt-2 rounded-btn px-4 py-3 font-medium text-ink disabled:opacity-60" :disabled="busy">
              {{ busy ? 'Signing in…' : 'Sign in' }}
            </button>
            <p class="note-light">Forgot your password? Ask your manager to reset it from Staff.</p>
          </form>

          <form v-else class="mt-6 flex flex-col gap-4 text-left" @submit.prevent="setPassword">
            <p class="text-center text-mint">Welcome, {{ auth.user.name }}. Choose your own password to continue.</p>
            <label class="flex flex-col gap-1.5 text-sm text-mint">
              Temporary password
              <input v-model="pw.current" :class="input" type="password" autocomplete="current-password" required />
              <small v-if="fieldErrors.current_password" class="ferr">{{ fieldErrors.current_password[0] }}</small>
            </label>
            <label class="flex flex-col gap-1.5 text-sm text-mint">
              New password <span class="hint">(at least 8 characters)</span>
              <input v-model="pw.next" :class="input" type="password" autocomplete="new-password" minlength="8" required />
              <small v-if="fieldErrors.password" class="ferr">{{ fieldErrors.password[0] }}</small>
            </label>
            <label class="flex flex-col gap-1.5 text-sm text-mint">
              Repeat new password
              <input v-model="pw.confirm" :class="input" type="password" autocomplete="new-password" required />
            </label>
            <p v-if="error" class="err" role="alert">{{ error }}</p>
            <button class="go mt-2 rounded-btn px-4 py-3 font-medium text-ink disabled:opacity-60" :disabled="busy">
              {{ busy ? 'Saving…' : 'Save and continue' }}
            </button>
            <button type="button" class="alt" @click="cancel">Use another account</button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ════════ Sign-in form: readable on the teal glass (the global `label` rule is grey) ════════ */
.glass label { display: flex; margin: 0; color: #eef6f4; font-size: 13.5px; font-weight: 500; letter-spacing: .1px; }
.glass .hint { color: #cfe3df; font-size: 12px; font-weight: 400; }
.glass .err { margin: 0; padding: 10px 14px; border-radius: 12px; background: #fdecea; color: #b3261e; font-size: 13.5px; font-weight: 500; border: 1px solid #f5c2bd; }
.glass .ferr { color: #ffb4ab; font-size: 12.5px; font-weight: 500; }
.glass .alt { align-self: center; margin-top: 2px; padding: 6px 10px; background: none; border: 0; color: #eef6f4; font-size: 13.5px; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.glass .alt:hover { color: #fff; }
.glass .note-light { margin: 0; text-align: center; color: #cfe3df; font-size: 12.5px; }

/* ════════ Layout ════════ */
.login { --g1: #fbeee4; --g2: #cba590; --g3: #8f6a55; }
.lx {
  position: relative; color: #fff; overflow: hidden;
  background: radial-gradient(1100px 760px at 18% 8%, #0e858b 0%, #075459 38%, #032b2e 72%, #021c1e 100%);
}
@media (min-width: 801px) {
  .login { height: 100vh; min-height: 0; }
  .lx { overflow-y: auto; overflow-x: hidden; scroll-behavior: smooth; scrollbar-width: thin; scrollbar-color: rgba(203, 165, 144, .45) transparent; }
}

/* Sticky background stage */
.stage { position: sticky; top: 0; height: 100vh; margin-bottom: -100vh; overflow: hidden; pointer-events: none; z-index: 2; }
.aurora { position: absolute; border-radius: 50%; filter: blur(80px); mix-blend-mode: screen; opacity: .38; }
.a1 { width: 620px; height: 520px; left: -160px; top: -180px; background: radial-gradient(circle, #19b3b8, transparent 65%); animation: float1 18s ease-in-out infinite; }
.a2 { width: 520px; height: 520px; right: -200px; top: 30%; background: radial-gradient(circle, rgba(203, 165, 144, .75), transparent 65%); animation: float2 22s ease-in-out infinite; }
.a3 { width: 560px; height: 420px; left: 20%; bottom: -220px; background: radial-gradient(circle, #0b7d84, transparent 65%); animation: float1 26s ease-in-out -8s infinite reverse; }
@keyframes float1 { 50% { translate: 120px 80px; scale: 1.15; } }
@keyframes float2 { 50% { translate: -140px -60px; scale: .9; } }
.grain { position: absolute; inset: 0; background: url(/img/pattern.png) center / 640px; opacity: .08; mix-blend-mode: soft-light; }
.dust { position: absolute; inset: 0; width: 100%; height: 100%; }
.spot { position: absolute; inset: 0; background: radial-gradient(420px circle at var(--mx, 70%) var(--my, 30%), rgba(243, 214, 190, .13), transparent 60%); transition: background .1s; }

.progress { display: block; position: sticky; top: 0; z-index: 5; height: 3px; margin-bottom: -3px; background: linear-gradient(90deg, var(--g2), var(--g1), var(--g2)); box-shadow: 0 0 12px rgba(243, 214, 190, .8); transform-origin: left; }

/* ════════ Screen 1 ════════ */
.first { position: relative; z-index: 1; min-height: 100vh; display: flex; flex-direction: column; justify-content: flex-end; padding: 64px 56px 120px; isolation: isolate; }
.copy { position: relative; z-index: 3; max-width: 600px; }
.photo { position: absolute; inset: 0 0 auto 0; height: 64%; z-index: -1; overflow: hidden; }
.photo img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; transform-origin: 55% 45%; animation: kenburns 26s ease-in-out infinite alternate, photoIn 2s ease both; }
.photo::after { content: ''; position: absolute; inset: 0;
  background:
    linear-gradient(0deg, #032b2e 0%, rgba(3, 43, 46, .75) 22%, rgba(3, 47, 50, .25) 50%, rgba(3, 47, 50, .1) 78%, rgba(2, 28, 30, .5) 100%),
    linear-gradient(90deg, rgba(2, 28, 30, .55) 0%, rgba(2, 28, 30, 0) 60%); }
@keyframes kenburns { from { transform: scale(1.04); } to { transform: scale(1.16) translate(-1.5%, 1%); } }
@keyframes photoIn { from { opacity: 0; filter: blur(8px); } }
.badge { position: absolute; z-index: 3; right: 40px; top: 40px; display: inline-flex; align-items: center; gap: 10px; padding: 9px 16px; border-radius: 999px; background: rgba(3, 43, 46, .55); border: 1px solid rgba(243, 214, 190, .35); backdrop-filter: blur(10px); font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--gold-soft); }
.badge i { width: 7px; height: 7px; border-radius: 50%; background: var(--g2); box-shadow: 0 0 0 0 rgba(203, 165, 144, .7); animation: live 2s ease-out infinite; }
@keyframes live { 70% { box-shadow: 0 0 0 9px rgba(203, 165, 144, 0); } 100% { box-shadow: 0 0 0 0 rgba(203, 165, 144, 0); } }
.lead b { color: #fff; font-weight: 500; }

.bloom { display: block; width: 260px; margin: 0 0 26px -10px; overflow: visible; filter: drop-shadow(0 0 22px rgba(203, 165, 144, .35)); }
.bloom .petals { animation: spin 120s linear infinite; }
.petal { fill: rgba(203, 165, 144, 0); stroke: url(#lxGold); stroke-width: 2.2; stroke-dasharray: 1; stroke-dashoffset: 1; }
.closing[data-in] .petal {
  animation: draw 2.4s cubic-bezier(.6, .1, .3, 1) calc(var(--i) * .09s + .2s) forwards, petalFill 3s ease calc(var(--i) * .09s + 2s) forwards; }
.petal.small { stroke-width: 1.6; opacity: .8; }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes petalFill { to { fill: rgba(203, 165, 144, .07); } }
.bloom .core { animation: breathe 5s ease-in-out infinite; transform-origin: 0 0; }
.seed { fill: none; stroke: url(#lxGold); stroke-width: 1.5; }
.ring { fill: none; }
.ring.thin { stroke: rgba(243, 214, 190, .22); stroke-width: 1; }
.ring.dash { stroke: rgba(203, 165, 144, .45); stroke-width: 1; stroke-dasharray: 2 10; }
.ring.glow { stroke: url(#lxGold); stroke-width: 2; stroke-dasharray: .12 .88; stroke-linecap: round; }
.rings { animation: spin 40s linear infinite reverse; }
.orbit { animation: spin 16s linear infinite; }
.sat { fill: #fff3ea; filter: drop-shadow(0 0 6px #f3d6be); }
.sat.dim { opacity: .6; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes breathe { 50% { transform: scale(1.25); opacity: .7; } }

.eyebrow { display: inline-flex; align-items: center; gap: 12px; font: 500 11px Roboto, sans-serif; letter-spacing: 4.5px; color: var(--g2); }
.eyebrow i { width: 34px; height: 1px; background: linear-gradient(90deg, transparent, var(--g2)); }

.title { margin: 22px 0 22px; font: 500 clamp(44px, 5.4vw, 76px)/1.02 'EB Garamond', serif; letter-spacing: -.5px; }
.title .hl { display: block; white-space: nowrap; }
.word { margin-right: .24em; }
.word:last-child { margin-right: 0; }
.word { display: inline-block; opacity: 0; filter: blur(12px); translate: 0 .5em; animation: wordIn 1.1s cubic-bezier(.2, .7, .2, 1) calc(var(--i) * .11s + .25s) forwards; }
.word.gold { font-style: italic; background: linear-gradient(100deg, var(--g3) 0%, var(--g2) 25%, #fff6ef 45%, var(--g2) 60%, var(--g3) 100%); background-size: 240% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: wordIn 1.1s cubic-bezier(.2, .7, .2, 1) calc(var(--i) * .11s + .25s) forwards, sheen 5s ease-in-out 2s infinite; padding-right: .06em; }
@keyframes wordIn { to { opacity: 1; filter: blur(0); translate: 0 0; } }
@keyframes sheen { 0% { background-position: 100% 0; } 55%, 100% { background-position: -40% 0; } }

.lead { max-width: 470px; font-size: 15.5px; line-height: 1.7; color: var(--mint); }

.stats { display: flex; gap: 14px; margin-top: 38px; flex-wrap: wrap; }
.stat { min-width: 132px; padding: 16px 20px; border-radius: 18px; background: linear-gradient(160deg, rgba(255, 255, 255, .1), rgba(255, 255, 255, .02)); border: 1px solid rgba(243, 214, 190, .2); backdrop-filter: blur(10px); }
.stat b { display: block; font: 500 38px/1 'EB Garamond', serif; background: linear-gradient(180deg, #fff, var(--g2)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.stat span { display: block; margin-top: 6px; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--mint); opacity: .85; }

.fade { opacity: 0; animation: fadeUp 1s cubic-bezier(.2, .7, .2, 1) var(--d, 0s) forwards; }
@keyframes fadeUp { from { opacity: 0; translate: 0 26px; } to { opacity: 1; translate: 0 0; } }

.cue { position: absolute; z-index: 2; left: 50%; bottom: 26px; translate: -50% 0; display: flex; flex-direction: column; align-items: center; gap: 9px; font-size: 10.5px; letter-spacing: 3px; text-transform: uppercase; color: var(--gold-soft); background: none; border: 0; cursor: pointer; opacity: 0; animation: fadeIn 1s ease 2.2s forwards; transition: opacity .4s; }
.cue.gone { opacity: 0 !important; animation: none; pointer-events: none; }
.mouse { width: 24px; height: 38px; border: 1.5px solid rgba(243, 232, 225, .7); border-radius: 14px; display: grid; justify-items: center; padding-top: 7px; }
.mouse i { width: 3px; height: 8px; border-radius: 2px; background: var(--g2); animation: wheel 1.8s ease-in-out infinite; }
@keyframes wheel { 0% { opacity: 0; translate: 0 -2px; } 30% { opacity: 1; } 100% { opacity: 0; translate: 0 12px; } }
@keyframes fadeIn { to { opacity: 1; } }

/* ════════ Story ════════ */
.more { position: relative; z-index: 1; padding-bottom: 80px; }
.sec { padding: 96px 56px 0; max-width: 720px; }
.h { margin: 16px 0 34px; font: 500 clamp(32px, 3.4vw, 46px)/1.08 'EB Garamond', serif; }
.h em, .closing em { font-style: italic; color: var(--g2); }

/* Marquee */
.marquee { padding: 30px 0; display: grid; gap: 6px; border-block: 1px solid rgba(243, 214, 190, .14); background: rgba(0, 0, 0, .12); -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); }
.row { display: flex; width: max-content; }
.row span { display: flex; align-items: center; gap: 28px; padding-right: 28px; white-space: nowrap; font: italic 500 46px/1.15 'EB Garamond', serif; }
.row i { font-style: normal; font-size: 16px; color: var(--g2); }
.r1 { animation: slideL 38s linear infinite; }
.r1 span { color: #fff; }
.r2 { animation: slideR 44s linear infinite; }
.r2 span { color: transparent; -webkit-text-stroke: 1px rgba(243, 214, 190, .55); font-style: normal; }
.marquee:hover .row { animation-play-state: paused; }
@keyframes slideL { to { transform: translateX(-50%); } }
@keyframes slideR { from { transform: translateX(-50%); } to { transform: translateX(0); } }

/* Haven: arched photo + Wellness / Beauty / Confidence */
.haven { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: center; }
.frame { position: relative; aspect-ratio: 3 / 4; border-radius: 999px 999px 26px 26px; overflow: hidden; border: 1px solid rgba(243, 214, 190, .4); box-shadow: 0 40px 70px -35px rgba(0, 0, 0, .8); }
.frame img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 35%; scale: 1.25; clip-path: inset(100% 0 0 0); transition: scale 2.2s cubic-bezier(.2, .7, .2, 1), clip-path 1.4s cubic-bezier(.7, 0, .2, 1) .15s; }
.frame[data-in] img { scale: 1; clip-path: inset(0 0 0 0); }
.frame::after { content: ''; position: absolute; inset: 10px; border-radius: 999px 999px 18px 18px; border: 1px solid rgba(251, 238, 228, .45); pointer-events: none; }
.trio { list-style: none; margin: 0; padding: 0; display: grid; gap: 22px; }
.trio li { padding-left: 20px; border-left: 2px solid rgba(203, 165, 144, .5); }
.trio strong { display: block; font: italic 500 30px/1 'EB Garamond', serif; background: linear-gradient(180deg, #fff, var(--g2)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.trio span { display: block; margin-top: 8px; font-size: 13.5px; line-height: 1.55; color: var(--mint); }

/* Tilt cards */
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; perspective: 900px; }
.card { --rx: 0deg; --ry: 0deg; position: relative; overflow: hidden; padding: 22px 20px 24px; border-radius: 22px; min-height: 150px;
  background: linear-gradient(160deg, rgba(255, 255, 255, .12), rgba(255, 255, 255, .02)); border: 1px solid rgba(243, 214, 190, .2); backdrop-filter: blur(12px);
  transform: rotateX(var(--rx)) rotateY(var(--ry)); transform-style: preserve-3d; transition: transform .25s ease-out, border-color .3s, box-shadow .3s, opacity .9s, translate .9s cubic-bezier(.2, .7, .2, 1); }
.card:hover { border-color: rgba(243, 214, 190, .55); box-shadow: 0 30px 60px -30px rgba(0, 0, 0, .7), 0 0 0 1px rgba(203, 165, 144, .15) inset; }
.glare { position: absolute; inset: 0; background: radial-gradient(300px circle at var(--gx, 50%) var(--gy, 0%), rgba(255, 246, 239, .18), transparent 55%); opacity: 0; transition: opacity .3s; pointer-events: none; }
.card:hover .glare { opacity: 1; }
.card .ic { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, rgba(251, 238, 228, .35), rgba(203, 165, 144, .15)); border: 1px solid rgba(243, 214, 190, .35); color: var(--g1); font-size: 20px; transform: translateZ(30px); }
.card b { display: block; margin-top: 18px; font: 600 21px/1.15 'EB Garamond', serif; transform: translateZ(24px); }
.card p { margin-top: 10px; font-size: 13px; line-height: 1.6; color: var(--mint); transform: translateZ(14px); }
.card .num { position: absolute; right: 16px; bottom: 6px; font: italic 500 64px/1 'EB Garamond', serif; color: rgba(243, 214, 190, .1); }

/* Journey timeline */
.steps { position: relative; list-style: none; margin: 0; padding: 0 0 0 66px; display: grid; gap: 22px; }
.line { position: absolute; left: 21px; top: 22px; bottom: 22px; width: 2px; background: rgba(243, 214, 190, .15); border-radius: 2px; }
.fill { position: absolute; inset: 0; background: linear-gradient(var(--g1), var(--g2)); box-shadow: 0 0 14px rgba(243, 214, 190, .7); transform-origin: top; transform: scaleY(var(--jp, 0)); transition: transform .15s linear; }
.step { position: relative; padding: 20px 24px; border-radius: 20px; background: rgba(255, 255, 255, .04); border: 1px solid rgba(255, 255, 255, .1); transition: background .5s, border-color .5s, opacity .9s, translate .9s cubic-bezier(.2, .7, .2, 1); }
.step .dot { position: absolute; left: -66px; top: 18px; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; font: 600 18px 'EB Garamond', serif; color: var(--mint); background: #04373a; border: 1.5px solid rgba(243, 214, 190, .25); transition: all .5s; }
.step strong { font: 600 22px 'EB Garamond', serif; }
.step p { margin-top: 6px; font-size: 13.5px; line-height: 1.6; color: var(--mint); }
.step.lit { background: rgba(255, 255, 255, .09); border-color: rgba(243, 214, 190, .35); }
.step.lit .dot { color: #3b2a20; background: linear-gradient(160deg, var(--g1), var(--g2)); border-color: transparent; box-shadow: 0 0 0 6px rgba(203, 165, 144, .18), 0 0 24px rgba(243, 214, 190, .6); }

/* Route map */
.map { padding: 10px 6px; border-radius: 24px; background: radial-gradient(ellipse at 50% 60%, rgba(255, 255, 255, .06), transparent 70%); }
.map svg { width: 100%; height: auto; overflow: visible; }
.route-bg { fill: none; stroke: rgba(243, 214, 190, .15); stroke-width: 2; stroke-dasharray: 3 7; }
.route { fill: none; stroke: url(#lxRoute); stroke-width: 2.5; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; filter: drop-shadow(0 0 6px rgba(243, 214, 190, .7)); }
.map[data-in] .route { animation: draw 2.2s cubic-bezier(.6, .1, .3, 1) .3s forwards; }
.traveller { fill: #fff6ef; filter: drop-shadow(0 0 8px #f3d6be); opacity: 0; }
.map[data-in] .traveller { animation: fadeIn .5s ease 1.6s forwards; }
.pin { opacity: 0; }
.map[data-in] .pin { animation: fadeIn .6s ease var(--d) forwards; }
.pin .halo { fill: rgba(203, 165, 144, .2); transform-box: fill-box; transform-origin: center; animation: ping 2.4s ease-out infinite; }
.pin .core { fill: var(--g1); stroke: var(--g2); stroke-width: 2; }
.pin text { fill: #fff; font: 600 17px 'EB Garamond', serif; letter-spacing: .3px; }
@keyframes ping { 0% { transform: scale(.4); opacity: 1; } 100% { transform: scale(1.8); opacity: 0; } }
.cities { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 18px; }
.city { padding: 16px 18px; border-radius: 16px; background: rgba(255, 255, 255, .05); border: 1px solid rgba(255, 255, 255, .1); }
.city strong { display: block; font: 600 19px 'EB Garamond', serif; }
.city small { display: block; margin-top: 3px; font-size: 12px; line-height: 1.45; color: var(--mint); }

/* Closing */
.closing { text-align: left; padding-top: 100px; }
.closing .eyebrow { margin-bottom: 16px; }
.closing q { display: block; quotes: none; font: 500 clamp(34px, 3.6vw, 50px)/1.1 'EB Garamond', serif; }
.cta { margin-top: 30px; display: inline-flex; align-items: center; gap: 12px; padding: 14px 26px; border-radius: 999px; border: 1px solid rgba(243, 214, 190, .5); background: rgba(203, 165, 144, .12); color: #fff; font-size: 14px; letter-spacing: .5px; cursor: pointer; transition: background .3s, gap .3s, box-shadow .3s; }
.cta:hover { background: rgba(203, 165, 144, .28); gap: 18px; box-shadow: 0 0 30px rgba(203, 165, 144, .35); }
.cta span { color: var(--g1); }

/* Scroll reveal */
.reveal { opacity: 0; translate: 0 40px; transition: opacity .9s ease var(--d, 0s), translate .9s cubic-bezier(.2, .7, .2, 1) var(--d, 0s); }
.reveal[data-in] { opacity: 1; translate: 0 0; }
.card.reveal { transition-delay: var(--d, 0s), var(--d, 0s), 0s, 0s, var(--d, 0s), var(--d, 0s); }

/* ════════ Sign-in panel ════════ */
.login .box::before { background: radial-gradient(900px 700px at 50% 40%, rgba(10, 115, 121, .9), rgba(3, 43, 46, .97)); }
.login .inner { width: min(470px, 100%); }
.glass { position: relative; padding: 42px 38px 34px; border-radius: 30px; background: linear-gradient(160deg, rgba(255, 255, 255, .09), rgba(255, 255, 255, .02)); backdrop-filter: blur(20px); box-shadow: 0 40px 80px -40px rgba(0, 0, 0, .8); animation: cardIn 1.1s cubic-bezier(.2, .7, .2, 1) .3s both; }
.glass::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1.5px; pointer-events: none;
  background: conic-gradient(from var(--ang, 0deg), rgba(243, 214, 190, .12) 0%, rgba(243, 214, 190, .12) 55%, var(--g2) 70%, #fff6ef 76%, var(--g2) 82%, rgba(243, 214, 190, .12) 95%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  animation: turn 6s linear infinite; }
@property --ang { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes turn { to { --ang: 360deg; } }
.glass.flash { animation: cardPulse 1.5s cubic-bezier(.2, .7, .2, 1); }
@keyframes cardPulse {
  0% { box-shadow: 0 40px 80px -40px rgba(0, 0, 0, .8), 0 0 0 0 rgba(243, 214, 190, .9); scale: 1; }
  20% { box-shadow: 0 40px 80px -40px rgba(0, 0, 0, .8), 0 0 0 3px rgba(243, 214, 190, .95), 0 0 90px rgba(243, 214, 190, .6); scale: 1.03; }
  55% { box-shadow: 0 40px 80px -40px rgba(0, 0, 0, .8), 0 0 0 26px rgba(243, 214, 190, 0), 0 0 70px rgba(243, 214, 190, .4); scale: 1; }
  100% { box-shadow: 0 40px 80px -40px rgba(0, 0, 0, .8), 0 0 0 0 rgba(243, 214, 190, 0); }
}

@keyframes cardIn { from { opacity: 0; translate: 0 30px; scale: .97; } }
.logo { width: 220px; margin: 0 auto; animation: logoGlow 4s ease-in-out infinite; }
@keyframes logoGlow { 50% { filter: drop-shadow(0 0 18px rgba(243, 214, 190, .45)); } }
.go { position: relative; overflow: hidden; background: linear-gradient(135deg, var(--g1), var(--g2) 55%, #b8907a); box-shadow: 0 12px 30px -12px rgba(203, 165, 144, .8); transition: transform .2s, box-shadow .3s; }
.go:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 16px 36px -12px rgba(203, 165, 144, 1); }
.go::after { content: ''; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, .55) 50%, transparent 70%); translate: -120% 0; animation: btnSheen 4.5s ease-in-out 2s infinite; }
@keyframes btnSheen { 0%, 70% { translate: -120% 0; } 100% { translate: 120% 0; } }

/* ════════ Responsive ════════ */
@media (max-width: 1200px) { .cards { grid-template-columns: 1fr 1fr; } .haven { grid-template-columns: 1fr; } .frame { max-width: 340px; } }
@media (max-width: 1100px) { .sec, .first { padding-left: 34px; padding-right: 34px; } .cities { grid-template-columns: 1fr; } }
@media (max-width: 800px) {
  .stage { position: absolute; inset: 0; height: auto; margin: 0; }
  .first { min-height: 0; padding: 56px 24px 48px; }
  .badge { display: none; }
  .photo { height: 100%; }
  .photo::after { background: linear-gradient(0deg, #032b2e 10%, rgba(3, 43, 46, .85) 60%, rgba(3, 43, 46, .6) 100%); }
  .cue, .more, .progress { display: none; }
  .glass { padding: 34px 22px 28px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-delay: 0s !important; animation-iteration-count: 1 !important; transition: none !important; }
  .reveal { opacity: 1; translate: none; }
  .lx { scroll-behavior: auto; }
}
</style>
