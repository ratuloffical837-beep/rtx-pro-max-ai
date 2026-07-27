// riskManager.js — 🔴 called exactly once, inside signalEngine.js's
// generateSignal(), immediately after the raw signal, before the return.
//
// ⚠️ Overfitting warning: the MAX_VOLATILITY_MULTIPLIER threshold below is a
// reasonable default, not perfectly tuned to historical data for every one
// of the 50 pairs. ⚠️ Latency note: free-tier REST polling (no WebSocket)
// introduces latency that matters more on lower timeframes (5m/15m) than on
// 1h/4h — signals generated from stale candles are more likely on fast
// markets during news events.
//
// ── FIXES IN THIS VERSION ───────────────────────────────────────────────
// 1. 🔴 THE "SIGNAL DISCARDED FOR NO REASON" BUG: `rr >= MIN_RR_RATIO` was a
//    strict floating-point comparison. Since rr is computed upstream as
//    `tp1Pips / slPips` (itself derived from `priceDeltaToPips`, which does
//    floating-point division), a mode engine that builds tp1 at EXACTLY
//    entry ± risk*1.5 can still produce something like 1.4999999999998 due
//    to IEEE-754 rounding — which is mathematically 1.5 but fails a strict
//    `>=` check. This version adds a tiny epsilon tolerance so a signal that
//    IS at the 1.5R floor is never wrongly discarded by rounding noise.
// 2. 🔴 MIN_RR_RATIO and the SL-distance floors were hardcoded here AND
//    separately in constants.js — two sources of truth that could silently
//    drift apart if either was ever edited alone. Both are now imported
//    from constants.js so there is exactly one place to change either value.

import { calcATR } from './smartMoney.js'
import { MIN_RR_RATIO, MIN_SL_PIPS } from './constants.js'

const MAX_VOLATILITY_MULTIPLIER = 3.0

// 🔴 Floating-point tolerance — small enough to never meaningfully loosen
// the real risk floors, large enough to absorb IEEE-754 rounding noise from
// upstream pip-division math.
const EPSILON = 1e-6

// Compares the most recent candle's range against a rolling ATR baseline on
// the same timeframe. If the latest range blows past the baseline by more
// than MAX_VOLATILITY_MULTIPLIER, the signal is blocked rather than shown as
// if it were safe.
export function checkVolatilityGuard(candles) {
  if (!candles || candles.length < 20) {
    return { blocked: false, reason: null } // not enough data to judge — don't block on missing data
  }

  const atr = calcATR(candles, 14)
  const lastCandle = candles[candles.length - 1]
  const lastRange = lastCandle.high - lastCandle.low

  if (!atr || atr <= 0) return { blocked: false, reason: null }

  if (lastRange > atr * MAX_VOLATILITY_MULTIPLIER) {
    return { blocked: true, reason: '⚠️ High spread — signal is not safe right now' }
  }
  return { blocked: false, reason: null }
}

// 🔴 Minimum SL distance floor (#13.4) — if a mode's calculated SL is
// tighter than this, the signal must be discarded rather than shrinking the
// SL artificially. Floors now come from constants.js (single source).
export function meetsMinSlDistance(slPips, category) {
  const floor = MIN_SL_PIPS[category] ?? MIN_SL_PIPS.Major
  return slPips >= floor - EPSILON
}

// 🔴 R:R below MIN_RR_RATIO → discard entirely (#13.5). Epsilon-tolerant so
// a signal sitting exactly at the floor (e.g. tp1 built at precisely
// risk*1.5) is never discarded by floating-point rounding noise.
export function meetsMinRR(rr, minRR = MIN_RR_RATIO) {
  return typeof rr === 'number' && Number.isFinite(rr) && rr >= minRR - EPSILON
}

// The single gatekeeper call every mode's raw signal must pass through.
// Returns { blocked, reason } — signalEngine.js attaches this onto the
// final signal object; ForexSection/SignalCard render the warning but never
// silently hide that a signal was flagged.
export function riskGate({ candles, slPips, category, rr }) {
  const volatility = checkVolatilityGuard(candles)
  if (volatility.blocked) return volatility

  if (!meetsMinSlDistance(slPips, category)) {
    const floor = MIN_SL_PIPS[category] ?? MIN_SL_PIPS.Major
    return {
      blocked: true,
      reason: `⚠️ SL distance too tight for ${category} pair (min ${floor} pips) — discarded`,
    }
  }

  if (!meetsMinRR(rr)) {
    return { blocked: true, reason: `⚠️ R:R below 1:${MIN_RR_RATIO} — signal discarded` }
  }

  return { blocked: false, reason: null }
    }
