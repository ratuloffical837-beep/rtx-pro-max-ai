// priceActionFibEngine.js — Mode 5: PRICE ACTION + FIBONACCI.
// An impulsive swing move, retracement into the 61.8%-79% "golden pocket",
// confirmed by a candlestick reversal signal (pin bar / engulfing).
//
// 🔴 Fibonacci extension math uses two separate branches for bullish (+) vs
// bearish (-), never one shared-sign formula.

import { findSwings, calcATR, isFiniteNumber } from './smartMoney.js'

const LTF_KEY = '15m'
const CONFIRM_KEY = '5m'
const GOLDEN_POCKET_LOW = 0.618
const GOLDEN_POCKET_HIGH = 0.79

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

  // Determine which swing came first (the impulse leg) vs which is more
  // recent (the retracement leg endpoint).
  const impulseIsUp = lastSwingHigh.index > lastSwingLow.index

  let direction = null
  let fibHigh, fibLow, entryZoneLow, entryZoneHigh

  if (impulseIsUp) {
    // Bullish impulse leg low -> high, now retracing down into the golden pocket.
    fibLow = lastSwingLow.price
    fibHigh = lastSwingHigh.price
    const range = fibHigh - fibLow
    // Bullish branch: retracement measured DOWN from the high.
    entryZoneHigh = fibHigh - range * GOLDEN_POCKET_LOW
    entryZoneLow = fibHigh - range * GOLDEN_POCKET_HIGH

    const inZone = lastCandle.low <= entryZoneHigh && lastCandle.low >= entryZoneLow
    const bullishReversalCandle = lastCandle.close > lastCandle.open && lastCandle.close > (lastCandle.open + lastCandle.close) / 2

    if (inZone && bullishReversalCandle) direction = 'LONG'
  } else {
    // Bearish impulse leg high -> low, now retracing up into the golden pocket.
    fibHigh = lastSwingHigh.price
    fibLow = lastSwingLow.price
    const range = fibHigh - fibLow
    // Bearish branch: retracement measured UP from the low — separate sign,
    // never shared with the bullish formula above.
    entryZoneLow = fibLow + range * GOLDEN_POCKET_LOW
    entryZoneHigh = fibLow + range * GOLDEN_POCKET_HIGH

    const inZone = lastCandle.high >= entryZoneLow && lastCandle.high <= entryZoneHigh
    const bearishReversalCandle = lastCandle.close < lastCandle.open

    if (inZone && bearishReversalCandle) direction = 'SHORT'
  }

  const htfAgreesBullish = htfBias4h !== 'Bearish' && htfBias1h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish' && htfBias1h !== 'Bullish'

  if (direction === 'LONG' && !htfAgreesBullish) return { noSignal: true }
  if (direction === 'SHORT' && !htfAgreesBearish) return { noSignal: true }
  if (!direction) return { noSignal: true }

  const entry = lastCandle.close
  const buffer = atr * 0.3

  let sl, tp1, tp2, tp3
  if (direction === 'LONG') {
    sl = fibLow - buffer
    const risk = entry - sl
    tp1 = entry + risk * 1.5
    tp2 = fibHigh
    tp3 = fibHigh + (fibHigh - fibLow) * 0.272 // 127.2% extension, bullish branch
  } else {
    sl = fibHigh + buffer
    const risk = sl - entry
    tp1 = entry - risk * 1.5
    tp2 = fibLow
    tp3 = fibLow - (fibHigh - fibLow) * 0.272 // 127.2% extension, bearish branch (separate sign)
  }

  if (![entry, sl, tp1, tp2, tp3].every(isFiniteNumber)) return { noSignal: true }

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
    pattern: direction === 'LONG' ? 'Bullish Golden Pocket Reversal' : 'Bearish Golden Pocket Reversal',
    quickStats: [
      { label: 'Fib Zone', value: `${entryZoneLow.toFixed(5)} - ${entryZoneHigh.toFixed(5)}` },
      { label: 'Impulse Range', value: (fibHigh - fibLow).toFixed(5) },
      { label: 'Grade', value: 'B' },
    ],
    structure: [
      { label: 'Swing High', value: fibHigh.toFixed(5) },
      { label: 'Swing Low', value: fibLow.toFixed(5) },
    ],
    detail:
      direction === 'LONG'
        ? 'একটি bullish impulse leg-এর পর দাম 61.8%–79% Fibonacci golden pocket-এ retrace করেছে এবং সেখানে একটি bullish candlestick reversal তৈরি হয়েছে — impulse leg-এর ধারাবাহিকতা আবার শুরু হওয়ার সম্ভাবনা তৈরি করেছে।'
        : 'একটি bearish impulse leg-এর পর দাম 61.8%–79% Fibonacci golden pocket-এ retrace করেছে এবং সেখানে একটি bearish candlestick reversal তৈরি হয়েছে — impulse leg-এর ধারাবাহিকতা আবার শুরু হওয়ার সম্ভাবনা তৈরি করেছে।',
  }
      }
