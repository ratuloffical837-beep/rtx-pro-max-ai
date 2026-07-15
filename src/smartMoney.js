// smartMoney.js — shared Smart-Money-Concepts helpers used by all 5 mode
// engines. Pure price-action/structure math — no indicators, ATR is only
// used for volatility buffers per the master prompt's stated exception.

// Average True Range over the last `period` candles (Wilder-style, simple average).
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

// Simple fractal-based swing high/low detection: a candle is a swing high if
// its high is greater than `lookback` candles on each side, and vice versa
// for swing lows.
export function findSwings(candles, lookback = 2) {
  const swingHighs = []
  const swingLows = []

  for (let i = lookback; i < candles.length - lookback; i++) {
    const window = candles.slice(i - lookback, i + lookback + 1)
    const c = candles[i]

    if (c.high === Math.max(...window.map((w) => w.high))) {
      swingHighs.push({ index: i, price: c.high, time: c.time })
    }
    if (c.low === Math.min(...window.map((w) => w.low))) {
      swingLows.push({ index: i, price: c.low, time: c.time })
    }
  }

  return { swingHighs, swingLows }
}

// Bullish/bearish Order Block: the last down (or up) candle immediately
// before a strong displacement move in the opposite direction.
export function detectOrderBlock(candles, direction) {
  if (!candles || candles.length < 5) return null

  for (let i = candles.length - 3; i >= 1; i--) {
    const c = candles[i]
    const next = candles[i + 1]
    const isBearishCandle = c.close < c.open
    const isBullishCandle = c.close > c.open
    const displacement = Math.abs(next.close - next.open)
    const avgRange = calcAvgRange(candles.slice(Math.max(0, i - 10), i))

    if (!avgRange) continue

    if (direction === 'LONG' && isBearishCandle && next.close > next.open && displacement > avgRange * 1.5) {
      return { index: i, high: c.high, low: c.low, time: c.time }
    }
    if (direction === 'SHORT' && isBullishCandle && next.close < next.open && displacement > avgRange * 1.5) {
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

// Fair Value Gap: a 3-candle imbalance where candle[0].high < candle[2].low
// (bullish FVG) or candle[0].low > candle[2].high (bearish FVG).
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

// Break of Structure / Change of Character detection against the most
// recent swing points.
export function detectBOSCHoCH(candles) {
  const { swingHighs, swingLows } = findSwings(candles, 2)
  if (swingHighs.length < 2 || swingLows.length < 2) return null

  const lastClose = candles[candles.length - 1].close
  const lastSwingHigh = swingHighs[swingHighs.length - 1]
  const lastSwingLow = swingLows[swingLows.length - 1]
  const prevSwingHigh = swingHighs[swingHighs.length - 2]
  const prevSwingLow = swingLows[swingLows.length - 2]

  if (lastClose > lastSwingHigh.price) {
    const trendWasUp = lastSwingHigh.price > prevSwingHigh.price
    return { type: trendWasUp ? 'BOS' : 'CHoCH', direction: 'bullish', level: lastSwingHigh.price }
  }
  if (lastClose < lastSwingLow.price) {
    const trendWasDown = lastSwingLow.price < prevSwingLow.price
    return { type: trendWasDown ? 'BOS' : 'CHoCH', direction: 'bearish', level: lastSwingLow.price }
  }
  return null
}

// HTF (4h/1h) directional bias from the last two swing highs/lows —
// 🔴 this bias can never be ignored by a mode engine (common rule #2).
export function getHtfBias(candles) {
  const bosChoch = detectBOSCHoCH(candles)
  if (!bosChoch) return 'Neutral'
  return bosChoch.direction === 'bullish' ? 'Bullish' : 'Bearish'
}

// NaN/Infinity guard — common rule #4. Treats bad calculations as neutral
// rather than letting them propagate into a signal.
export function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n)
      }
