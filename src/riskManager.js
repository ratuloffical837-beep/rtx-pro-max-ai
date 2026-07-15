// riskManager.js — 🔴 called exactly once, inside signalEngine.js's
// generateSignal(), immediately after the raw signal, before the return.
//
// ⚠️ Overfitting warning: the MAX_VOLATILITY_MULTIPLIER threshold below is a
// reasonable default, not perfectly tuned to historical data for every one
// of the 50 pairs. ⚠️ Latency note: free-tier REST polling (no WebSocket)
// introduces latency that matters more on lower timeframes (5m/15m) than on
// 1h/4h — signals generated from stale candles are more likely on fast
// markets during news events.

import { calcATR } from './smartMoney.js'

const MAX_VOLATILITY_MULTIPLIER = 3.0

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
// SL artificially.
export function meetsMinSlDistance(slPips, category) {
  const floor = category === 'Exotic' ? 15 : 8
  return slPips >= floor
}

// 🔴 R:R below 1:1.5 → discard entirely (#13.5)
export function meetsMinRR(rr, minRR = 1.5) {
  return typeof rr === 'number' && Number.isFinite(rr) && rr >= minRR
}

// The single gatekeeper call every mode's raw signal must pass through.
// Returns { blocked, reason } — signalEngine.js attaches this onto the
// final signal object; ForexSection/SignalCard render the warning but never
// silently hide that a signal was flagged.
export function riskGate({ candles, slPips, category, rr }) {
  const volatility = checkVolatilityGuard(candles)
  if (volatility.blocked) return volatility

  if (!meetsMinSlDistance(slPips, category)) {
    return {
      blocked: true,
      reason: `⚠️ SL distance too tight for ${category} pair (min ${category === 'Exotic' ? 15 : 8} pips) — discarded`,
    }
  }

  if (!meetsMinRR(rr)) {
    return { blocked: true, reason: '⚠️ R:R below 1:1.5 — signal discarded' }
  }

  return { blocked: false, reason: null }
}
