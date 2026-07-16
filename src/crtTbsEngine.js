// crtTbsEngine.js — Mode 2: CRT + TBS PRO.
// Candle Range Theory (a large "range candle" whose high/low acts as a
// temporary liquidity container) combined with a Three Bar Setup reversal
// confirmation. Pure price-action — no indicators.

import { calcATR, isFiniteNumber } from './smartMoney.js'

const LTF_KEY = '15m'
const CONFIRM_KEY = '5m'

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

  // Three Bar Setup: bar1 breaks CRT high/low, bar2 is the extreme
  // (highest/lowest), bar3 closes back inside — a classic exhaustion
  // reversal pattern.
  const [b1, b2, b3] = afterRange.slice(-3)

  const bullishTBS =
    b2.low < rangeCandle.low && b2.low <= b1.low && b3.close > b2.high && b3.close > rangeCandle.low

  const bearishTBS =
    b2.high > rangeCandle.high && b2.high >= b1.high && b3.close < b2.low && b3.close < rangeCandle.high

  const htfAgreesBullish = htfBias4h !== 'Bearish' && htfBias1h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish' && htfBias1h !== 'Bullish'

  let direction = null
  if (bullishTBS && htfAgreesBullish) direction = 'LONG'
  else if (bearishTBS && htfAgreesBearish) direction = 'SHORT'
  else return { noSignal: true }

  const entry = b3.close
  const buffer = atr * 0.3

  let sl, tp1, tp2, tp3
  if (direction === 'LONG') {
    sl = b2.low - buffer
    const risk = entry - sl
    tp1 = entry + risk * 1.5
    tp2 = rangeCandle.high
    tp3 = entry + risk * 3
  } else {
    sl = b2.high + buffer
    const risk = sl - entry
    tp1 = entry - risk * 1.5
    tp2 = rangeCandle.low
    tp3 = entry - risk * 3
  }

  if (![entry, sl, tp1, tp2, tp3].every(isFiniteNumber)) return { noSignal: true }

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
        ? 'একটি বড় Range Candle (CRT anchor) তৈরি হওয়ার পর দাম তার নিচের সীমা ভেঙে গিয়েছিল, কিন্তু Three Bar Setup-এর তৃতীয় ক্যান্ডেল আবার সেই রেঞ্জের ভেতরে ফিরে ক্লোজ করেছে — এটি লিকুইডিটি গ্র্যাব করে রিভার্সালের একটি শক্তিশালী সংকেত।'
        : 'একটি বড় Range Candle (CRT anchor) তৈরি হওয়ার পর দাম তার ওপরের সীমা ভেঙে গিয়েছিল, কিন্তু Three Bar Setup-এর তৃতীয় ক্যান্ডেল আবার সেই রেঞ্জের ভেতরে ফিরে ক্লোজ করেছে — এটি লিকুইডিটি গ্র্যাব করে রিভার্সালের একটি শক্তিশালী সংকেত।',
  }
                                       }
