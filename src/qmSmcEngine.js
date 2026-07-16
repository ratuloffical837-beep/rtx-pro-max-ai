// qmSmcEngine.js — Mode 4: QM + SMC.
// Quasimodo (QM) pattern: a failed higher-high/lower-low that breaks the
// prior opposite swing, signaling exhaustion — confirmed with SMC Order
// Block + FVG confluence.

import { findSwings, calcATR, detectOrderBlock, detectFVG, isFiniteNumber } from './smartMoney.js'

const LTF_KEY = '15m'
const CONFIRM_KEY = '5m'

export function runQmSmc({ timeframes, htfBias4h, htfBias1h }) {
  const ltf = timeframes[LTF_KEY]
  const confirm = timeframes[CONFIRM_KEY]

  if (!ltf || ltf.length < 30) return { noSignal: true }

  const atr = calcATR(ltf, 14)
  if (!atr) return { noSignal: true }

  const { swingHighs, swingLows } = findSwings(ltf, 2)
  if (swingHighs.length < 3 || swingLows.length < 3) return { noSignal: true }

  const lastClose = ltf[ltf.length - 1].close

  // Bullish QM: left shoulder low -> lower low (the "head", a liquidity
  // grab) -> price then breaks back above the swing high between them
  // (the "Quasimodo" neckline break).
  const [lowA, lowB, lowC] = swingLows.slice(-3)
  const midHighs = swingHighs.filter((h) => h.index > lowA.index && h.index < lowC.index)
  const neckline = midHighs.length ? midHighs[midHighs.length - 1] : null

  const bullishQM = lowB.price < lowA.price && lowC.price > lowB.price && neckline && lastClose > neckline.price

  // Bearish QM: mirror — left shoulder high -> higher high (head) -> break
  // back below the swing low between them.
  const [highA, highB, highC] = swingHighs.slice(-3)
  const midLows = swingLows.filter((l) => l.index > highA.index && l.index < highC.index)
  const necklineBear = midLows.length ? midLows[midLows.length - 1] : null

  const bearishQM = highB.price > highA.price && highC.price < highB.price && necklineBear && lastClose < necklineBear.price

  const htfAgreesBullish = htfBias4h !== 'Bearish' && htfBias1h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish' && htfBias1h !== 'Bullish'

  let direction = null
  if (bullishQM && htfAgreesBullish) direction = 'LONG'
  else if (bearishQM && htfAgreesBearish) direction = 'SHORT'
  else return { noSignal: true }

  const orderBlock = detectOrderBlock(ltf, direction)
  const fvgs = detectFVG(ltf.slice(-15))
  const relevantFvg = fvgs.find((g) => (direction === 'LONG' ? g.type === 'bullish' : g.type === 'bearish'))

  // SMC confluence requirement — common rule #1, no signal without confluence.
  if (!orderBlock && !relevantFvg) return { noSignal: true }

  const entry = lastClose
  const buffer = atr * 0.3
  const headLevel = direction === 'LONG' ? lowB.price : highB.price

  let sl, tp1, tp2, tp3
  if (direction === 'LONG') {
    sl = headLevel - buffer
    const risk = entry - sl
    tp1 = entry + risk * 1.5
    tp2 = swingHighs[swingHighs.length - 1].price
    tp3 = entry + risk * 3
  } else {
    sl = headLevel + buffer
    const risk = sl - entry
    tp1 = entry - risk * 1.5
    tp2 = swingLows[swingLows.length - 1].price
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
    strength: orderBlock && relevantFvg ? 'Strong' : 'Moderate',
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    bias15m: direction === 'LONG' ? 'Bullish' : 'Bearish',
    bias5m,
    pattern: direction === 'LONG' ? 'Bullish Quasimodo + SMC Confluence' : 'Bearish Quasimodo + SMC Confluence',
    quickStats: [
      { label: 'Neckline', value: (direction === 'LONG' ? neckline.price : necklineBear.price).toFixed(5) },
      { label: 'Order Block', value: orderBlock ? 'Found' : 'None' },
      { label: 'FVG', value: relevantFvg ? 'Found' : 'None' },
    ],
    structure: [
      { label: 'Head Level', value: headLevel.toFixed(5) },
      { label: 'Confluence Score', value: `${(orderBlock ? 1 : 0) + (relevantFvg ? 1 : 0)}/2` },
    ],
    detail:
      direction === 'LONG'
        ? 'দাম একটি lower-low (Quasimodo head) তৈরি করে একটি লিকুইডিটি গ্র্যাব করেছিল, তারপর মাঝের swing high (neckline) ভেঙে বাইরে চলে এসেছে — এই মুভের সাথে একটি SMC Order Block/FVG কনফ্লুয়েন্স মিলেছে, যা রিভার্সালকে শক্তিশালী করে।'
        : 'দাম একটি higher-high (Quasimodo head) তৈরি করে একটি লিকুইডিটি গ্র্যাব করেছিল, তারপর মাঝের swing low (neckline) ভেঙে নিচে চলে এসেছে — এই মুভের সাথে একটি SMC Order Block/FVG কনফ্লুয়েন্স মিলেছে, যা রিভার্সালকে শক্তিশালী করে।',
  }
    }
