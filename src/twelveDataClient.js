// twelveDataClient.js — with rate limit protection
// ✅ FINAL FINAL VERSION:
// - Request queue with 8 calls/minute limit (Twelve Data free tier)
// - Longer cache (5 minutes for HTF data — 4h/1h don't change fast)
// - Shorter cache for 15m/5m (30 seconds)
// - Better error handling for 429 rate limit

const BASE_URL = 'https://api.twelvedata.com'

const INTERVAL_MAP = {
  '4h': '4h',
  '1h': '1h',
  '15m': '15min',
  '5m': '5min',
}

const API_KEY_STORAGE_KEY = 'rtx_td_api_key'

// ✅ Different cache TTLs by timeframe
const CACHE_TTL = {
  '4h': 5 * 60 * 1000,   // 5 minutes — 4h candle updates rarely
  '1h': 3 * 60 * 1000,   // 3 minutes
  '15m': 45 * 1000,      // 45 seconds
  '5m': 30 * 1000,       // 30 seconds
  'price': 30 * 1000,    // 30 seconds
}

const _candleCache = new Map()
const _priceCache = new Map()

// ✅ Rate limit tracker — Twelve Data free = 8 calls/minute
const _callTimestamps = []
const MAX_CALLS_PER_MINUTE = 7 // Leave 1 as safety buffer

export function getApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || null
  } catch (e) {
    console.error('twelveDataClient: read API key failed:', e.message)
    return null
  }
}

export function saveApiKey(key) {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, key)
    return true
  } catch (e) {
    console.error('twelveDataClient: save API key failed:', e.message)
    return false
  }
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10)
}

function incrementCreditUsage(n) {
  try {
    const today = getTodayString()
    const storedDate = localStorage.getItem('rtx_td_credit_date')
    if (storedDate !== today) {
      localStorage.setItem('rtx_td_credit_date', today)
      localStorage.setItem('rtx_td_credit_count', '0')
    }
    const current = parseInt(localStorage.getItem('rtx_td_credit_count') || '0', 10)
    localStorage.setItem('rtx_td_credit_count', String(current + n))
  } catch (e) {
    console.error('twelveDataClient: credit increment failed:', e.message)
  }
}

export function getCreditUsageToday() {
  try {
    const today = getTodayString()
    const storedDate = localStorage.getItem('rtx_td_credit_date')
    if (storedDate !== today) return 0
    return parseInt(localStorage.getItem('rtx_td_credit_count') || '0', 10)
  } catch (e) {
    return 0
  }
}

// ✅ Rate limit gate — wait if we've made too many calls recently
async function waitForRateLimit() {
  const now = Date.now()
  const oneMinuteAgo = now - 60_000

  // Remove timestamps older than 1 minute
  while (_callTimestamps.length > 0 && _callTimestamps[0] < oneMinuteAgo) {
    _callTimestamps.shift()
  }

  if (_callTimestamps.length >= MAX_CALLS_PER_MINUTE) {
    const oldestCall = _callTimestamps[0]
    const waitMs = 60_000 - (now - oldestCall) + 500 // small buffer
    console.warn(`[twelveDataClient] ⏳ Rate limit — waiting ${(waitMs / 1000).toFixed(1)}s`)
    await new Promise((r) => setTimeout(r, waitMs))
    return waitForRateLimit() // recursively check again
  }

  _callTimestamps.push(Date.now())
}

function getCached(cache, key, ttl) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < ttl) return hit.data
  return null
}

function setCache(cache, key, data) {
  cache.set(key, { data, ts: Date.now() })
}

async function fetchWithRetry(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url)
      const data = await res.json()

      // Check for rate limit response
      if (data.code === 429 || (data.message && /rate limit/i.test(data.message))) {
        console.warn(`[twelveDataClient] Rate limited — waiting 65s before retry ${attempt + 1}`)
        await new Promise((r) => setTimeout(r, 65_000))
        continue
      }

      return data
    } catch (e) {
      if (attempt < retries) {
        const delay = 1000 * (attempt + 1)
        console.warn(`[twelveDataClient] fetch failed, retry in ${delay}ms:`, e.message)
        await new Promise((r) => setTimeout(r, delay))
      } else {
        throw e
      }
    }
  }
  throw new Error('Max retries reached')
}

export async function fetchCandles(tdSymbol, tfKey, outputsize = 100) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('API_KEY_MISSING')

  const interval = INTERVAL_MAP[tfKey]
  if (!interval) throw new Error(`Unknown timeframe: ${tfKey}`)

  const cacheKey = `${tdSymbol}|${tfKey}`
  const ttl = CACHE_TTL[tfKey] || 60_000
  const cached = getCached(_candleCache, cacheKey, ttl)
  if (cached) {
    console.log(`[twelveDataClient] ✅ CACHE HIT: ${cacheKey}`)
    return cached
  }

  // Wait for rate limit before making call
  await waitForRateLimit()

  const url = `${BASE_URL}/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${apiKey}`

  console.log(`[twelveDataClient] 🌐 FETCH: ${cacheKey}`)
  const data = await fetchWithRetry(url, 2)

  if (data.status === 'error') {
    throw new Error(data.message || 'TWELVE_DATA_ERROR')
  }
  if (!data.values || !Array.isArray(data.values)) {
    throw new Error('TWELVE_DATA_ERROR: no candle data returned')
  }

  incrementCreditUsage(1)

  const parsed = data.values
    .slice()
    .reverse()
    .map((c) => ({
      time: c.datetime,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
    }))

  setCache(_candleCache, cacheKey, parsed)
  return parsed
}

// ✅ Fetch timeframes SEQUENTIALLY (not parallel) to respect rate limit
export async function fetchAllTimeframes(tdSymbol) {
  const keys = ['4h', '1h', '15m', '5m']
  const out = {}
  let lastError = null

  // Sequential fetch — each waits for rate limit before proceeding
  for (const k of keys) {
    try {
      const data = await fetchCandles(tdSymbol, k)
      out[k] = data.length >= 30 ? data : null
    } catch (e) {
      console.warn(`[twelveDataClient] ${tdSymbol} ${k} failed:`, e.message)
      out[k] = null
      lastError = e
    }
  }

  // 15m is critical — if it failed, we can't generate signal
  if (!out['15m']) {
    if (lastError) throw lastError
    throw new Error('TWELVE_DATA_ERROR: 15m candles unavailable')
  }

  return out
}

export async function fetchLivePrice(tdSymbol) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('API_KEY_MISSING')

  const cached = getCached(_priceCache, tdSymbol, CACHE_TTL.price)
  if (cached !== null) return cached

  await waitForRateLimit()

  const url = `${BASE_URL}/price?symbol=${encodeURIComponent(tdSymbol)}&apikey=${apiKey}`
  const data = await fetchWithRetry(url, 1)

  if (data.status === 'error') throw new Error(data.message || 'TWELVE_DATA_ERROR')

  incrementCreditUsage(1)
  const price = parseFloat(data.price)
  setCache(_priceCache, tdSymbol, price)
  return price
}

export function clearCache() {
  _candleCache.clear()
  _priceCache.clear()
  _callTimestamps.length = 0
  console.log('[twelveDataClient] Cache & rate limit cleared')
      }
