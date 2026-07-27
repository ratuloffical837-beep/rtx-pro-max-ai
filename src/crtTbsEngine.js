// crtTbsEngine.js — Mode 2: CRT + TBS PRO.
// Candle Range Theory (a large "range candle" whose high/low acts as a
// temporary liquidity container) combined with a Three Bar Setup reversal
// confirmation. Pure price-action — no indicators.
//
// ── FIX IN THIS VERSION ─────────────────────────────────────────────────
// 🔴 THE "ALWAYS NO SIGNAL" ROOT CAUSE: the Three Bar Setup check used
// `afterRange.slice(-3)` — meaning bar1/bar2/bar3 had to be EXACTLY the
// last three candles of the entire dataset. If the TBS pattern completed
// even one candle earlier (still a fresh, valid reversal), it was
// completely invisible to this check. Requiring the exhaustion pattern to
// land on the EXACT current candle is unrealistically narrow for a 15m
// price-action strategy.
//
// This version scans a recent window of `afterRange` for the most recent
// valid 3-bar sequence (not just the literal last 3), then re-validates
// that price is still respecting the structure as of the current candle
// before entering at the current price — same "recently happened and still
// valid" philosophy as the other mode engines' fixes.

import { calcATR, isFiniteNumber } from './smartMoney.js'

const LTF_KEY = '15m'
const CONFIRM_KEY = '5m'

// 🔴 How many recent candles of `afterRange` to scan for a still-valid
// Three Bar Setup trigger, instead of only the literal last 3.
const TRIGGER_WINDOW = 8

