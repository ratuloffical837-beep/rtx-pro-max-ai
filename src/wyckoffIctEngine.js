// wyckoffIctEngine.js — Mode 3: WYCKOFF + ICT/SMC.
// Wyckoff Spring (false breakdown below range support, i.e. accumulation
// phase) or Upthrust (false breakout above range resistance, distribution
// phase) combined with an ICT-style CHoCH/Order Block confirmation.
//
// ── FIX IN THIS VERSION ─────────────────────────────────────────────────
// 🔴 THE "ALWAYS NO SIGNAL" ROOT CAUSE: the Spring/Upthrust check only ever
// looked at `ltf.slice(-3)` — meaning the spring/upthrust candle had to be
// EXACTLY the second-to-last candle, with the very last candle as the
// reclaim. A spring/upthrust that reclaimed 2-5 candles ago (still a
// perfectly valid accumulation/distribution signal) was invisible here.
//
// This version scans a recent window for the most recent spring/upthrust
// candle (not just the fixed second-to-last position), then re-validates
// that price is still respecting the range as of the current candle (i.e.
// hasn't broken back out, which would invalidate the setup) before
// requiring CHoCH confirmation and entering at the current price.

import { findSwings, calcATR, detectOrderBlock, detectBOSCHoCH, isFiniteNumber } from './smartMoney.js'

const LTF_KEY = '15m'
const CONFIRM_KEY = '5m'
const RANGE_LOOKBACK = 20

// 🔴 How many recent candles to scan for a still-valid spring/upthrust
// trigger, instead of only the fixed second-to-last candle.
const TRIGGER_WINDOW = 6

export function runWyckoffIct({ timeframes, htfBias4h, htfBias1h }) {
  const ltf = timeframes[LTF_KEY]
  const confirm = timeframes[CONFIRM_KEY]

  if (!ltf || ltf.length < 30) return { noSignal: true }

  const atr = calcATR(ltf, 14)
  if (!atr) return { noSignal: true }

  const window = ltf.slice(-RANGE_LOOKBACK, -3)
  if (window.length < 10) return { noSignal: true }

  const rangeHigh = Math.max(...window.map((c) => c.high))
  const rangeLow = Math.min(...window.map((c) => c.low))

  const last = ltf[ltf.length - 1]

  // 🔴 Scan backward through the recent window for the most recent
  // spring/upthrust candle — a candle that wicked outside the range but
  // closed its body back inside.
  let triggerDirection = null

  const scanStart = ltf.length - 2 // start one before the current candle
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

  // 🔴 Invalidation check: price must still be inside the range as of the
  // current candle — a spring/upthrust that has since been fully broken
  // back through no longer represents a valid accumulation/distribution setup.
  const stillValid = triggerDirection === 'LONG' ? last.close > rangeLow : last.close < rangeHigh
  if (!stillValid) return { noSignal: true }

  // CHoCH confirmation is evaluated on current structure — this is
  // intentionally a "live" check, not windowed, since it reflects whether
  // the broader structural shift is still in effect right now.
  const choch = detectBOSCHoCH(ltf)

  const htfAgreesBullish = htfBias4h !== 'Bearish' && htfBias1h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish' && htfBias1h !== 'Bullish'

  let direction = null
  if (triggerDirection === 'LONG' && htfAgreesBullish && choch?.direction === 'bullish') direction = 'LONG'
  else if (triggerDirection === 'SHORT' && htfAgreesBearish && choch?.direction === 'bearish') direction = 'SHORT'
  else return { noSignal: true }

  const orderBlock = detectOrderBlock(ltf, direction)
  const entry = last.close
  const buffer = atr * 0.3

  // SL anchors to the range boundary itself (a stable structural level)
  // rather than a specific historical candle's wick, since the trigger
  // candle may now be several bars back.
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
    pattern: direction === 'LONG' ? 'Wyckoff Spring + Bullish CHoCH' : 'Wyckoff Upthrust + Bearish CHoCH',
    quickStats: [
      { label: 'Range High/Low', value: `${rangeHigh.toFixed(5)} / ${rangeLow.toFixed(5)}` },
      { label: 'CHoCH', value: choch.type },
      { label: 'Order Block', value: orderBlock ? 'Found' : 'Not found' },
    ],
    structure: [
      { label: 'Wyckoff Phase', value: direction === 'LONG' ? 'Accumulation (Spring)' : 'Distribution (Upthrust)' },
      { label: 'CHoCH Level', value: choch.level.toFixed(5) },
    ],
    detail:
      direction === 'LONG'
        ? 'দাম একটি accumulation range-এর নিচে একটি Spring (false breakdown) তৈরি করেছিল (সাম্প্রতিক কয়েকটি ক্যান্ডেলের মধ্যে), তারপর আবার রেঞ্জের ভেতরে ফিরে এসে একটি bullish Change of Character (CHoCH) কনফার্ম করেছে — Wyckoff পদ্ধতিতে এটি markup phase শুরুর সাধারণ ইঙ্গিত।'
        : 'দাম একটি distribution range-এর ওপরে একটি Upthrust (false breakout) তৈরি করেছিল (সাম্প্রতিক কয়েকটি ক্যান্ডেলের মধ্যে), তারপর আবার রেঞ্জের ভেতরে ফিরে এসে একটি bearish Change of Character (CHoCH) কনফার্ম করেছে — Wyckoff পদ্ধতিতে এটি markdown phase শুরুর সাধারণ ইঙ্গিত।',
  }
    }
