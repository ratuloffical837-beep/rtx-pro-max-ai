// twelveDataClient.js — runs entirely in the browser
// ✅ FINAL VERSION:
// - Session cache (60s TTL) — reduces API calls significantly
// - Retry logic for transient failures (1 retry with backoff)
// - Better error surfacing
// - HTF failures no longer kill the whole signal (returns partial data)

const BASE_URL = 'https://api.twelvedata.com'

const INTERVAL_MAP = {
  '4h': '4h',
  '1h': '1h',
  '15m': '15min',
  '5m': '5min',
}

const API_KEY_STORAGE_KEY = 'rtx_td_api_key'

// ✅ Session cache — key: `symbol|tfKey`, value: { data, ts }
const _candleCache = new Map()
const _priceCache = new Map()
const CACHE_TTL_MS = 60_000 // 60 seconds

export function getApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || null
  } catch (e) {
    console.error('twelveDataClient: failed to read API key:', e.message)
    return null
  }
}

export function saveApiKey(key) {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, key)
    return true
  } catch (e) {
    console.error('twelveDataClient: failed to save API key:', e.message)
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
    console.error('twelveDataClient: failed to increment credit usage:', e.message)
  }
}

export function getCreditUsageToday() {
  try {
    const today = getTodayString()
    const storedDate = localStorage.getItem('rtx_td_credit_date')
    if (storedDate !== today) return 0
    return parseInt(localStorage.getItem('rtx_td_credit_count') || '0', 10)
  } catch (e) {
    console.error('twelveDataClient: failed to read credit usage:', e.message)
    return 0
  }
}

// ✅ Cache lookup helper
function getCached(cache, key) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return hit.data
  }
  return null
}

function setCache(cache, key, data) {
  cache.set(key, { data, ts: Date.now() })
}

// ✅ Fetch with 1 retry on network failure
async function fetchWithRetry(url, retries = 1) {
  try {
    const res = await fetch(url)
    return await res.json()
  } catch (e) {
    if (retries > 0) {
      console.warn('twelveDataClient: fetch failed, retrying in 500ms...', e.message)
      await new Promise((r) => setTimeout(r, 500))
      return fetchWithRetry(url, retries - 1)
    }
    throw e
  }
}

export async function fetchCandles(tdSymbol, tfKey, outputsize = 100) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('API_KEY_MISSING')

  const interval = INTERVAL_MAP[tfKey]
  if (!interval) throw new Error(`Unknown timeframe key: ${tfKey}`)

  const cacheKey = `${tdSymbol}|${tfKey}`
  const cached = getCached(_candleCache, cacheKey)
  if (cached) {
    console.log(`[twelveDataClient] CACHE HIT: ${cacheKey}`)
    return cached
  }

  const url = `${BASE_URL}/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${apiKey}`

  const data = await fetchWithRetry(url, 1)

  if (data.status === 'error') {
    throw new Error(data.message || 'TWELVE_DATA_ERROR')
  }
  if (!data.values || !Array.isArray(data.values)) {
    throw new Error('TWELVE_DATA_ERROR: no candle data returned')
  }

  incrementCreditUsage(1)

  // Twelve Data returns newest-first → reverse to oldest-first
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

// ✅ Fetch all 4 timeframes — partial success is OK
// If HTF (4h/1h) fails but 15m succeeds, we return what we have
// and let signalEngine decide how to proceed
export async function fetchAllTimeframes(tdSymbol) {
  const keys = ['4h', '1h', '15m', '5m']
  const results = await Promise.allSettled(keys.map((k) => fetchCandles(tdSymbol, k)))

  const out = {}
  let anyFulfilled = false
  let lastError = null

  keys.forEach((k, i) => {
    if (results[i].status === 'fulfilled') {
      out[k] = results[i].value.length >= 30 ? results[i].value : null
      if (out[k]) anyFulfilled = true
    } else {
      out[k] = null
      lastError = results[i].reason
      console.warn(`[twelveDataClient] ${tdSymbol} ${k} failed:`, lastError?.message)
    }
  })

  // Only throw if EVERYTHING failed (including 15m — the critical one)
  if (!anyFulfilled && lastError) throw lastError

  // If 15m specifically failed, that's fatal for signal generation
  if (!out['15m']) {
    throw new Error('TWELVE_DATA_ERROR: 15m candles unavailable (required for signal)')
  }

  return out
}

export async function fetchLivePrice(tdSymbol) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('API_KEY_MISSING')

  const cached = getCached(_priceCache, tdSymbol)
  if (cached !== null) return cached

  const url = `${BASE_URL}/price?symbol=${encodeURIComponent(tdSymbol)}&apikey=${apiKey}`
  const data = await fetchWithRetry(url, 1)

  if (data.status === 'error') throw new Error(data.message || 'TWELVE_DATA_ERROR')

  incrementCreditUsage(1)
  const price = parseFloat(data.price)
  setCache(_priceCache, tdSymbol, price)
  return price
}

// ✅ Clear cache manually (useful for pull-to-refresh)
export function clearCache() {
  _candleCache.clear()
  _priceCache.clear()
  console.log('[twelveDataClient] Cache cleared')
}
