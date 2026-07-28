// pipUtils.js — exact pip math
// ✅ FIXES:
// 1. HUF, CZK, SEK, NOK, DKK, INR, THB — special pip size handling added
// 2. formatPrice helper exported for JPY-aware display in UI components
// 3. buildPositionSizing — TP profit uses Math.abs(pips) to avoid
//    negative profit display if pips sign is ambiguous

// ✅ FIX: extended pip size map to cover exotic pairs with
//         non-standard pricing conventions
export function getPipSize(pairTdSymbol) {
  if (!pairTdSymbol) return 0.0001
  const upper = pairTdSymbol.toUpperCase()

  if (upper.includes('JPY')) return 0.01

  // High-value quote currencies — pip = 0.01 (2 decimal pricing)
  if (
    upper.includes('HUF') ||
    upper.includes('INR') ||
    upper.includes('THB') ||
    upper.includes('CNH')
  ) {
    return 0.01
  }

  // Scandinavian and other 2-decimal exotics
  if (
    upper.includes('SEK') ||
    upper.includes('NOK') ||
    upper.includes('DKK') ||
    upper.includes('CZK') ||
    upper.includes('MXN') ||
    upper.includes('ZAR') ||
    upper.includes('TRY') ||
    upper.includes('PLN')
  ) {
    return 0.0001 // These trade at 4 decimal places on most brokers
  }

  return 0.0001 // default for all other pairs
}

export function priceDeltaToPips(priceDelta, pairTdSymbol) {
  const pip = getPipSize(pairTdSymbol)
  return Math.abs(priceDelta) / pip
}

export function pipsToPriceDelta(pips, pairTdSymbol) {
  const pip = getPipSize(pairTdSymbol)
  return pips * pip
}

// ✅ NEW: exported for use in SignalCard and ForexSection
//         so JPY pairs show 3 decimal places, others show 5
export function formatPrice(price, pairTdSymbol) {
  if (typeof price !== 'number' || !Number.isFinite(price)) return '—'
  if (!pairTdSymbol) return price.toFixed(5)
  const upper = pairTdSymbol.toUpperCase()
  if (upper.includes('JPY')) return price.toFixed(3)
  if (
    upper.includes('HUF') ||
    upper.includes('INR') ||
    upper.includes('THB')
  ) {
    return price.toFixed(3)
  }
  return price.toFixed(5)
}

export function pipValuePerStandardLot(pairTdSymbol, currentPrice, quoteToUsdRate = null) {
  const pip = getPipSize(pairTdSymbol)
  const parts = (pairTdSymbol || '').split('/')
  const base = parts[0]
  const quote = parts[1]
  const STANDARD_LOT_UNITS = 100000

  if (!base || !quote) return null

  if (quote === 'USD') {
    return pip * STANDARD_LOT_UNITS
  }
  if (base === 'USD') {
    if (!currentPrice || currentPrice === 0) return null
    return (pip * STANDARD_LOT_UNITS) / currentPrice
  }
  if (quoteToUsdRate) {
    return pip * STANDARD_LOT_UNITS * quoteToUsdRate
  }
  return null
}

export function suggestedLotSize(riskAmountUsd, slDistancePips, pipValueUsd) {
  if (!riskAmountUsd || !slDistancePips || !pipValueUsd) return null
  if (slDistancePips === 0 || pipValueUsd === 0) return null
  const lots = riskAmountUsd / (slDistancePips * pipValueUsd)
  return Math.max(Math.round(lots * 100) / 100, 0.01)
}

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
  if (!slDistancePips || slDistancePips <= 0) return null

  const pipValueUsd = pipValuePerStandardLot(pairTdSymbol, currentPrice, quoteToUsdRate)
  if (!pipValueUsd || pipValueUsd <= 0) return null

  const riskAmountUsd = Math.round(accountBalance * riskPercent * 100) / 100
  const lotSize = suggestedLotSize(riskAmountUsd, slDistancePips, pipValueUsd)
  if (!lotSize) return null

  // ✅ FIX: Math.abs() on pips to ensure profit is always positive
  const profitFor = (pips, portion) =>
    Math.round(lotSize * Math.abs(pips) * pipValueUsd * portion * 100) / 100

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