export function runCrtTbs({ timeframes, htfBias4h, htfBias1h }) {
  const ltf = timeframes[LTF_KEY]
  const confirm = timeframes[CONFIRM_KEY]

  if (!ltf || ltf.length < 30) return { noSignal: true }

  const atr = calcATR(ltf, 14)
  if (!atr) return { noSignal: true }

  // Find the most recent "range candle": a candle whose range is
  // meaningfully larger than the local average — this is the CRT anchor.
  let rangeCandleIdx = -1
  for (let i = ltf.length - 4; i >= Math.max(0, ltf.length - 20); i--) {
    const c = ltf[i]
    const range = c.high - c.low
    if (range > atr * 1.8) {
      rangeCandleIdx = i
      break
    }
  }
  if (rangeCandleIdx === -1) return { noSignal: true }

  const rangeCandle = ltf[rangeCandleIdx]
  const afterRange = ltf.slice(rangeCandleIdx + 1)
  if (afterRange.length < 3) return { noSignal: true }

  const htfAgreesBullish = htfBias4h !== 'Bearish' && htfBias1h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish' && htfBias1h !== 'Bullish'

  // 🔴 Scan backward through the recent window of afterRange for the most
  // recent valid Three Bar Setup (b1 breaks CRT high/low, b2 is the
  // extreme, b3 closes back inside) — not just the literal last 3 candles.
  let direction = null
  let triggerB2 = null

  const scanStart = afterRange.length - 1
  const scanEnd = Math.max(2, afterRange.length - TRIGGER_WINDOW)

  for (let j = scanStart; j >= scanEnd; j--) {
    if (j < 2) break
    const b1 = afterRange[j - 2]
    const b2 = afterRange[j - 1]
    const b3 = afterRange[j]

    const bullishTBS =
      b2.low < rangeCandle.low && b2.low <= b1.low && b3.close > b2.high && b3.close > rangeCandle.low
    const bearishTBS =
      b2.high > rangeCandle.high && b2.high >= b1.high && b3.close < b2.low && b3.close < rangeCandle.high

    if (bullishTBS && htfAgreesBullish) {
      direction = 'LONG'
      triggerB2 = b2
      break
    }
    if (bearishTBS && htfAgreesBearish) {
      direction = 'SHORT'
      triggerB2 = b2
      break
    }
  }

  if (!direction) return { noSignal: true }

  const lastCandle = ltf[ltf.length - 1]

  // 🔴 Invalidation check: price must still be respecting the structure as
  // of right now — hasn't broken back through the CRT range boundary,
  // which would mean the reversal already failed.
  const stillValid =
    direction === 'LONG' ? lastCandle.close > rangeCandle.low : lastCandle.close < rangeCandle.high

  if (!stillValid) return { noSignal: true }

  const entry = lastCandle.close
  const buffer = atr * 0.3

  let sl, tp1, tp2, tp3
  if (direction === 'LONG') {
    sl = triggerB2.low - buffer
    const risk = entry - sl
    tp1 = entry + risk * 1.5
    tp2 = rangeCandle.high
    tp3 = entry + risk * 3
  } else {
    sl = triggerB2.high + buffer
    const risk = sl - entry
    tp1 = entry - risk * 1.5
    tp2 = rangeCandle.low
    tp3 = entry - risk * 3
  }

  if (![entry, sl, tp1, tp2, tp3].every(isFiniteNumber)) return { noSignal: true }
  // 🔴 Guard against a degenerate/inverted SL if price has drifted a lot
  // since the trigger candle (e.g. b2 is now on the wrong side of entry).
  if (direction === 'LONG' && sl >= entry) return { noSignal: true }
  if (direction === 'SHORT' && sl <= entry) return { noSignal: true }

  let bias5m = 'Neutral'
  if (confirm && confirm.length >= 2) {
    const c = confirm[confirm.length - 1]
    bias5m = c.close > c.open ? 'Bullish' : c.close < c.open ? 'Bearish' : 'Neutral'
  }

  const rangeSizeVsAtr = (rangeCandle.high - rangeCandle.low) / atr

  return {
    direction,
    strength: rangeSizeVsAtr > 2.5 ? 'Strong' : 'Moderate',
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    bias15m: direction === 'LONG' ? 'Bullish' : 'Bearish',
    bias5m,
    pattern: direction === 'LONG' ? 'Bullish CRT + Three Bar Setup' : 'Bearish CRT + Three Bar Setup',
    quickStats: [
      { label: 'CRT Range Size', value: `${(rangeCandle.high - rangeCandle.low).toFixed(5)}` },
      { label: 'Range vs ATR', value: `${rangeSizeVsAtr.toFixed(1)}x` },
      { label: 'Grade', value: rangeSizeVsAtr > 2.5 ? 'A' : 'B' },
    ],
    structure: [
      { label: 'CRT High', value: rangeCandle.high.toFixed(5) },
      { label: 'CRT Low', value: rangeCandle.low.toFixed(5) },
    ],
    detail:
      direction === 'LONG'
        ? 'একটি বড় Range Candle (CRT anchor) তৈরি হওয়ার পর দাম তার নিচের সীমা ভেঙে গিয়েছিল, কিন্তু Three Bar Setup-এর মাধ্যমে (সাম্প্রতিক কয়েকটি ক্যান্ডেলের মধ্যে) আবার সেই রেঞ্জের ভেতরে ফিরে ক্লোজ করেছে এবং এখনো স্ট্রাকচার বজায় আছে — এটি লিকুইডিটি গ্র্যাব করে রিভার্সালের একটি শক্তিশালী সংকেত।'
        : 'একটি বড় Range Candle (CRT anchor) তৈরি হওয়ার পর দাম তার ওপরের সীমা ভেঙে গিয়েছিল, কিন্তু Three Bar Setup-এর মাধ্যমে (সাম্প্রতিক কয়েকটি ক্যান্ডেলের মধ্যে) আবার সেই রেঞ্জের ভেতরে ফিরে ক্লোজ করেছে এবং এখনো স্ট্রাকচার বজায় আছে — এটি লিকুইডিটি গ্র্যাব করে রিভার্সালের একটি শক্তিশালী সংকেত।',
  }
      }
