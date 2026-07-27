// signalEngine.js — 🔴 mode router + riskManager gatekeeper. This is the
// ONLY place that calls riskManager.js, and the ONLY place that converts a
// mode engine's raw price-based SL/TP into pips (via pipUtils.js) — keeping
// both in one place means all 5 modes handle pips and risk identically.
//
// 🔴 No indicator/hybrid branch exists here, and none should ever be added.
//
// ── FIXES IN THIS VERSION (re-audited) ──────────────────────────────────
// 1. R:R gate uses ONLY tp1Pips/slPips (the risk-defined target every mode
//    engine builds at exactly 1.5x the SL distance) — never tp2/tp3, which
//    are structure-defined levels with no fixed relationship to risk.
// 2. Cross pairs with neither leg in USD now get a real quoteToUsdRate,
//    fetched on demand and cached for the session, wrapped in try/catch so
//    a failed rate lookup degrades to "no position sizing shown" instead of
//    breaking signal generation entirely.
// 3. 🆕 DEBUG LOGGING — every time a signal is discarded (noSignal), the
//    browser console now logs WHY (which gate failed, the actual slPips/rr
//    numbers) instead of the app just silently showing "no signal" with no
//    way to tell whether that's a real absence of a pattern or a gate
//    tuning issue. Open DevTools → Console on the phone (or via remote
//    debugging) after tapping Generate to see these.
// 4. 🆕 KNOWN TUNING NOTE (documented, not silently hidden): the default
//    mode (Sweep Reclaim) places its SL only `atr * 0.3` beyond the swept
//    level, which on 15m candles for Major/Cross pairs is very often BELOW
//    the 8-pip minimum SL floor in riskManager.js. When that happens, the
//    signal is correctly discarded per the "never artificially widen SL"
//    rule — but if this fires on nearly every attempt, the fix is to widen
//    the ATR buffer multiplier inside sweepReclaim.js (and the other mode
//    engines) slightly, which is a separate, explicit change to that file —
//    not something this file should quietly work around.

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

// 🔴 In-memory session cache for cross-pair USD conversion rates — avoids
// re-fetching the same rate on every single signal generation for every
// same-quote-currency pair in one sitting. Cleared on page reload.
const quoteToUsdCache = new Map()

async function getQuoteToUsdRate(quoteCurrency) {
  if (quoteCurrency === 'USD') return 1

  if (quoteToUsdCache.has(quoteCurrency)) {
    return quoteToUsdCache.get(quoteCurrency)
  }

  let rate = null
  try {
    rate = await fetchLivePrice(`${quoteCurrency}/USD`)
  } catch (e) {
    console.error(`signalEngine: ${quoteCurrency}/USD fetch failed, trying inverse:`, e.message)
    try {
      const inverse = await fetchLivePrice(`USD/${quoteCurrency}`)
      rate = inverse ? 1 / inverse : null
    } catch (e2) {
      console.error(`signalEngine: USD/${quoteCurrency} fallback also failed:`, e2.message)
      rate = null
    }
  }

  if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
    quoteToUsdCache.set(quoteCurrency, rate)
    return rate
  }

  return null
}

