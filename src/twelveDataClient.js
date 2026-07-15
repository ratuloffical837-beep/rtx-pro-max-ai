// twelveDataClient.js — 🔴 runs entirely in the browser. The backend never
// touches Twelve Data or the user's API key at all.

const BASE_URL = 'https://api.twelvedata.com'

// 🔴 Exact interval strings Twelve Data expects — do not invent shorthand
// like "4H" or "15m".
const INTERVAL_MAP = {
  '4h': '4h',
  '1h': '1h',
  '15m': '15min',
  '5m': '5min',
}

const API_KEY_STORAGE_KEY = 'rtx_td_api_key'

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
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD, local calendar day is fine here
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

export async function fetchCandles(tdSymbol, tfKey, outputsize = 100) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('API_KEY_MISSING')

  const interval = INTERVAL_MAP[tfKey]
  if (!interval) throw new Error(`Unknown timeframe key: ${tfKey}`)

  const url = `${BASE_URL}/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${apiKey}`

  const res = await fetch(url)
  const data = await res.json()

  if (data.status === 'error') {
    // Twelve Data's own error payloads include rate-limit / exhausted-credit
    // messages — surface those verbatim so ForexSection's error branching
    // (which regex-matches on "credit") can catch them.
    throw new Error(data.message || 'TWELVE_DATA_ERROR')
  }
  if (!data.values || !Array.isArray(data.values)) {
    throw new Error('TWELVE_DATA_ERROR: no candle data returned')
  }

  incrementCreditUsage(1) // one time_series call = 1 credit

  // 🔴🔴 Twelve Data returns candles NEWEST-FIRST. This is the OPPOSITE of
  // Binance (which returns oldest-first). Every mode engine expects
  // oldest→newest, so this MUST be reversed here, once, centrally — do not
  // rely on each mode engine to remember to reverse it.
  return data.values
    .slice()
    .reverse()
    .map((c) => ({
      time: c.datetime,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
    }))
}

export async function fetchAllTimeframes(tdSymbol) {
  const keys = ['4h', '1h', '15m', '5m']
  const results = await Promise.allSettled(keys.map((k) => fetchCandles(tdSymbol, k)))

  const out = {}
  let anyFulfilled = false
  let lastError = null

  keys.forEach((k, i) => {
    if (results[i].status === 'fulfilled') {
      // Discard any timeframe with fewer than 30 candles.
      out[k] = results[i].value.length >= 30 ? results[i].value : null
      if (out[k]) anyFulfilled = true
    } else {
      out[k] = null
      lastError = results[i].reason
    }
  })

  // If every single timeframe failed (e.g. bad/exhausted key), surface the
  // underlying error instead of silently returning an all-null object.
  if (!anyFulfilled && lastError) throw lastError

  return out
}

export async function fetchLivePrice(tdSymbol) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('API_KEY_MISSING')

  const url = `${BASE_URL}/price?symbol=${encodeURIComponent(tdSymbol)}&apikey=${apiKey}`
  const res = await fetch(url)
  const data = await res.json()

  if (data.status === 'error') throw new Error(data.message || 'TWELVE_DATA_ERROR')

  incrementCreditUsage(1)
  return parseFloat(data.price)
}
