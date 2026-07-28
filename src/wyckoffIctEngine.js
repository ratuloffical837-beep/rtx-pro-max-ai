// wyckoffIctEngine.js — Mode 3: WYCKOFF + ICT/SMC
// ✅ FIXES:
// 1. 'window' variable renamed to 'rangeWindow' (global shadow fix)
// 2. choch null crash fixed with optional chaining in quickStats/structure
// 3. buffer: atr*0.3 → atr*0.5
// 4. HTF logic: 4h primary only
// 5. choch null handled before direction assignment

import {
  findSwings,
  calcATR,
  detectOrderBlock,
  detectBOSCHoCH,
  isFiniteNumber,
} from './smartMoney.js'

const LTF_KEY = '15m'
const CONFIRM_KEY = '5m'
const RANGE_LOOKBACK = 20
const TRIGGER_WINDOW = 6

export function runWyckoffIct({ timeframes, htfBias4h, htfBias1h }) {
  const ltf = timeframes[LTF_KEY]
  const confirm = timeframes[CONFIRM_KEY]

  if (!ltf || ltf.length < 30) return { noSignal: true }

  const atr = calcATR(ltf, 14)
  if (!atr) return { noSignal: true }

  // ✅ FIX: renamed from 'window' to 'rangeWindow' to avoid global shadow
  const rangeWindow = ltf.slice(-RANGE_LOOKBACK, -3)
  if (rangeWindow.length < 10) return { noSignal: true }

  const rangeHigh = Math.max(...rangeWindow.map((c) => c.high))
  const rangeLow = Math.min(...rangeWindow.map((c) => c.low))

  const last = ltf[ltf.length - 1]

  let triggerDirection = null

  const scanStart = ltf.length - 2
  const scanEnd = Math.max(1, ltf.length - TRIGGER_WINDOW)

  for (let i = scanStart; i >= scanEnd; i--) {
    const c = ltf[i]
    const isSpringCandle = c.low < rangeLow && Math.min(c.open, c.close) > rangeLow
    const isUpthrustCandle = c.high > rangeHigh && Math.max(c.open, c.close) < rangeHigh

    if (isSpringCandle) {
      triggerDirection = 'LONG'
      break
    }
    if (isUpthrustCandle) {
      triggerDirection = 'SHORT'
      break
    }
  }

  if (!triggerDirection) return { noSignal: true }

  const stillValid =
    triggerDirection === 'LONG'
      ? last.close > rangeLow
      : last.close < rangeHigh

  if (!stillValid) return { noSignal: true }

  // ✅ FIX: choch null handled — if null, no structural confirmation exists
  const choch = detectBOSCHoCH(ltf)

  // ✅ FIX: 4h is primary — 1h conflict no longer blocks signal
  const htfAgreesBullish = htfBias4h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish'

  let direction = null
  if (
    triggerDirection === 'LONG' &&
    htfAgreesBullish &&
    choch?.direction === 'bullish'
  ) {
    direction = 'LONG'
  } else if (
    triggerDirection === 'SHORT' &&
    htfAgreesBearish &&
    choch?.direction === 'bearish'
  ) {
    direction = 'SHORT'
  } else {
    return { noSignal: true }
  }

  const orderBlock = detectOrderBlock(ltf, direction)
  const entry = last.close
  // ✅ FIX: buffer increased from 0.3 to 0.5
  const buffer = atr * 0.5

  let sl, tp1, tp2, tp3
  if (direction === 'LONG') {
    sl = (orderBlock ? Math.min(orderBlock.low, rangeLow) : rangeLow) - buffer
    const risk = entry - sl
    tp1 = entry + risk * 1.5
    tp2 = rangeHigh
    tp3 = entry + risk * 3
  } else {
    sl = (orderBlock ? Math.max(orderBlock.high, rangeHigh) : rangeHigh) + buffer
    const risk = sl - entry
    tp1 = entry - risk * 1.5
    tp2 = rangeLow
    tp3 = entry - risk * 3
  }

  if (![entry, sl, tp1, tp2, tp3].every(isFiniteNumber)) return { noSignal: true }
  if (direction === 'LONG' && sl >= entry) return { noSignal: true }
  if (direction === 'SHORT' && sl <= entry) return { noSignal: true }

  let bias5m = 'Neutral'
  if (confirm && confirm.length >= 2) {
    const c = confirm[confirm.length - 1]
    bias5m = c.close > c.open ? 'Bullish' : c.close < c.open ? 'Bearish' : 'Neutral'
  }

  return {
    direction,
    strength: orderBlock ? 'Strong' : 'Moderate',
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    bias15m: direction === 'LONG' ? 'Bullish' : 'Bearish',
    bias5m,
    pattern:
      direction === 'LONG'
        ? 'Wyckoff Spring + Bullish CHoCH'
        : 'Wyckoff Upthrust + Bearish CHoCH',
    quickStats: [
      {
        label: 'Range High/Low',
        value: `${rangeHigh.toFixed(5)} / ${rangeLow.toFixed(5)}`,
      },
      // ✅ FIX: choch null safe with optional chaining
      { label: 'CHoCH', value: choch?.type ?? 'N/A' },
      { label: 'Order Block', value: orderBlock ? 'Found' : 'Not found' },
    ],
    structure: [
      {
        label: 'Wyckoff Phase',
        value:
          direction === 'LONG'
            ? 'Accumulation (Spring)'
            : 'Distribution (Upthrust)',
      },
      // ✅ FIX: choch null safe with optional chaining
      {
        label: 'CHoCH Level',
        value: choch?.level?.toFixed(5) ?? 'N/A',
      },
    ],
    detail:
      direction === 'LONG'
        ? 'দাম একটি accumulation range-এর নিচে একটি Spring (false breakdown) তৈরি করেছিল, তারপর আবার রেঞ্জের ভেতরে ফিরে এসে একটি bullish Change of Character (CHoCH) কনফার্ম করেছে — Wyckoff পদ্ধতিতে এটি markup phase শুরুর সাধারণ ইঙ্গিত।'
        : 'দাম একটি distribution range-এর ওপরে একটি Upthrust (false breakout) তৈরি করেছিল, তারপর আবার রেঞ্জের ভেতরে ফিরে এসে একটি bearish Change of Character (CHoCH) কনফার্ম করেছে — Wyckoff পদ্ধতিতে এটি markdown phase শুরুর সাধারণ ইঙ্গিত।',
  }
       }
