// sweepReclaim.js — Mode 1: SWEEP RECLAIM
// ✅ FINAL VERSION:
// - TP order strictly enforced: LONG → tp1<tp2<tp3, SHORT → tp1>tp2>tp3
// - TP2 fallback → midpoint of TP1/TP3 if structure target invalid
// - SL inversion guard
// - buffer atr*0.5
// - HTF 4h primary only

import { findSwings, calcATR, isFiniteNumber } from './smartMoney.js'

const LTF_KEY = '15m'
const CONFIRM_KEY = '5m'
const TRIGGER_WINDOW = 6

export function runSweepReclaim({ timeframes, htfBias4h, htfBias1h }) {
  const ltf = timeframes[LTF_KEY]
  const confirm = timeframes[CONFIRM_KEY]

  if (!ltf || ltf.length < 30) return { noSignal: true }

  const { swingHighs, swingLows } = findSwings(ltf, 2)
  if (swingHighs.length < 2 || swingLows.length < 2) return { noSignal: true }

  const lastCandle = ltf[ltf.length - 1]
  const atr = calcATR(ltf, 14)
  if (!atr) return { noSignal: true }

  const recentSwingHigh = swingHighs[swingHighs.length - 1]
  const recentSwingLow = swingLows[swingLows.length - 1]

  const htfAgreesBullish = htfBias4h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish'

  let direction = null
  let sweepLevel = null

  const scanStart = ltf.length - 1
  const scanEnd = Math.max(1, ltf.length - TRIGGER_WINDOW)

  for (let i = scanStart; i >= scanEnd; i--) {
    const candle = ltf[i]
    const prev = ltf[i - 1]
    if (!prev) continue

    const bullishSweep =
      prev.low < recentSwingLow.price &&
      Math.min(candle.open, candle.close) > recentSwingLow.price

    const bearishSweep =
      prev.high > recentSwingHigh.price &&
      Math.max(candle.open, candle.close) < recentSwingHigh.price

    if (bullishSweep && htfAgreesBullish) {
      direction = 'LONG'
      sweepLevel = recentSwingLow.price
      break
    }
    if (bearishSweep && htfAgreesBearish) {
      direction = 'SHORT'
      sweepLevel = recentSwingHigh.price
      break
    }
  }

  if (!direction) return { noSignal: true }

  const stillValid =
    direction === 'LONG'
      ? lastCandle.close > sweepLevel
      : lastCandle.close < sweepLevel

  if (!stillValid) return { noSignal: true }

  const entry = lastCandle.close
  const buffer = atr * 0.5

  let sl, tp1, tp2, tp3

  if (direction === 'LONG') {
    sl = sweepLevel - buffer
    const risk = entry - sl
    if (risk <= 0) return { noSignal: true }

    tp1 = entry + risk * 1.5
    tp3 = entry + risk * 3

    // TP2 must be strictly between TP1 and TP3
    const structureTarget = swingHighs[swingHighs.length - 1].price
    tp2 = structureTarget > tp1 && structureTarget < tp3
      ? structureTarget
      : entry + risk * 2.25
  } else {
    sl = sweepLevel + buffer
    const risk = sl - entry
    if (risk <= 0) return { noSignal: true }

    tp1 = entry - risk * 1.5
    tp3 = entry - risk * 3

    // For SHORT: tp3 < tp2 < tp1 (all below entry)
    const structureTarget = swingLows[swingLows.length - 1].price
    tp2 = structureTarget < tp1 && structureTarget > tp3
      ? structureTarget
      : entry - risk * 2.25
  }

  if (![entry, sl, tp1, tp2, tp3].every(isFiniteNumber)) return { noSignal: true }

  if (direction === 'LONG' && sl >= entry) return { noSignal: true }
  if (direction === 'SHORT' && sl <= entry) return { noSignal: true }

  // Final TP order check (safety net)
  if (direction === 'LONG' && !(tp1 < tp2 && tp2 < tp3 && tp1 > entry)) {
    return { noSignal: true }
  }
  if (direction === 'SHORT' && !(tp1 > tp2 && tp2 > tp3 && tp1 < entry)) {
    return { noSignal: true }
  }

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
    pattern:
      direction === 'LONG'
        ? 'Bullish Liquidity Sweep + Reclaim'
        : 'Bearish Liquidity Sweep + Reclaim',
    quickStats: [
      { label: 'Sweep Level', value: sweepLevel.toFixed(5) },
      { label: 'ATR (15m)', value: atr.toFixed(5) },
      { label: 'Grade', value: Math.abs(entry - sweepLevel) > atr * 0.5 ? 'A' : 'B' },
    ],
    structure: [
      { label: 'Swept Level', value: sweepLevel.toFixed(5) },
      { label: 'Structure Target', value: tp2.toFixed(5) },
    ],
    detail:
      direction === 'LONG'
        ? 'দাম আগের একটি swing low ভেঙে liquidity sweep করেছে, তারপর candle body আবার সেই লেভেলের ওপরে ক্লোজ করে reclaim নিশ্চিত করেছে এবং এখনো সেই স্ট্রাকচার বজায় আছে। এটি institutional buying-এর একটি সাধারণ ফুটপ্রিন্ট।'
        : 'দাম আগের একটি swing high ভেঙে liquidity sweep করেছে, তারপর candle body আবার সেই লেভেলের নিচে ক্লোজ করে reclaim নিশ্চিত করেছে এবং এখনো সেই স্ট্রাকচার বজায় আছে। এটি institutional selling-এর একটি সাধারণ ফুটপ্রিন্ট।',
  }
      }
