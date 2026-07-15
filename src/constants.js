// constants.js — 🔴 SINGLE SOURCE for contact info and price.
// Every other file (footer, payment page, upgrade banners) must import from
// here, never hardcode these values again. If a number/link ever changes,
// this is the only file that needs editing.

export const CONTACT = {
  support: 'https://t.me/ratulhossain56',
  channel: 'https://t.me/ratulhossain4241',
  group: 'https://t.me/ratulhossain424',
  paymentNumber: '01725218874',
  monthlyAmount: 8000, // ৳ BDT, per month
}

// 🔴 5 free signals, lifetime — not daily. Used by the trial banner and by
// the backend's /api/check-status gate.
export const FREE_TRIAL_LIMIT = 5

// Color palette — unchanged from the original crypto app, reused exactly.
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

// 🔴 The 5 signal modes — order matters, this drives the mode-card order in
// SettingsModal and the badge color lookup everywhere else.
export const SIGNAL_MODES = [
  { id: 'sweep', name: 'SWEEP RECLAIM', color: C.cyan },
  { id: 'crt_tbs', name: 'CRT + TBS PRO', color: C.purple },
  { id: 'wyckoff_ict', name: 'WYCKOFF + ICT/SMC', color: C.gold },
  { id: 'qm_smc', name: 'QM + SMC', color: C.orange },
  { id: 'price_action_fib', name: 'PRICE ACTION + FIBONACCI', color: C.blue },
]

export const DEFAULT_MODE_ID = 'sweep'

// Fixed risk — 🔴 permanently 1%, never user-editable (see riskManager.js /
// MoneyManagementModal.jsx). Do not move this into localStorage.
export const FIXED_RISK_PERCENT = 0.01

// Minimum SL distance floor, in pips (#13.4)
export const MIN_SL_PIPS = {
  Major: 8,
  Cross: 8,
  Exotic: 15,
}

export const MIN_RR_RATIO = 1.5 // signals with R:R below 1:1.5 are discarded

export const TWELVE_DATA_DAILY_CREDIT_LIMIT = 800
