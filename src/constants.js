// constants.js — SINGLE SOURCE OF TRUTH

export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')

export const CONTACT = {
  support: 'https://t.me/ratulhossain56',
  channel: 'https://t.me/ratulhossain4241',
  group: 'https://t.me/ratulhossain424',
  paymentNumber: '01725218874',
  monthlyAmount: 8000,
}

export const FREE_TRIAL_LIMIT = 5

export const C = {
  bg: '#0a0e17',
  card: '#131722',
  panel: '#1a1f2e',
  border: '#2a2e3e',
  text: '#e6edf3',
  muted: '#6e7681',
  dim: '#484f58',
  green: '#00d68f',
  red: '#ff3b5c',
  gold: '#ffd700',
  orange: '#ff8c00',
  cyan: '#00d4ff',
  blue: '#3b82f6',
  purple: '#a78bfa',
  pink: '#ec4899',
}

export const SIGNAL_MODES = [
  { id: 'sweep', name: 'SWEEP RECLAIM', color: C.cyan },
  { id: 'crt_tbs', name: 'CRT + TBS PRO', color: C.purple },
  { id: 'wyckoff_ict', name: 'WYCKOFF + ICT/SMC', color: C.gold },
  { id: 'qm_smc', name: 'QM + SMC', color: C.orange },
  { id: 'price_action_fib', name: 'PRICE ACTION + FIBONACCI', color: C.blue },
]

export const DEFAULT_MODE_ID = 'sweep'

export const FIXED_RISK_PERCENT = 0.01

// ✅ FIXED — realistic SL floors so signals are not always blocked
export const MIN_SL_PIPS = {
  Major: 5,
  Cross: 5,
  Exotic: 10,
}

export const MIN_RR_RATIO = 1.5

export const TWELVE_DATA_DAILY_CREDIT_LIMIT = 800
