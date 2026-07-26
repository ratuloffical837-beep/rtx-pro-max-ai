// signalEngine.js — 🔴 mode router + riskManager gatekeeper. This is the
// ONLY place that calls riskManager.js, and the ONLY place that converts a
// mode engine's raw price-based SL/TP into pips (via pipUtils.js) — keeping
// both in one place means all 5 modes handle pips and risk identically.
//
// 🔴 No indicator/hybrid branch exists here, and none should ever be added.
//
// ── FIXES IN THIS VERSION ───────────────────────────────────────────────
// 1. 🔴 THE "NO SIGNAL EVER" BUG: the R:R gate used
//    Math.min(tp1Pips, tp2Pips, tp3Pips) / slPips. Every mode engine sets
//    tp1 at exactly risk*1.5 by design, but tp2 is a STRUCTURE level (swing
//    high/low, range boundary, neckline, fib level) that has no relationship
//    to risk distance — it's very often closer than 1.5R. That meant
//    Math.min() almost always landed on tp2Pips, which routinely came out
//    below 1.5, so riskGate discarded nearly every valid pattern as
//    "R:R below 1:1.5" and the app showed "no signal" on almost every
//    generation. The R:R gate must only ever judge the risk-defined target
//    (tp1), never a structure-defined one.
// 2. 🔴 Cross pairs with neither leg in USD (EUR/GBP, GBP/AUD, EUR/JPY,
//    etc. — about 30 of the 50 listed pairs) need `quoteToUsdRate` to
//    compute pip value, per pipUtils.js's own documented contract. No file
//    anywhere ever fetched it, so buildPositionSizing() always returned
//    null for these pairs and the Position Sizing box silently never
//    appeared, wrongly suggesting the person hadn't set a balance. This
//    version fetches that rate on demand (one lightweight extra price call)
//    and caches it for the session, exactly as pipUtils.js's comment
//    intended but nothing implemented before.

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
// re-fetching the same rate (e.g. GBP/USD) on every single signal
// generation for every GBP-cross pair in one sitting. Cleared on page
// reload, which is fine since rates drift and a fresh session should refresh.
const quoteToUsdCache = new Map()

// Resolves how many USD one unit of `quoteCurrency` is worth, for pairs
// where neither leg is USD (e.g. EUR/GBP → quoteCurrency = 'GBP').
// Tries QUOTE/USD first (direct rate); if Twelve Data rejects that symbol,
// falls back to USD/QUOTE and inverts it.
async function getQuoteToUsdRate(quoteCurrency) {
  if (quoteCurrency === 'USD') return 1 // shouldn't normally be called in this case, but safe

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

  // Common rule #2: HTF (4h/1h) bias can never be ignored — computed once
  // here and handed to every mode engine so none of them can skip it.
  const htfBias4h = timeframes['4h'] ? getHtfBias(timeframes['4h']) : 'Neutral'
  const htfBias1h = timeframes['1h'] ? getHtfBias(timeframes['1h']) : 'Neutral'

  // Common rule #1: no signal without confluence — if either HTF timeframe
  // is missing entirely (discarded for <30 candles upstream), there isn't
  // enough data for a confluence-based decision.
  if (!timeframes['4h'] || !timeframes['1h']) {
    return { noSignal: true }
  }

  // Raw signal from the mode engine — still in raw price units internally.
  const raw = runner({ timeframes, htfBias4h, htfBias1h })

  // Common rule #3: below minimum confidence threshold → no forced signal.
  if (!raw || raw.noSignal) {
    return { noSignal: true }
  }

  // Common rule #4: NaN/Infinity guard — bad calculations are discarded.
  const rawNumbers = [raw.entry, raw.sl, raw.tp1, raw.tp2, raw.tp3]
  if (rawNumbers.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
    return { noSignal: true }
  }

  // Pip conversion — the ONLY place this happens (#12.1's "do not convert to
  // pips inside each mode engine" rule).
  const slPips = priceDeltaToPips(raw.entry - raw.sl, market.td)
  const tp1Pips = priceDeltaToPips(raw.tp1 - raw.entry, market.td)
  const tp2Pips = priceDeltaToPips(raw.tp2 - raw.entry, market.td)
  const tp3Pips = priceDeltaToPips(raw.tp3 - raw.entry, market.td)

  // 🔴 THE FIX: R:R must be judged against tp1 — the risk-defined target
  // every mode engine builds at exactly 1.5x the SL distance — never against
  // tp2/tp3, which are structure-defined levels with no fixed relationship
  // to risk. Using Math.min() across all three meant tp2's structure
  // distance (often < 1.5R) was silently vetoing almost every real signal.
  const rr = slPips > 0 ? tp1Pips / slPips : 0

  // 🔴 The single riskManager.js gatekeeper call.
  const gate = riskGate({
    candles: timeframes['5m'] || timeframes['15m'] || timeframes['1h'],
    slPips,
    category: market.cat,
    rr,
  })

  if (gate.blocked && gate.reason?.includes('discarded')) {
    // Discarded outright (SL too tight or R:R too low) — no signal at all,
    // not even a blocked one to display.
    return { noSignal: true }
  }

  let accountBalance = null
  try {
    const stored = localStorage.getItem('rtx_account_balance')
    accountBalance = stored ? parseFloat(stored) : null
  } catch (e) {
    console.error('signalEngine: failed to read account balance:', e.message)
  }

  const currentPrice = raw.entry

  // 🔴 THE FIX: resolve quoteToUsdRate for cross pairs where neither leg is
  // USD, so buildPositionSizing() can actually compute a pip value instead
  // of silently returning null. Majors/USD-pairs don't need this — the pip
  // value math in pipUtils.js handles those without an extra rate.
  const [, quoteCurrency] = market.td.split('/')
  let quoteToUsdRate = null
  const needsQuoteRate = quoteCurrency && quoteCurrency !== 'USD' && !market.td.startsWith('USD/')

  if (needsQuoteRate && accountBalance) {
    // Only bother with the extra network call if the person has actually
    // set a balance — otherwise buildPositionSizing() would return null
    // anyway and the fetch would be wasted.
    try {
      quoteToUsdRate = await getQuoteToUsdRate(quoteCurrency)
    } catch (e) {
      console.error('signalEngine: quoteToUsdRate resolution failed:', e.message)
      quoteToUsdRate = null
    }
  }

  const positionSizing = buildPositionSizing({
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
    blocked: gate.blocked, // spread/volatility block — advisory badge, signal still shown
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
