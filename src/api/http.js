// HTTP client for the Lavish API (lavish_backend). Every request sends the bearer token.
// Errors are normalised to ApiError { status, code, message, errors, details } —
// branch on `code` (see lavish_backend/docs/API.md §1 and §8), show `message`.
import axios from 'axios'
import { reactive } from 'vue'

// Requests the user is waiting for (page data). Background polling passes { background: true }.
export const loading = reactive({ count: 0 })

export const TOKEN_KEY = 'lavish_token'

export class ApiError extends Error {
  constructor({ status, code, message, errors, details }) {
    super(message)
    Object.assign(this, { status, code, errors: errors ?? {}, details: details ?? {} })
  }
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1',
  headers: { Accept: 'application/json' },
  timeout: 20000,
})

http.interceptors.request.use((config) => {
  if (config.method === 'get' && !config.background) {
    loading.count++
    config._counted = true
  }
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Called on 401 (expired/revoked token). Set by the auth store.
let onUnauthenticated = () => {}
export const setUnauthenticatedHandler = (fn) => (onUnauthenticated = fn)
// Called on 403 password_change_required (e.g. a manager reset this person's password). Set by the auth store.
let onPasswordChange = () => {}
export const setPasswordChangeHandler = (fn) => (onPasswordChange = fn)
const done = (config) => {
  if (config?._counted) {
    config._counted = false
    loading.count = Math.max(0, loading.count - 1)
  }
}

http.interceptors.response.use(
  (res) => {
    done(res.config)
    return res
  },
  (err) => {
    done(err.config)
    const res = err.response
    if (!res) {
      return Promise.reject(new ApiError({ status: 0, code: 'network', message: 'Can’t reach the Lavish server. Check your connection.' }))
    }
    if (res.status === 401 && !err.config.url.includes('/auth/login')) onUnauthenticated()
    const body = res.data ?? {}
    if (res.status === 403 && body.code === 'password_change_required') onPasswordChange()
    return Promise.reject(new ApiError({
      status: res.status,
      code: body.code ?? (res.status === 422 ? 'validation_failed' : 'error'),
      message: body.message ?? 'Something went wrong.',
      errors: body.errors,
      details: body.details,
    }))
  },
)

// Thin helpers that return the JSON body.
export const api = {
  get: (url, params, opts = {}) => http.get(url, { params, ...opts }).then((r) => r.data),
  post: (url, data) => http.post(url, data).then((r) => r.data),
  put: (url, data) => http.put(url, data).then((r) => r.data),
  patch: (url, data) => http.patch(url, data).then((r) => r.data),
  delete: (url) => http.delete(url).then((r) => r.data),
}

export default http
