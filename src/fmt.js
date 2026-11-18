// Small display helpers shared by the API-driven pages (Rewards, Gift cards).
export const etb = (n) => `ETB ${Number(n ?? 0).toLocaleString()}`
export const pts = (n) => `${Number(n ?? 0).toLocaleString()} pts`
export const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
export const TIER_COLORS = { glow: '#cba590', radiance: '#0a7379', elite: '#262626' }