// `market` = one entry from FOREX_MARKETS (#1.1), `timeframes` = the object
// returned by twelveDataClient.fetchAllTimeframes (keys: 4h/1h/15m/5m).
export async function generateSignal({ modeId, market, timeframes }) {
  const runner = MODE_RUNNERS[modeId]
  if (!runner) throw new Error(`Unknown signal mode: ${modeId}`)

  const modeMeta = SIGNAL_MODES.find((m) => m.id === modeId)
  const debugTag = `[signalEngine:${modeId}:${market?.name}]`

  // Common rule #2: HTF (4h/1h) bias can never be ignored.
  const htfBias4h = timeframes['4h'] ? getHtfBias(timeframes['4h']) : 'Neutral'
  const htfBias1h = timeframes['1h'] ? getHtfBias(timeframes['1h']) : 'Neutral'

  // Common rule #1: no signal without confluence.
  if (!timeframes['4h'] || !timeframes['1h']) {
    const reason = 'HTF ডেটা মিসিং: 4h বা 1h টাইমফ্রেমে যথেষ্ট ক্যান্ডেল (৩০+) পাওয়া যায়নি — Twelve Data থেকে ডেটা আসেনি বা ৩০টার কম এসেছে।'
    console.log(`${debugTag} noSignal:`, reason)
    return { noSignal: true, debugReason: reason }
  }

  const raw = runner({ timeframes, htfBias4h, htfBias1h })

  // Common rule #3: below minimum confidence threshold → no forced signal.
  if (!raw || raw.noSignal) {
    const reason = `"${modeMeta?.name || modeId}" মোডের প্যাটার্ন কন্ডিশন এই মুহূর্তে ১৫m ক্যান্ডেলে মেলেনি (অথবা HTF bias-এর সাথে দিক না মেলায় বাতিল হয়েছে)।`
    console.log(`${debugTag} noSignal:`, reason)
    return { noSignal: true, debugReason: reason }
  }

  // Common rule #4: NaN/Infinity guard.
  const rawNumbers = [raw.entry, raw.sl, raw.tp1, raw.tp2, raw.tp3]
  if (rawNumbers.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
    const reason = 'ক্যালকুলেশনে NaN/Infinity পাওয়া গেছে — raw মোড আউটপুট বাতিল করা হয়েছে।'
    console.log(`${debugTag} noSignal:`, reason, raw)
    return { noSignal: true, debugReason: reason }
  }

  // Pip conversion — the ONLY place this happens.
  const slPips = priceDeltaToPips(raw.entry - raw.sl, market.td)
  const tp1Pips = priceDeltaToPips(raw.tp1 - raw.entry, market.td)
  const tp2Pips = priceDeltaToPips(raw.tp2 - raw.entry, market.td)
  const tp3Pips = priceDeltaToPips(raw.tp3 - raw.entry, market.td)

  // 🔴 R:R judged ONLY against tp1 (the risk-defined 1.5x target) — never
  // tp2/tp3, which are structure-defined and have no fixed R relationship.
  const rr = slPips > 0 ? tp1Pips / slPips : 0

  const gate = riskGate({
    candles: timeframes['5m'] || timeframes['15m'] || timeframes['1h'],
    slPips,
    category: market.cat,
    rr,
  })

  if (gate.blocked && gate.reason?.includes('discarded')) {
    // 🆕 This is the log line to check first whenever "no signal" shows up
    // repeatedly — it tells you exactly which gate failed and with what
    // numbers, instead of leaving it a mystery.
    const reason = `riskGate বাতিল করেছে: ${gate.reason} (SL দূরত্ব: ${slPips.toFixed(1)} pips, R:R: 1:${rr.toFixed(2)})`
    console.log(`${debugTag} noSignal:`, reason)
    return { noSignal: true, debugReason: reason }
  }

  let accountBalance = null
  try {
    const stored = localStorage.getItem('rtx_account_balance')
    accountBalance = stored ? parseFloat(stored) : null
  } catch (e) {
    console.error('signalEngine: failed to read account balance:', e.message)
  }

  const currentPrice = raw.entry

  // Cross-pair quoteToUsdRate — needed only when neither leg is USD.
  const [, quoteCurrency] = market.td.split('/')
  let quoteToUsdRate = null
  const needsQuoteRate = quoteCurrency && quoteCurrency !== 'USD' && !market.td.startsWith('USD/')

  if (needsQuoteRate && accountBalance) {
    try {
      quoteToUsdRate = await getQuoteToUsdRate(quoteCurrency)
    } catch (e) {
      // 🔴 Defensive: a failed rate lookup must never break signal
      // generation — it should only mean Position Sizing can't be shown.
      console.error('signalEngine: quoteToUsdRate resolution failed (non-fatal):', e.message)
      quoteToUsdRate = null
    }
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
  } catch (e) {
    console.error('signalEngine: buildPositionSizing threw (non-fatal, signal still shown):', e.message)
    positionSizing = null
  }

  console.log(`${debugTag} ✅ signal generated`, { direction: raw.direction, rr: rr.toFixed(2), slPips: slPips.toFixed(1) })

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
