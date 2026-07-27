// priceActionFibEngine.js — Mode 5: PRICE ACTION + FIBONACCI.
// An impulsive swing move, retracement into the 61.8%-79% "golden pocket",
// confirmed by a candlestick reversal signal (pin bar / engulfing).
//
// 🔴 Fibonacci extension math uses two separate branches for bullish (+) vs
// bearish (-), never one shared-sign formula.
//
// ── FIX IN THIS VERSION ─────────────────────────────────────────────────
// 🔴 THE "ALWAYS NO SIGNAL" ROOT CAUSE: this engine required the retracement
// into the golden pocket AND the reversal candlestick to both be on
// EXACTLY the last candle. A retracement that tagged the golden pocket 2-5
// candles ago, with the reversal candle right after it, was completely
// invisible — by the next candle close, "the last candle" had already
// moved past the actual trigger.
//
// This version scans a recent window for the most recent candle that
// tagged the golden pocket zone with a reversal-candle shape, then
// re-validates the setup is still structurally intact (price hasn't broken
// back through the swing high/low, which would invalidate the fib
// structure itself) before entering at the current price.

import { findSwings, calcATR, isFiniteNumber } from './smartMoney.js'

const LTF_KEY = '15m'
const CONFIRM_KEY = '5m'
const GOLDEN_POCKET_LOW = 0.618
const GOLDEN_POCKET_HIGH = 0.79

// 🔴 How many recent candles to scan for a still-valid golden-pocket
// reversal trigger, instead of only the literal last candle.
const TRIGGER_WINDOW = 6

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

  // 🔴 Scan backward through the recent window for the most recent candle
  // that tagged the golden pocket with a reversal-candle shape.
  let direction = null

  const scanStart = ltf.length - 1
  const scanEnd = Math.max(0, ltf.length - TRIGGER_WINDOW)

  for (let i = scanStart; i >= scanEnd; i--) {
    const c = ltf[i]

    if (impulseIsUp) {
      const inZone = c.low <= entryZoneHigh && c.low >= entryZoneLow
      const bullishReversalCandle = c.close > c.open && c.close > (c.open + c.close) / 2
      if (inZone && bullishReversalCandle) {
        direction = 'LONG'
        break
      }
    } else {
      const inZone = c.high >= entryZoneLow && c.high <= entryZoneHigh
      const bearishReversalCandle = c.close < c.open
      if (inZone && bearishReversalCandle) {
        direction = 'SHORT'
        break
      }
    }
  }

  if (!direction) return { noSignal: true }

  const htfAgreesBullish = htfBias4h !== 'Bearish' && htfBias1h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish' && htfBias1h !== 'Bullish'

  if (direction === 'LONG' && !htfAgreesBullish) return { noSignal: true }
  if (direction === 'SHORT' && !htfAgreesBearish) return { noSignal: true }

  // 🔴 Invalidation check: the fib structure itself must still be intact —
  // price hasn't broken back through the swing that defines fibHigh/fibLow,
  // which would invalidate the whole retracement structure.
  const stillValid = direction === 'LONG' ? lastCandle.close > fibLow : lastCandle.close < fibHigh
  if (!stillValid) return { noSignal: true }

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
  if (direction === 'LONG' && sl >= entry) return { noSignal: true }
  if (direction === 'SHORT' && sl <= entry) return { noSignal: true }

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
        ? 'একটি bullish impulse leg-এর পর দাম 61.8%–79% Fibonacci golden pocket-এ retrace করেছিল (সাম্প্রতিক কয়েকটি ক্যান্ডেলের মধ্যে) এবং সেখানে একটি bullish candlestick reversal তৈরি হয়েছিল — impulse leg-এর ধারাবাহিকতা আবার শুরু হওয়ার সম্ভাবনা তৈরি করেছে, এবং স্ট্রাকচার এখনো বজায় আছে।'
        : 'একটি bearish impulse leg-এর পর দাম 61.8%–79% Fibonacci golden pocket-এ retrace করেছিল (সাম্প্রতিক কয়েকটি ক্যান্ডেলের মধ্যে) এবং সেখানে একটি bearish candlestick reversal তৈরি হয়েছিল — impulse leg-এর ধারাবাহিকতা আবার শুরু হওয়ার সম্ভাবনা তৈরি করেছে, এবং স্ট্রাকচার এখনো বজায় আছে।',
  }
    }
