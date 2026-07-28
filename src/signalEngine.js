// signalEngine.js — mode router + riskManager gatekeeper
// ✅ FINAL FINAL:
// - HTF fallback: if 4h missing but 1h available, use 1h as bias
// - If both missing, use Neutral and let engine decide
// - This makes signals possible even with partial data

import { SIGNAL_MODES, FIXED_RISK_PERCENT } from './constants.js'
import { priceDeltaToPips, buildPositionSizing } from './pipUtils.js'
import { riskGate } from './riskManager.js'
import { getHtfBias } from './smartMoney.js'
import { fetchLivePrice } from './twelveDataClient.js'

import { runSweepReclaim } from './sweepReclaim.js'
import { runCrtTbs } from './crtTbsEngine.js'
import { runWyckoffIct } from './wyckoffIctEngine.js'
import { runQmSmc } from './qmSmcEngine.js'
import { runPriceActionFib } from './priceActionFibEngine.js'

const MODE_RUNNERS = {
  sweep: runSweepReclaim,
  crt_tbs: runCrtTbs,
  wyckoff_ict: runWyckoffIct,
  qm_smc: runQmSmc,
  price_action_fib: runPriceActionFib,
}

const quoteToUsdCache = new Map()

async function getQuoteToUsdRate(quoteCurrency) {
  if (quoteCurrency === 'USD') return 1
  if (quoteToUsdCache.has(quoteCurrency)) return quoteToUsdCache.get(quoteCurrency)

  let rate = null
  try {
    rate = await fetchLivePrice(`${quoteCurrency}/USD`)
  } catch (e) {
    try {
      const inverse = await fetchLivePrice(`USD/${quoteCurrency}`)
      rate = inverse ? 1 / inverse : null
    } catch (e2) {
      rate = null
    }
  }

  if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
    quoteToUsdCache.set(quoteCurrency, rate)
    return rate
  }
  return null
}

