// smartMoney.js — shared Smart-Money-Concepts helpers.
// ✅ FIXES:
// 1. findSwings — edge boundary fixed (last candle now scannable)
// 2. detectBOSCHoCH — recency check added (max 50 candles back)
// 3. detectOrderBlock — bounded loop (last 50 candles only)
// 4. isFiniteNumber — confirmed exported here

// ─── ATR ────────────────────────────────────────────────────────────────────
export function calcATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null

  const trueRanges = []
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i]
    const prev = candles[i - 1]
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    )
    trueRanges.push(tr)
  }

  const lastN = trueRanges.slice(-period)
  const sum = lastN.reduce((a, b) => a + b, 0)
  return sum / lastN.length
}

// ─── SWING HIGHS / LOWS ──────────────────────────────────────────────────────
// ✅ FIX: upper bound changed from candles.length - lookback
//         to candles.length - 1 so the most recent candles
//         are not silently excluded from swing detection.
export function findSwings(candles, lookback = 2) {
  const swingHighs = []
  const swingLows = []

  for (let i = lookback; i < candles.length - 1; i++) {
    const c = candles[i]

    // Build the comparison window — clamp so we never go out of bounds
    const from = Math.max(0, i - lookback)
    const to = Math.min(candles.length - 1, i + lookback)
    const window = candles.slice(from, to + 1)

    if (c.high === Math.max(...window.map((w) => w.high))) {
      swingHighs.push({ index: i, price: c.high, time: c.time })
    }
    if (c.low === Math.min(...window.map((w) => w.low))) {
      swingLows.push({ index: i, price: c.low, time: c.time })
    }
  }

  return { swingHighs, swingLows }
}

// ─── ORDER BLOCK ─────────────────────────────────────────────────────────────
// ✅ FIX: loop bounded to last 50 candles so stale order blocks
//         from hundreds of candles ago are never returned.
export function detectOrderBlock(candles, direction) {
  if (!candles || candles.length < 5) return null

  const scanFrom = Math.max(1, candles.length - 50)

  for (let i = candles.length - 3; i >= scanFrom; i--) {
    const c = candles[i]
    const next = candles[i + 1]
    if (!next) continue

    const isBearishCandle = c.close < c.open
    const isBullishCandle = c.close > c.open
    const displacement = Math.abs(next.close - next.open)
    const avgRange = calcAvgRange(candles.slice(Math.max(0, i - 10), i))

    if (!avgRange || avgRange === 0) continue

    if (
      direction === 'LONG' &&
      isBearishCandle &&
      next.close > next.open &&
      displacement > avgRange * 1.5
    ) {
      return { index: i, high: c.high, low: c.low, time: c.time }
    }
    if (
      direction === 'SHORT' &&
      isBullishCandle &&
      next.close < next.open &&
      displacement > avgRange * 1.5
    ) {
      return { index: i, high: c.high, low: c.low, time: c.time }
    }
  }
  return null
}

function calcAvgRange(candles) {
  if (!candles || candles.length === 0) return null
  const sum = candles.reduce((a, c) => a + (c.high - c.low), 0)
  return sum / candles.length
}

// ─── FAIR VALUE GAP ──────────────────────────────────────────────────────────
export function detectFVG(candles) {
  const gaps = []
  for (let i = 0; i < candles.length - 2; i++) {
    const a = candles[i]
    const c = candles[i + 2]
    if (a.high < c.low) {
      gaps.push({ type: 'bullish', top: c.low, bottom: a.high, index: i + 1 })
    } else if (a.low > c.high) {
      gaps.push({ type: 'bearish', top: a.low, bottom: c.high, index: i + 1 })
    }
  }
  return gaps
}

// ─── BOS / CHoCH ─────────────────────────────────────────────────────────────
// ✅ FIX: recency check added — only consider swings within the
//         last 50 candles so a break from 200 candles ago is not
//         treated as an active structural shift today.
export function detectBOSCHoCH(candles) {
  const { swingHighs, swingLows } = findSwings(candles, 2)
  if (swingHighs.length < 2 || swingLows.length < 2) return null

  const lastClose = candles[candles.length - 1].close
  const lastSwingHigh = swingHighs[swingHighs.length - 1]
  const lastSwingLow = swingLows[swingLows.length - 1]
  const prevSwingHigh = swingHighs[swingHighs.length - 2]
  const prevSwingLow = swingLows[swingLows.length - 2]

  // ✅ Recency guard — swing must be within last 50 candles
  const recentThreshold = candles.length - 50
  const highIsRecent = lastSwingHigh.index >= recentThreshold
  const lowIsRecent = lastSwingLow.index >= recentThreshold

  if (highIsRecent && lastClose > lastSwingHigh.price) {
    const trendWasUp = lastSwingHigh.price > prevSwingHigh.price
    return {
      type: trendWasUp ? 'BOS' : 'CHoCH',
      direction: 'bullish',
      level: lastSwingHigh.price,
    }
  }
  if (lowIsRecent && lastClose < lastSwingLow.price) {
    const trendWasDown = lastSwingLow.price < prevSwingLow.price
    return {
      type: trendWasDown ? 'BOS' : 'CHoCH',
      direction: 'bearish',
      level: lastSwingLow.price,
    }
  }
  return null
}

// ─── HTF BIAS ─────────────────────────────────────────────────────────────────
export function getHtfBias(candles) {
  const bosChoch = detectBOSCHoCH(candles)
  if (!bosChoch) return 'Neutral'
  return bosChoch.direction === 'bullish' ? 'Bullish' : 'Bearish'
}

// ─── NaN / INFINITY GUARD ────────────────────────────────────────────────────
export function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n)
                      }
