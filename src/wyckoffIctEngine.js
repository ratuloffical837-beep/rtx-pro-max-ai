// wyckoffIctEngine.js — Mode 3: WYCKOFF + ICT/SMC
// ✅ RELAXED VERSION:
// - CHoCH is now BONUS confirmation, not hard requirement
// - Signal generates if Spring/Upthrust + HTF agree
// - CHoCH presence makes strength "Strong", absence = "Moderate"

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

  const choch = detectBOSCHoCH(ltf)

  const htfAgreesBullish = htfBias4h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish'

  let direction = null

  // ✅ RELAXED: CHoCH is now bonus, not required
  if (triggerDirection === 'LONG' && htfAgreesBullish) {
    // If CHoCH is bearish, it conflicts — block signal
    if (choch?.direction === 'bearish') return { noSignal: true }
    direction = 'LONG'
  } else if (triggerDirection === 'SHORT' && htfAgreesBearish) {
    if (choch?.direction === 'bullish') return { noSignal: true }
    direction = 'SHORT'
  } else {
    return { noSignal: true }
  }

  const chochAgrees = choch?.direction === (direction === 'LONG' ? 'bullish' : 'bearish')

  const orderBlock = detectOrderBlock(ltf, direction)
  const entry = last.close
  const buffer = atr * 0.5

  let sl, tp1, tp2, tp3
  if (direction === 'LONG') {
    sl = (orderBlock ? Math.min(orderBlock.low, rangeLow) : rangeLow) - buffer
    const risk = entry - sl
    if (risk <= 0) return { noSignal: true }

    tp1 = entry + risk * 1.5
    tp3 = entry + risk * 3
    tp2 = rangeHigh > tp1 && rangeHigh < tp3
      ? rangeHigh
      : entry + risk * 2.25
  } else {
    sl = (orderBlock ? Math.max(orderBlock.high, rangeHigh) : rangeHigh) + buffer
    const risk = sl - entry
    if (risk <= 0) return { noSignal: true }

    tp1 = entry - risk * 1.5
    tp3 = entry - risk * 3
    tp2 = rangeLow < tp1 && rangeLow > tp3
      ? rangeLow
      : entry - risk * 2.25
  }

  if (![entry, sl, tp1, tp2, tp3].every(isFiniteNumber)) return { noSignal: true }
  if (direction === 'LONG' && sl >= entry) return { noSignal: true }
  if (direction === 'SHORT' && sl <= entry) return { noSignal: true }

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

  // ✅ Strength based on how many confluences we got
  const confluenceCount = (chochAgrees ? 1 : 0) + (orderBlock ? 1 : 0)
  const strength = confluenceCount === 2 ? 'Strong' : confluenceCount === 1 ? 'Moderate' : 'Weak'

  return {
    direction,
    strength,
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    bias15m: direction === 'LONG' ? 'Bullish' : 'Bearish',
    bias5m,
    pattern:
      direction === 'LONG'
        ? 'Wyckoff Spring' + (chochAgrees ? ' + Bullish CHoCH' : '')
        : 'Wyckoff Upthrust' + (chochAgrees ? ' + Bearish CHoCH' : ''),
    quickStats: [
      { label: 'Range High/Low', value: `${rangeHigh.toFixed(5)} / ${rangeLow.toFixed(5)}` },
      { label: 'CHoCH', value: chochAgrees ? (choch?.type ?? 'Yes') : 'None' },
      { label: 'Order Block', value: orderBlock ? 'Found' : 'None' },
    ],
    structure: [
      {
        label: 'Wyckoff Phase',
        value: direction === 'LONG' ? 'Accumulation (Spring)' : 'Distribution (Upthrust)',
      },
      { label: 'Confluence', value: `${confluenceCount}/2` },
    ],
    detail:
      direction === 'LONG'
        ? 'দাম একটি accumulation range-এর নিচে Spring (false breakdown) তৈরি করেছিল এবং আবার range-এ ফিরে এসেছে — Wyckoff markup phase শুরুর ইঙ্গিত।'
        : 'দাম একটি distribution range-এর ওপরে Upthrust (false breakout) তৈরি করেছিল এবং আবার range-এ ফিরে এসেছে — Wyckoff markdown phase শুরুর ইঙ্গিত।',
  }
    }
