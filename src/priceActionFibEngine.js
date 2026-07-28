// priceActionFibEngine.js — Mode 5: PRICE ACTION + FIBONACCI
// ✅ RELAXED VERSION:
// - Reversal candle body ratio lowered 0.4 → 0.3
// - Direction of impulse now considered more flexibly

import { findSwings, calcATR, isFiniteNumber } from './smartMoney.js'

const LTF_KEY = '15m'
const CONFIRM_KEY = '5m'
const GOLDEN_POCKET_LOW = 0.5   // ✅ Extended from 0.618 to 0.5 (wider zone)
const GOLDEN_POCKET_HIGH = 0.79
const TRIGGER_WINDOW = 8         // ✅ Extended from 6 to 8

export function runPriceActionFib({ timeframes, htfBias4h, htfBias1h }) {
  const ltf = timeframes[LTF_KEY]
  const confirm = timeframes[CONFIRM_KEY]

  if (!ltf || ltf.length < 30) return { noSignal: true }

  const atr = calcATR(ltf, 14)
  if (!atr) return { noSignal: true }

  const { swingHighs, swingLows } = findSwings(ltf, 2)
  if (swingHighs.length < 2 || swingLows.length < 2) return { noSignal: true }

  const lastSwingHigh = swingHighs[swingHighs.length - 1]
  const lastSwingLow = swingLows[swingLows.length - 1]
  const lastCandle = ltf[ltf.length - 1]

  const impulseIsUp = lastSwingHigh.index > lastSwingLow.index

  let fibHigh, fibLow, entryZoneLow, entryZoneHigh

  if (impulseIsUp) {
    fibLow = lastSwingLow.price
    fibHigh = lastSwingHigh.price
    const range = fibHigh - fibLow
    entryZoneHigh = fibHigh - range * GOLDEN_POCKET_LOW
    entryZoneLow = fibHigh - range * GOLDEN_POCKET_HIGH
  } else {
    fibHigh = lastSwingHigh.price
    fibLow = lastSwingLow.price
    const range = fibHigh - fibLow
    entryZoneLow = fibLow + range * GOLDEN_POCKET_LOW
    entryZoneHigh = fibLow + range * GOLDEN_POCKET_HIGH
  }

  if (!isFiniteNumber(entryZoneLow) || !isFiniteNumber(entryZoneHigh)) {
    return { noSignal: true }
  }

  let direction = null

  const scanStart = ltf.length - 1
  const scanEnd = Math.max(0, ltf.length - TRIGGER_WINDOW)

  for (let i = scanStart; i >= scanEnd; i--) {
    const c = ltf[i]
    const bodySize = Math.abs(c.close - c.open)
    const totalRange = c.high - c.low
    const bodyRatio = totalRange > 0 ? bodySize / totalRange : 0

    if (impulseIsUp) {
      const inZone = c.low <= entryZoneHigh && c.low >= entryZoneLow
      // ✅ RELAXED: body ratio lowered from 0.4 to 0.3
      const bullishReversalCandle = c.close > c.open && bodyRatio >= 0.3
      if (inZone && bullishReversalCandle) {
        direction = 'LONG'
        break
      }
    } else {
      const inZone = c.high >= entryZoneLow && c.high <= entryZoneHigh
      const bearishReversalCandle = c.close < c.open && bodyRatio >= 0.3
      if (inZone && bearishReversalCandle) {
        direction = 'SHORT'
        break
      }
    }
  }

  if (!direction) return { noSignal: true }

  const htfAgreesBullish = htfBias4h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish'

  if (direction === 'LONG' && !htfAgreesBullish) return { noSignal: true }
  if (direction === 'SHORT' && !htfAgreesBearish) return { noSignal: true }

  const stillValid =
    direction === 'LONG'
      ? lastCandle.close > fibLow
      : lastCandle.close < fibHigh

  if (!stillValid) return { noSignal: true }

  const entry = lastCandle.close
  const buffer = atr * 0.5

  let sl, tp1, tp2, tp3
  if (direction === 'LONG') {
    sl = fibLow - buffer
    const risk = entry - sl
    if (risk <= 0) return { noSignal: true }

    tp1 = entry + risk * 1.5
    const extensionTarget = fibHigh + (fibHigh - fibLow) * 0.272
    tp3 = extensionTarget > entry + risk * 3 ? extensionTarget : entry + risk * 3
    tp2 = fibHigh > tp1 && fibHigh < tp3
      ? fibHigh
      : entry + risk * 2.25
  } else {
    sl = fibHigh + buffer
    const risk = sl - entry
    if (risk <= 0) return { noSignal: true }

    tp1 = entry - risk * 1.5
    const extensionTarget = fibLow - (fibHigh - fibLow) * 0.272
    tp3 = extensionTarget < entry - risk * 3 ? extensionTarget : entry - risk * 3
    tp2 = fibLow < tp1 && fibLow > tp3
      ? fibLow
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

  return {
    direction,
    strength: 'Moderate',
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    bias15m: direction === 'LONG' ? 'Bullish' : 'Bearish',
    bias5m,
    pattern:
      direction === 'LONG'
        ? 'Bullish Fibonacci Retracement'
        : 'Bearish Fibonacci Retracement',
    quickStats: [
      { label: 'Fib Zone', value: `${entryZoneLow.toFixed(5)} - ${entryZoneHigh.toFixed(5)}` },
      { label: 'Impulse', value: (fibHigh - fibLow).toFixed(5) },
      { label: 'Grade', value: 'B' },
    ],
    structure: [
      { label: 'Swing High', value: fibHigh.toFixed(5) },
      { label: 'Swing Low', value: fibLow.toFixed(5) },
    ],
    detail:
      direction === 'LONG'
        ? 'একটি bullish impulse leg-এর পর দাম 50-79% Fibonacci zone-এ retrace করে reversal তৈরি করেছে।'
        : 'একটি bearish impulse leg-এর পর দাম 50-79% Fibonacci zone-এ retrace করে reversal তৈরি করেছে।',
  }
    }