export async function generateSignal({ modeId, market, timeframes }) {
  const runner = MODE_RUNNERS[modeId]
  if (!runner) throw new Error(`Unknown signal mode: ${modeId}`)

  if (!market || !market.td || !market.td.includes('/')) {
    return {
      noSignal: true,
      debugReason: 'Invalid market object.',
    }
  }

  const modeMeta = SIGNAL_MODES.find((m) => m.id === modeId)
  const debugTag = `[signalEngine:${modeId}:${market?.name}]`

  const has4h = Array.isArray(timeframes['4h']) && timeframes['4h'].length >= 30
  const has1h = Array.isArray(timeframes['1h']) && timeframes['1h'].length >= 30
  const has15m = Array.isArray(timeframes['15m']) && timeframes['15m'].length >= 30

  // ✅ 15m is the ONLY hard requirement
  if (!has15m) {
    const reason = '15m ক্যান্ডেল ডেটা পাওয়া যায়নি — API rate limit বা connection সমস্যা।'
    console.log(`${debugTag} noSignal:`, reason)
    return { noSignal: true, debugReason: reason }
  }

  // ✅ HTF bias with graceful fallback
  let htfBias4h = 'Neutral'
  let htfBias1h = 'Neutral'

  if (has4h) htfBias4h = getHtfBias(timeframes['4h'])
  if (has1h) htfBias1h = getHtfBias(timeframes['1h'])

  // If 4h missing, use 1h as substitute
  if (!has4h && has1h) {
    htfBias4h = htfBias1h
    console.log(`${debugTag} ⚠️ 4h missing — using 1h bias as fallback`)
  }
  // If both missing, both are Neutral (engine won't block on Neutral)
  if (!has4h && !has1h) {
    console.log(`${debugTag} ⚠️ Both HTF missing — using Neutral bias`)
  }

  const raw = runner({ timeframes, htfBias4h, htfBias1h })

  if (!raw || raw.noSignal) {
    const reason = `"${modeMeta?.name || modeId}" মোডের প্যাটার্ন এই মুহূর্তে মেলেনি। অন্য mode চেষ্টা করুন।`
    console.log(`${debugTag} noSignal:`, reason)
    return { noSignal: true, debugReason: reason }
  }

  const rawNumbers = [raw.entry, raw.sl, raw.tp1, raw.tp2, raw.tp3]
  if (rawNumbers.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
    return { noSignal: true, debugReason: 'NaN/Infinity in calculation.' }
  }

  // Final TP order validation
  if (raw.direction === 'LONG') {
    if (!(raw.tp1 < raw.tp2 && raw.tp2 < raw.tp3 && raw.tp1 > raw.entry)) {
      return { noSignal: true, debugReason: 'TP order invalid for LONG' }
    }
    if (raw.sl >= raw.entry) {
      return { noSignal: true, debugReason: 'SL wrong side for LONG' }
    }
  } else if (raw.direction === 'SHORT') {
    if (!(raw.tp1 > raw.tp2 && raw.tp2 > raw.tp3 && raw.tp1 < raw.entry)) {
      return { noSignal: true, debugReason: 'TP order invalid for SHORT' }
    }
    if (raw.sl <= raw.entry) {
      return { noSignal: true, debugReason: 'SL wrong side for SHORT' }
    }
  }

  const slPips = priceDeltaToPips(Math.abs(raw.entry - raw.sl), market.td)
  const tp1Pips = priceDeltaToPips(Math.abs(raw.tp1 - raw.entry), market.td)
  const tp2Pips = priceDeltaToPips(Math.abs(raw.tp2 - raw.entry), market.td)
  const tp3Pips = priceDeltaToPips(Math.abs(raw.tp3 - raw.entry), market.td)

  if (slPips === 0) {
    return { noSignal: true, debugReason: 'SL distance is 0 pips.' }
  }

  const rr = tp1Pips / slPips

  const gate = riskGate({
    candles: timeframes['5m'] || timeframes['15m'] || timeframes['1h'],
    slPips,
    category: market.cat,
    rr,
  })

  if (gate.blocked) {
    const reason = `riskGate: ${gate.reason} (SL: ${slPips.toFixed(1)} pips, R:R: 1:${rr.toFixed(2)})`
    console.log(`${debugTag} noSignal:`, reason)
    return { noSignal: true, debugReason: reason }
  }

  let accountBalance = null
  try {
    const stored = localStorage.getItem('rtx_account_balance')
    accountBalance = stored ? parseFloat(stored) : null
  } catch (e) {}

  const currentPrice = raw.entry
  const [, quoteCurrency] = market.td.split('/')
  let quoteToUsdRate = null
  const needsQuoteRate =
    quoteCurrency && quoteCurrency !== 'USD' && !market.td.startsWith('USD/')

  if (needsQuoteRate && accountBalance) {
    try {
      quoteToUsdRate = await getQuoteToUsdRate(quoteCurrency)
    } catch (e) {}
  }

  let positionSizing = null
  try {
    positionSizing = buildPositionSizing({
      accountBalance,
      riskPercent: FIXED_RISK_PERCENT,
      pairTdSymbol: market.td,
      currentPrice,
      slDistancePips: slPips,
      tp1Pips,
      tp2Pips,
      tp3Pips,
      quoteToUsdRate,
    })
  } catch (e) {}

  console.log(`${debugTag} ✅ signal generated`, {
    direction: raw.direction,
    rr: rr.toFixed(2),
    slPips: slPips.toFixed(1),
  })

  return {
    direction: raw.direction,
    modeName: modeMeta?.name || modeId,
    modeColor: modeMeta?.color,
    strength: raw.strength || 'Moderate',
    pair: market,
    entry: raw.entry,
    tp1: { price: raw.tp1, pips: tp1Pips },
    tp2: { price: raw.tp2, pips: tp2Pips },
    tp3: { price: raw.tp3, pips: tp3Pips },
    sl: { price: raw.sl, pips: slPips },
    rr,
    blocked: gate.blocked,
    blockReason: gate.reason,
    quickStats: raw.quickStats || [],
    structure: raw.structure || [],
    mtfBias: {
      '4h': htfBias4h,
      '1h': htfBias1h,
      '15m': raw.bias15m || 'Neutral',
      '5m': raw.bias5m || 'Neutral',
    },
    pattern: raw.pattern || null,
    detail: raw.detail || null,
    positionSizing,
  }
  }
