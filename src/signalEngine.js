// signalEngine.js — 🔴 mode router + riskManager gatekeeper. This is the
// ONLY place that calls riskManager.js, and the ONLY place that converts a
// mode engine's raw price-based SL/TP into pips (via pipUtils.js) — keeping
// both in one place means all 5 modes handle pips and risk identically.
//
// 🔴 No indicator/hybrid branch exists here, and none should ever be added.

import { SIGNAL_MODES, FIXED_RISK_PERCENT } from './constants.js'
import { priceDeltaToPips, buildPositionSizing } from './pipUtils.js'
import { riskGate } from './riskManager.js'
import { getHtfBias } from './smartMoney.js'

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
  const rr = slPips > 0 ? Math.min(tp1Pips, tp2Pips, tp3Pips) / slPips : 0

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
  const positionSizing = buildPositionSizing({
    accountBalance,
    riskPercent: FIXED_RISK_PERCENT,
    pairTdSymbol: market.td,
    currentPrice,
    slDistancePips: slPips,
    tp1Pips,
    tp2Pips,
    tp3Pips,
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
