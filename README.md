# Lavish — Staff web portal (Vue 3 + Tailwind CSS)

Talks to the Laravel API in `../lavish_backend` (see its README and `docs/API.md`).

## Run locally

```bash
# 1. API (in ../lavish_backend)
php artisan serve                 # http://127.0.0.1:8000

# 2. Portal
npm install
npm run dev                       # http://localhost:5173
```

The API address comes from `VITE_API_URL` (`.env.development` / `.env.production`). For production use a custom domain — `*.workers.dev` / `*.pages.dev` are blocked by some Ethiopian ISPs.

Demo logins (password `password`): CEO `0911001122`, General Manager `0911009900`, Reception `0911003344`, E-commerce `0911112233`, Doctor + teacher `0911500001`, Nurse (Lavish Team only) `0911445566`.

## Structure

```
src/api/http.js            axios client: bearer token, errors normalised to { status, code, message, errors }
src/stores/auth.js         signed-in user, permissions, pages (from GET /auth/me)
src/stores/notifications.js the bell (GET /notifications, every 30 s)
src/tailwind.css           Tailwind v4 + Lavish design tokens (bg-teal, text-gold, rounded-card…)
src/store.js               OLD mock data — removed page by page
```

## Moving to the API — status

| Page | Data |
|---|---|
| Login (+ forced new password) | ✅ API |
| Sidebar, permissions (`can`), route guard | ✅ API |
| Notification bell | ✅ API |
| Dashboard | ✅ API |
| Appointments, Walk-in, Clients, Payments, Products, Orders, Prescriptions, Complaints, Academy, Schedule, Modules, Students, Staff, News, Team, Chat, Permissions, Command palette | ⏳ still demo data from `store.js` (they already obey the real permissions) |

To move a page: replace its `state.*` reads with `api.get('/staff/…')` and each `actions.*` call with the matching POST from `docs/API.md §7`; show `e.message` from errors. Write new markup with Tailwind classes.

Tailwind's CSS reset is not loaded yet so the old pages keep their look; when the last page uses Tailwind, switch `src/tailwind.css` to `@import "tailwindcss";` and delete `styles.css` / `extras.css`.
