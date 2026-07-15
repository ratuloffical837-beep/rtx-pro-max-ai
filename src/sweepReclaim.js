// sweepReclaim.js — Mode 1: SWEEP RECLAIM.
// Liquidity sweep of a recent swing level followed by a reclaim close back
// inside the range. Pure price-action/structure — no indicators.
//
// 🔴 Sweep detection uses Math.max(open, close) / Math.min(open, close)
// against the swing level, never `close` alone.

import { findSwings, calcATR, isFiniteNumber } from './smartMoney.js'

const LTF_KEY = '15m'
const CONFIRM_KEY = '5m'

export function runSweepReclaim({ timeframes, htfBias4h, htfBias1h }) {
  const ltf = timeframes[LTF_KEY]
  const confirm = timeframes[CONFIRM_KEY]

  if (!ltf || ltf.length < 30) return { noSignal: true }

  const { swingHighs, swingLows } = findSwings(ltf, 2)
  if (swingHighs.length < 2 || swingLows.length < 2) return { noSignal: true }

  const lastCandle = ltf[ltf.length - 1]
  const prevCandle = ltf[ltf.length - 2]
  const atr = calcATR(ltf, 14)
  if (!atr) return { noSignal: true }

  const recentSwingHigh = swingHighs[swingHighs.length - 1]
  const recentSwingLow = swingLows[swingLows.length - 1]

  // Bullish sweep: wick takes out the recent swing low, body reclaims above it.
  const bullishSweep =
    prevCandle.low < recentSwingLow.price &&
    Math.min(lastCandle.open, lastCandle.close) > recentSwingLow.price

  // Bearish sweep: wick takes out the recent swing high, body reclaims below it.
  const bearishSweep =
    prevCandle.high > recentSwingHigh.price &&
    Math.max(lastCandle.open, lastCandle.close) < recentSwingHigh.price

  // HTF bias must agree — common rule #2, never ignored.
  const htfAgreesBullish = htfBias4h !== 'Bearish' && htfBias1h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish' && htfBias1h !== 'Bullish'

  let direction = null
  let sweepLevel = null

  if (bullishSweep && htfAgreesBullish) {
    direction = 'LONG'
    sweepLevel = recentSwingLow.price
  } else if (bearishSweep && htfAgreesBearish) {
    direction = 'SHORT'
    sweepLevel = recentSwingHigh.price
  } else {
    return { noSignal: true }
  }

  const entry = lastCandle.close
  const buffer = atr * 0.3

  let sl, tp1, tp2, tp3

  if (direction === 'LONG') {
    sl = sweepLevel - buffer
    const structureTarget = swingHighs[swingHighs.length - 1].price
    const risk = entry - sl
    tp1 = entry + risk * 1.5
    tp2 = structureTarget
    tp3 = entry + risk * 3
  } else {
    sl = sweepLevel + buffer
    const structureTarget = swingLows[swingLows.length - 1].price
    const risk = sl - entry
    tp1 = entry - risk * 1.5
    tp2 = structureTarget
    tp3 = entry - risk * 3
  }

  if (![entry, sl, tp1, tp2, tp3].every(isFiniteNumber)) return { noSignal: true }

  // 5m confirmation bias — informational only, doesn't gate the signal.
  let bias5m = 'Neutral'
  if (confirm && confirm.length >= 2) {
    const c = confirm[confirm.length - 1]
    bias5m = c.close > c.open ? 'Bullish' : c.close < c.open ? 'Bearish' : 'Neutral'
  }

  return {
    direction,
    strength: Math.abs(entry - sweepLevel) > atr * 0.5 ? 'Strong' : 'Moderate',
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    bias15m: direction === 'LONG' ? 'Bullish' : 'Bearish',
    bias5m,
    pattern: direction === 'LONG' ? 'Bullish Liquidity Sweep + Reclaim' : 'Bearish Liquidity Sweep + Reclaim',
    quickStats: [
      { label: 'Sweep Level', value: sweepLevel.toFixed(5) },
      { label: 'ATR (15m)', value: atr.toFixed(5) },
      { label: 'Grade', value: Math.abs(entry - sweepLevel) > atr * 0.5 ? 'A' : 'B' },
    ],
    structure: [
      { label: 'Swept Level', value: sweepLevel.toFixed(5) },
      { label: 'Structure Target', value: (direction === 'LONG' ? tp2 : tp2).toFixed(5) },
    ],
    detail:
      direction === 'LONG'
        ? 'দাম আগের একটি swing low ভেঙে liquidity sweep করেছে, তারপর candle body আবার সেই লেভেলের ওপরে ক্লোজ করে reclaim নিশ্চিত করেছে। এটি institutional buying-এর একটি সাধারণ ফুটপ্রিন্ট।'
        : 'দাম আগের একটি swing high ভেঙে liquidity sweep করেছে, তারপর candle body আবার সেই লেভেলের নিচে ক্লোজ করে reclaim নিশ্চিত করেছে। এটি institutional selling-এর একটি সাধারণ ফুটপ্রিন্ট।',
  }
    }
