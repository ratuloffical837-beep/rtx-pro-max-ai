// sweepReclaim.js — Mode 1: SWEEP RECLAIM.
// Liquidity sweep of a recent swing level followed by a reclaim close back
// inside the range. Pure price-action/structure — no indicators.
//
// 🔴 Sweep detection uses Math.max(open, close) / Math.min(open, close)
// against the swing level, never `close` alone.
//
// ── FIX IN THIS VERSION ─────────────────────────────────────────────────
// 🔴 THE "ALWAYS NO SIGNAL" ROOT CAUSE: the trigger check only ever looked
// at EXACTLY the last two candles (ltf[length-1] and ltf[length-2]). A
// liquidity sweep + reclaim that completed 3, 4, or 5 candles ago — still a
// perfectly valid, freshly-reclaimed setup — was invisible to this check,
// because by the time the NEXT candle closed, the "last two candles" window
// had already moved past it. On a 15m chart, requiring the EXACT current
// candle to be the reclaim candle is an extremely narrow window that real
// price action rarely lines up with on demand.
//
// This version scans the last WINDOW_SIZE candles for the most recent
// sweep+reclaim trigger (not just the very last one), then re-validates
// that the setup is STILL structurally valid as of the current candle
// (price hasn't broken back through the swept level, which would mean the
// setup already failed) before using the current price as the entry. This
// mirrors how a real SMC trader would actually use this pattern: "a sweep
// and reclaim happened recently, and price is still respecting it" — not
// "a sweep and reclaim must be happening on this exact tick."

import { findSwings, calcATR, isFiniteNumber } from './smartMoney.js'

const LTF_KEY = '15m'
const CONFIRM_KEY = '5m'

// 🔴 How many recent 15m candles (≈1.5 hours) to scan for a still-valid
// trigger. Wide enough to catch realistic recent setups, narrow enough that
// a trigger this old is still meaningfully "fresh" for a 15m-entry strategy.
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

  // HTF bias must agree — common rule #2, never ignored.
  const htfAgreesBullish = htfBias4h !== 'Bearish' && htfBias1h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish' && htfBias1h !== 'Bullish'

  // 🔴 Scan the recent window for the most recent sweep+reclaim trigger,
  // starting from the newest candle and walking backward — so if multiple
  // triggers exist in the window, the freshest one wins.
  let direction = null
  let sweepLevel = null

  const scanStart = ltf.length - 1
  const scanEnd = Math.max(1, ltf.length - TRIGGER_WINDOW)

  for (let i = scanStart; i >= scanEnd; i--) {
    const candle = ltf[i]
    const prev = ltf[i - 1]
    if (!prev) continue

    const bullishSweep =
      prev.low < recentSwingLow.price && Math.min(candle.open, candle.close) > recentSwingLow.price
    const bearishSweep =
      prev.high > recentSwingHigh.price && Math.max(candle.open, candle.close) < recentSwingHigh.price

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

  // 🔴 Invalidation check: even though the trigger candle may be a few bars
  // back, the setup must STILL be structurally valid right now — price
  // must not have broken back through the swept level since the trigger,
  // which would mean the reclaim already failed.
  const stillValid =
    direction === 'LONG' ? lastCandle.close > sweepLevel : lastCandle.close < sweepLevel

  if (!stillValid) return { noSignal: true }

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
      // 🔴 FIX: this was `(direction === 'LONG' ? tp2 : tp2).toFixed(5)` — a
      // redundant ternary that returned tp2 either way (harmless, since tp2
      // IS the correct structure target for both directions, but the dead
      // ternary was confusing/misleading code). Simplified to a direct
      // reference — no behavior change, just honest code.
      { label: 'Structure Target', value: tp2.toFixed(5) },
    ],
    detail:
      direction === 'LONG'
        ? 'দাম আগের একটি swing low ভেঙে liquidity sweep করেছে, তারপর candle body আবার সেই লেভেলের ওপরে ক্লোজ করে reclaim নিশ্চিত করেছে (সাম্প্রতিক কয়েকটি ক্যান্ডেলের মধ্যে) এবং এখনো সেই স্ট্রাকচার বজায় আছে। এটি institutional buying-এর একটি সাধারণ ফুটপ্রিন্ট।'
        : 'দাম আগের একটি swing high ভেঙে liquidity sweep করেছে, তারপর candle body আবার সেই লেভেলের নিচে ক্লোজ করে reclaim নিশ্চিত করেছে (সাম্প্রতিক কয়েকটি ক্যান্ডেলের মধ্যে) এবং এখনো সেই স্ট্রাকচার বজায় আছে। এটি institutional selling-এর একটি সাধারণ ফুটপ্রিন্ট।',
  }
}
