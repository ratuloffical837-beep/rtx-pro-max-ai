// wyckoffIctEngine.js — Mode 3: WYCKOFF + ICT/SMC.
// Wyckoff Spring (false breakdown below range support, i.e. accumulation
// phase) or Upthrust (false breakout above range resistance, distribution
// phase) combined with an ICT-style CHoCH/Order Block confirmation.

import { findSwings, calcATR, detectOrderBlock, detectBOSCHoCH, isFiniteNumber } from './smartMoney.js'

const LTF_KEY = '15m'
const CONFIRM_KEY = '5m'
const RANGE_LOOKBACK = 20

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

  const recent = ltf.slice(-3)
  const [prev2, prev1, last] = recent

  // Spring: wick dips below range low, close reclaims back inside — the
  // Wyckoff "shakeout" before markup.
  const isSpring = prev1.low < rangeLow && Math.min(prev1.open, prev1.close) > rangeLow && last.close > rangeLow

  // Upthrust: wick pokes above range high, close falls back inside — the
  // Wyckoff distribution signal before markdown.
  const isUpthrust = prev1.high > rangeHigh && Math.max(prev1.open, prev1.close) < rangeHigh && last.close < rangeHigh

  const choch = detectBOSCHoCH(ltf)

  const htfAgreesBullish = htfBias4h !== 'Bearish' && htfBias1h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish' && htfBias1h !== 'Bullish'

  let direction = null
  if (isSpring && htfAgreesBullish && choch?.direction === 'bullish') direction = 'LONG'
  else if (isUpthrust && htfAgreesBearish && choch?.direction === 'bearish') direction = 'SHORT'
  else return { noSignal: true }

  const orderBlock = detectOrderBlock(ltf, direction)
  const entry = last.close
  const buffer = atr * 0.3

  let sl, tp1, tp2, tp3
  if (direction === 'LONG') {
    sl = (orderBlock ? orderBlock.low : prev1.low) - buffer
    const risk = entry - sl
    tp1 = entry + risk * 1.5
    tp2 = rangeHigh
    tp3 = entry + risk * 3
  } else {
    sl = (orderBlock ? orderBlock.high : prev1.high) + buffer
    const risk = sl - entry
    tp1 = entry - risk * 1.5
    tp2 = rangeLow
    tp3 = entry - risk * 3
  }

  if (![entry, sl, tp1, tp2, tp3].every(isFiniteNumber)) return { noSignal: true }

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
        ? 'দাম একটি accumulation range-এর নিচে একটি Spring (false breakdown) তৈরি করেছে, তারপর আবার রেঞ্জের ভেতরে ফিরে এসে একটি bullish Change of Character (CHoCH) কনফার্ম করেছে — Wyckoff পদ্ধতিতে এটি markup phase শুরুর সাধারণ ইঙ্গিত।'
        : 'দাম একটি distribution range-এর ওপরে একটি Upthrust (false breakout) তৈরি করেছে, তারপর আবার রেঞ্জের ভেতরে ফিরে এসে একটি bearish Change of Character (CHoCH) কনফার্ম করেছে — Wyckoff পদ্ধতিতে এটি markdown phase শুরুর সাধারণ ইঙ্গিত।',
  }
}
