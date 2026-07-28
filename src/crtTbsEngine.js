// crtTbsEngine.js — Mode 2: CRT + TBS PRO
// ✅ FINAL VERSION:
// - TP order enforced
// - TP2 fallback to midpoint if range extreme invalid
// - Relaxed TBS condition (body reclaim, not full wick)
// - buffer atr*0.5
// - HTF 4h primary only

import { calcATR, isFiniteNumber } from './smartMoney.js'

const LTF_KEY = '15m'
const CONFIRM_KEY = '5m'
const TRIGGER_WINDOW = 8

export function runCrtTbs({ timeframes, htfBias4h, htfBias1h }) {
  const ltf = timeframes[LTF_KEY]
  const confirm = timeframes[CONFIRM_KEY]

  if (!ltf || ltf.length < 30) return { noSignal: true }

  const atr = calcATR(ltf, 14)
  if (!atr) return { noSignal: true }

  let rangeCandleIdx = -1
  for (let i = ltf.length - 4; i >= Math.max(0, ltf.length - 20); i--) {
    const c = ltf[i]
    if (c.high - c.low > atr * 1.8) {
      rangeCandleIdx = i
      break
    }
  }
  if (rangeCandleIdx === -1) return { noSignal: true }

  const rangeCandle = ltf[rangeCandleIdx]
  const afterRange = ltf.slice(rangeCandleIdx + 1)
  if (afterRange.length < 3) return { noSignal: true }

  const htfAgreesBullish = htfBias4h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish'

  let direction = null
  let triggerB2 = null

  const scanStart = afterRange.length - 1
  const scanEnd = Math.max(2, afterRange.length - TRIGGER_WINDOW)

  for (let j = scanStart; j >= scanEnd; j--) {
    if (j < 2) break
    const b1 = afterRange[j - 2]
    const b2 = afterRange[j - 1]
    const b3 = afterRange[j]

    const b2BullishBody = Math.max(b2.open, b2.close)
    const b2BearishBody = Math.min(b2.open, b2.close)

    const bullishTBS =
      b2.low < rangeCandle.low &&
      b2.low <= b1.low &&
      b3.close > b2BullishBody &&
      b3.close > rangeCandle.low

    const bearishTBS =
      b2.high > rangeCandle.high &&
      b2.high >= b1.high &&
      b3.close < b2BearishBody &&
      b3.close < rangeCandle.high

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

  const stillValid =
    direction === 'LONG'
      ? lastCandle.close > rangeCandle.low
      : lastCandle.close < rangeCandle.high

  if (!stillValid) return { noSignal: true }

  const entry = lastCandle.close
  const buffer = atr * 0.5

  let sl, tp1, tp2, tp3

  if (direction === 'LONG') {
    sl = triggerB2.low - buffer
    const risk = entry - sl
    if (risk <= 0) return { noSignal: true }

    tp1 = entry + risk * 1.5
    tp3 = entry + risk * 3
    tp2 = rangeCandle.high > tp1 && rangeCandle.high < tp3
      ? rangeCandle.high
      : entry + risk * 2.25
  } else {
    sl = triggerB2.high + buffer
    const risk = sl - entry
    if (risk <= 0) return { noSignal: true }

    tp1 = entry - risk * 1.5
    tp3 = entry - risk * 3
    tp2 = rangeCandle.low < tp1 && rangeCandle.low > tp3
      ? rangeCandle.low
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
    pattern:
      direction === 'LONG'
        ? 'Bullish CRT + Three Bar Setup'
        : 'Bearish CRT + Three Bar Setup',
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
        ? 'একটি বড় Range Candle (CRT anchor) তৈরি হওয়ার পর দাম তার নিচের সীমা ভেঙে গিয়েছিল, কিন্তু Three Bar Setup-এর মাধ্যমে আবার সেই রেঞ্জের ভেতরে ফিরে ক্লোজ করেছে — এটি লিকুইডিটি গ্র্যাব করে রিভার্সালের একটি শক্তিশালী সংকেত।'
        : 'একটি বড় Range Candle (CRT anchor) তৈরি হওয়ার পর দাম তার ওপরের সীমা ভেঙে গিয়েছিল, কিন্তু Three Bar Setup-এর মাধ্যমে আবার সেই রেঞ্জের ভেতরে ফিরে ক্লোজ করেছে — এটি লিকুইডিটি গ্র্যাব করে রিভার্সালের একটি শক্তিশালী সংকেত।',
  }
      }
