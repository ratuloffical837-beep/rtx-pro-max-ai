// qmSmcEngine.js — Mode 4: QM + SMC
// ✅ FINAL VERSION:
// - TP order enforced
// - TP2 fallback if swing extreme invalid
// - neckline null-safe
// - buffer atr*0.5
// - HTF 4h primary only

import {
  findSwings,
  calcATR,
  detectOrderBlock,
  detectFVG,
  isFiniteNumber,
} from './smartMoney.js'

const LTF_KEY = '15m'
const CONFIRM_KEY = '5m'
const FVG_LOOKBACK = 20

export function runQmSmc({ timeframes, htfBias4h, htfBias1h }) {
  const ltf = timeframes[LTF_KEY]
  const confirm = timeframes[CONFIRM_KEY]

  if (!ltf || ltf.length < 30) return { noSignal: true }

  const atr = calcATR(ltf, 14)
  if (!atr) return { noSignal: true }

  const { swingHighs, swingLows } = findSwings(ltf, 2)
  if (swingHighs.length < 3 || swingLows.length < 3) return { noSignal: true }

  const lastClose = ltf[ltf.length - 1].close

  const [lowA, lowB, lowC] = swingLows.slice(-3)
  const midHighs = swingHighs.filter(
    (h) => h.index > lowA.index && h.index < lowC.index
  )
  const neckline = midHighs.length ? midHighs[midHighs.length - 1] : null

  const bullishQM =
    lowB.price < lowA.price &&
    lowC.price > lowB.price &&
    neckline !== null &&
    lastClose > neckline.price

  const [highA, highB, highC] = swingHighs.slice(-3)
  const midLows = swingLows.filter(
    (l) => l.index > highA.index && l.index < highC.index
  )
  const necklineBear = midLows.length ? midLows[midLows.length - 1] : null

  const bearishQM =
    highB.price > highA.price &&
    highC.price < highB.price &&
    necklineBear !== null &&
    lastClose < necklineBear.price

  const htfAgreesBullish = htfBias4h !== 'Bearish'
  const htfAgreesBearish = htfBias4h !== 'Bullish'

  let direction = null
  if (bullishQM && htfAgreesBullish) direction = 'LONG'
  else if (bearishQM && htfAgreesBearish) direction = 'SHORT'
  else return { noSignal: true }

  const orderBlock = detectOrderBlock(ltf, direction)
  const fvgs = detectFVG(ltf.slice(-FVG_LOOKBACK))
  const relevantFvg = fvgs.find((g) =>
    direction === 'LONG' ? g.type === 'bullish' : g.type === 'bearish'
  )

  if (!orderBlock && !relevantFvg) return { noSignal: true }

  const entry = lastClose
  const buffer = atr * 0.5
  const headLevel = direction === 'LONG' ? lowB.price : highB.price

  let sl, tp1, tp2, tp3
  if (direction === 'LONG') {
    sl = headLevel - buffer
    const risk = entry - sl
    if (risk <= 0) return { noSignal: true }

    tp1 = entry + risk * 1.5
    tp3 = entry + risk * 3
    const swingTarget = swingHighs[swingHighs.length - 1].price
    tp2 = swingTarget > tp1 && swingTarget < tp3
      ? swingTarget
      : entry + risk * 2.25
  } else {
    sl = headLevel + buffer
    const risk = sl - entry
    if (risk <= 0) return { noSignal: true }

    tp1 = entry - risk * 1.5
    tp3 = entry - risk * 3
    const swingTarget = swingLows[swingLows.length - 1].price
    tp2 = swingTarget < tp1 && swingTarget > tp3
      ? swingTarget
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

  const necklineDisplay =
    direction === 'LONG'
      ? neckline?.price?.toFixed(5) ?? 'N/A'
      : necklineBear?.price?.toFixed(5) ?? 'N/A'

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
    pattern:
      direction === 'LONG'
        ? 'Bullish Quasimodo + SMC Confluence'
        : 'Bearish Quasimodo + SMC Confluence',
    quickStats: [
      { label: 'Neckline', value: necklineDisplay },
      { label: 'Order Block', value: orderBlock ? 'Found' : 'None' },
      { label: 'FVG', value: relevantFvg ? 'Found' : 'None' },
    ],
    structure: [
      { label: 'Head Level', value: headLevel.toFixed(5) },
      {
        label: 'Confluence Score',
        value: `${(orderBlock ? 1 : 0) + (relevantFvg ? 1 : 0)}/2`,
      },
    ],
    detail:
      direction === 'LONG'
        ? 'দাম একটি lower-low (Quasimodo head) তৈরি করে একটি লিকুইডিটি গ্র্যাব করেছিল, তারপর মাঝের swing high (neckline) ভেঙে বাইরে চলে এসেছে — SMC Order Block/FVG কনফ্লুয়েন্স মিলেছে।'
        : 'দাম একটি higher-high (Quasimodo head) তৈরি করে একটি লিকুইডিটি গ্র্যাব করেছিল, তারপর মাঝের swing low (neckline) ভেঙে নিচে চলে এসেছে — SMC Order Block/FVG কনফ্লুয়েন্স মিলেছে।',
  }
                    }
