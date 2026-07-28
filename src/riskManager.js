// riskManager.js
// ✅ FIXES:
// 1. MIN_SL_PIPS and MIN_RR_RATIO imported from constants.js (single source)
// 2. EPSILON tolerance retained
// 3. Volatility guard uses last 3 candles average (not just 1 candle)
//    to reduce false-positive blocks from single spike candles

import { calcATR } from './smartMoney.js'
import { MIN_RR_RATIO, MIN_SL_PIPS } from './constants.js'

const MAX_VOLATILITY_MULTIPLIER = 3.0
const EPSILON = 1e-6

// ✅ FIX: average last 3 candles' range instead of just the last 1
//         so a single news spike candle doesn't falsely block the signal
export function checkVolatilityGuard(candles) {
  if (!candles || candles.length < 20) {
    return { blocked: false, reason: null }
  }

  const atr = calcATR(candles, 14)
  if (!atr || atr <= 0) return { blocked: false, reason: null }

  const last3 = candles.slice(-3)
  const avgRecentRange =
    last3.reduce((sum, c) => sum + (c.high - c.low), 0) / last3.length

  if (avgRecentRange > atr * MAX_VOLATILITY_MULTIPLIER) {
    return { blocked: true, reason: '⚠️ High spread — signal is not safe right now' }
  }
  return { blocked: false, reason: null }
}

export function meetsMinSlDistance(slPips, category) {
  const floor = MIN_SL_PIPS[category] ?? MIN_SL_PIPS.Major
  return slPips >= floor - EPSILON
}

export function meetsMinRR(rr, minRR = MIN_RR_RATIO) {
  return typeof rr === 'number' && Number.isFinite(rr) && rr >= minRR - EPSILON
}

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
    return {
      blocked: true,
      reason: `⚠️ R:R below 1:${MIN_RR_RATIO} — signal discarded`,
    }
  }

  return { blocked: false, reason: null }
    }
