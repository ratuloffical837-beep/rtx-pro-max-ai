// pipUtils.js — 🔴 exact pip math, do not approximate.
//
// ── FIX IN THIS VERSION ─────────────────────────────────────────────────
// 🔴 EXOTIC PIP SIZE BUG: HUF and CZK are large-nominal-value currencies
// (like JPY) that trade with 2-3 decimal precision, not the standard
// 4-decimal precision of majors/most crosses. Before this fix, getPipSize()
// only special-cased JPY and treated every other pair — including
// USD/HUF, EUR/HUF, USD/CZK — as a standard 0.0001-pip pair. Since HUF/CZK
// actually move in units closer to JPY's scale (e.g. USD/HUF trades around
// 350-380, not 1.xxxx), using 0.0001 as the pip size would make
// priceDeltaToPips() report a pip count roughly 100x too large, which
// cascades into wildly wrong SL-floor checks, R:R math, and position sizing
// for these two pairs specifically.

// JPY, HUF, and CZK are large-nominal-value currencies quoted with 2-3
// decimal precision — pip = 0.01. Everything else uses standard 4-decimal
// pricing — pip = 0.0001.
export function getPipSize(pairTdSymbol) {
  const sym = pairTdSymbol ? pairTdSymbol.toUpperCase() : ''
  if (sym.includes('JPY') || sym.includes('HUF') || sym.includes('CZK')) return 0.01
  return 0.0001
}

export function priceDeltaToPips(priceDelta, pairTdSymbol) {
  const pip = getPipSize(pairTdSymbol)
  return Math.abs(priceDelta) / pip
}

export function pipsToPriceDelta(pips, pairTdSymbol) {
  const pip = getPipSize(pairTdSymbol)
  return pips * pip
}

// Pip value in USD, per 1 standard lot (100,000 units of base currency).
// currentPrice = the pair's current price (needed when USD is not the quote currency).
// quoteToUsdRate = only needed for cross pairs where USD is neither base nor quote
//   (e.g. EUR/GBP) — fetched on demand by signalEngine.js and cached for the session.
export function pipValuePerStandardLot(pairTdSymbol, currentPrice, quoteToUsdRate = null) {
  const pip = getPipSize(pairTdSymbol)
  const [base, quote] = pairTdSymbol.split('/')
  const STANDARD_LOT_UNITS = 100000

  if (!base || !quote) return null

  if (quote === 'USD') {
    // e.g. EUR/USD — pip value is fixed in USD regardless of price
    return pip * STANDARD_LOT_UNITS
  }
  if (base === 'USD') {
    // e.g. USD/JPY, USD/HUF, USD/CZK — pip value depends on the current price
    if (!currentPrice) return null
    return (pip * STANDARD_LOT_UNITS) / currentPrice
  }
  // Cross pair with neither leg in USD (e.g. EUR/GBP) — needs the quote
  // currency's USD rate.
  if (quoteToUsdRate) {
    return pip * STANDARD_LOT_UNITS * quoteToUsdRate
  }
  return null // caller must fetch quoteToUsdRate first
}

export function suggestedLotSize(riskAmountUsd, slDistancePips, pipValueUsd) {
  if (!riskAmountUsd || !slDistancePips || !pipValueUsd) return null
  const lots = riskAmountUsd / (slDistancePips * pipValueUsd)
  return Math.max(Math.round(lots * 100) / 100, 0.01) // round to 0.01 lot steps, minimum micro-lot
}

// Convenience wrapper used by signalEngine.js to build the full
// `positionSizing` object consumed by SignalCard.jsx. Returns null if the
// account balance isn't set yet — caller/UI shows the "add your balance"
// prompt in that case instead of numbers.
export function buildPositionSizing({
  accountBalance,
  riskPercent,
  pairTdSymbol,
  currentPrice,
  slDistancePips,
  tp1Pips,
  tp2Pips,
  tp3Pips,
  quoteToUsdRate = null,
}) {
  if (!accountBalance || accountBalance <= 0) return null

  const pipValueUsd = pipValuePerStandardLot(pairTdSymbol, currentPrice, quoteToUsdRate)
  if (!pipValueUsd) return null

  const riskAmountUsd = Math.round(accountBalance * riskPercent * 100) / 100
  const lotSize = suggestedLotSize(riskAmountUsd, slDistancePips, pipValueUsd)
  if (!lotSize) return null

  const profitFor = (pips, portion) =>
    Math.round(lotSize * pips * pipValueUsd * portion * 100) / 100

  return {
    lotSize,
    riskAmountUsd,
    riskPercent,
    potentialLossUsd: riskAmountUsd,
    tp1ProfitUsd: profitFor(tp1Pips, 0.5),
    tp2ProfitUsd: profitFor(tp2Pips, 0.3),
    tp3ProfitUsd: profitFor(tp3Pips, 0.2),
  }
  }
