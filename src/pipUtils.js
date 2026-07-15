// pipUtils.js — 🔴 exact pip math, do not approximate.

// JPY-quoted pairs use 2-decimal pricing (pip = 0.01); everything else uses
// 4-decimal pricing (pip = 0.0001).
// Note: a handful of exotics (HUF, CZK) technically have different natural
// decimal conventions on some feeds — this is a known approximation, flagged
// here rather than silently treated as exact.
export function getPipSize(pairTdSymbol) {
  return pairTdSymbol.includes('JPY') ? 0.01 : 0.0001
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
//   (e.g. EUR/GBP) — fetch this as ONE extra lightweight price call, on demand, only
//   when the user opens the position-sizing box for such a pair. Cache it for the session.
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
    // e.g. USD/JPY — pip value depends on the current price
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
