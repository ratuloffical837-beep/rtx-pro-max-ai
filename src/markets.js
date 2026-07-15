// markets.js — 🔴 EXACTLY 50 Forex pairs. This is the only market list; there
// is no separate Spot/Futures list. Do not add/remove entries without
// updating the category tabs in ForexSection.jsx and the QA checklist.
//
// td  = symbol string sent to Twelve Data REST calls (format: "EUR/USD", WITH a slash)
// tv  = symbol string sent to the TradingView chart widget (format: "FX:EURUSD", NO slash, exchange-prefixed)
// cat = category shown in the market picker tabs: 'Major' | 'Cross' | 'Exotic'
//
// 🔴 `td` and `tv` must never be mixed up — keeping them as two separate
// fields per market object is precisely so this can never be accidentally
// merged (same principle as the `.P`-suffix rule in the original crypto app).

export const FOREX_MARKETS = [
  // Majors (7)
  { name: 'EUR/USD', td: 'EUR/USD', tv: 'FX:EURUSD', cat: 'Major' },
  { name: 'GBP/USD', td: 'GBP/USD', tv: 'FX:GBPUSD', cat: 'Major' },
  { name: 'USD/JPY', td: 'USD/JPY', tv: 'FX:USDJPY', cat: 'Major' },
  { name: 'USD/CHF', td: 'USD/CHF', tv: 'FX:USDCHF', cat: 'Major' },
  { name: 'USD/CAD', td: 'USD/CAD', tv: 'FX:USDCAD', cat: 'Major' },
  { name: 'AUD/USD', td: 'AUD/USD', tv: 'FX:AUDUSD', cat: 'Major' },
  { name: 'NZD/USD', td: 'NZD/USD', tv: 'FX:NZDUSD', cat: 'Major' },

  // Crosses — EUR (6)
  { name: 'EUR/GBP', td: 'EUR/GBP', tv: 'FX:EURGBP', cat: 'Cross' },
  { name: 'EUR/JPY', td: 'EUR/JPY', tv: 'FX:EURJPY', cat: 'Cross' },
  { name: 'EUR/CHF', td: 'EUR/CHF', tv: 'FX:EURCHF', cat: 'Cross' },
  { name: 'EUR/CAD', td: 'EUR/CAD', tv: 'FX:EURCAD', cat: 'Cross' },
  { name: 'EUR/AUD', td: 'EUR/AUD', tv: 'FX:EURAUD', cat: 'Cross' },
  { name: 'EUR/NZD', td: 'EUR/NZD', tv: 'FX:EURNZD', cat: 'Cross' },

  // Crosses — GBP (5)
  { name: 'GBP/JPY', td: 'GBP/JPY', tv: 'FX:GBPJPY', cat: 'Cross' },
  { name: 'GBP/CHF', td: 'GBP/CHF', tv: 'FX:GBPCHF', cat: 'Cross' },
  { name: 'GBP/CAD', td: 'GBP/CAD', tv: 'FX:GBPCAD', cat: 'Cross' },
  { name: 'GBP/AUD', td: 'GBP/AUD', tv: 'FX:GBPAUD', cat: 'Cross' },
  { name: 'GBP/NZD', td: 'GBP/NZD', tv: 'FX:GBPNZD', cat: 'Cross' },

  // Crosses — AUD (4)
  { name: 'AUD/JPY', td: 'AUD/JPY', tv: 'FX:AUDJPY', cat: 'Cross' },
  { name: 'AUD/CHF', td: 'AUD/CHF', tv: 'FX:AUDCHF', cat: 'Cross' },
  { name: 'AUD/CAD', td: 'AUD/CAD', tv: 'FX:AUDCAD', cat: 'Cross' },
  { name: 'AUD/NZD', td: 'AUD/NZD', tv: 'FX:AUDNZD', cat: 'Cross' },

  // Crosses — NZD (3)
  { name: 'NZD/JPY', td: 'NZD/JPY', tv: 'FX:NZDJPY', cat: 'Cross' },
  { name: 'NZD/CHF', td: 'NZD/CHF', tv: 'FX:NZDCHF', cat: 'Cross' },
  { name: 'NZD/CAD', td: 'NZD/CAD', tv: 'FX:NZDCAD', cat: 'Cross' },

  // Crosses — CAD (2)
  { name: 'CAD/JPY', td: 'CAD/JPY', tv: 'FX:CADJPY', cat: 'Cross' },
  { name: 'CAD/CHF', td: 'CAD/CHF', tv: 'FX:CADCHF', cat: 'Cross' },

  // Crosses — CHF (1)
  { name: 'CHF/JPY', td: 'CHF/JPY', tv: 'FX:CHFJPY', cat: 'Cross' },

  // Exotics (22)
  { name: 'USD/SGD', td: 'USD/SGD', tv: 'FX:USDSGD', cat: 'Exotic' },
  { name: 'USD/HKD', td: 'USD/HKD', tv: 'FX:USDHKD', cat: 'Exotic' },
  { name: 'USD/SEK', td: 'USD/SEK', tv: 'FX:USDSEK', cat: 'Exotic' },
  { name: 'USD/NOK', td: 'USD/NOK', tv: 'FX:USDNOK', cat: 'Exotic' },
  { name: 'USD/DKK', td: 'USD/DKK', tv: 'FX:USDDKK', cat: 'Exotic' },
  { name: 'USD/MXN', td: 'USD/MXN', tv: 'FX:USDMXN', cat: 'Exotic' },
  { name: 'USD/ZAR', td: 'USD/ZAR', tv: 'FX:USDZAR', cat: 'Exotic' },
  { name: 'USD/TRY', td: 'USD/TRY', tv: 'FX:USDTRY', cat: 'Exotic' },
  { name: 'USD/PLN', td: 'USD/PLN', tv: 'FX:USDPLN', cat: 'Exotic' },
  { name: 'USD/HUF', td: 'USD/HUF', tv: 'FX:USDHUF', cat: 'Exotic' },
  { name: 'USD/CZK', td: 'USD/CZK', tv: 'FX:USDCZK', cat: 'Exotic' },
  { name: 'EUR/SEK', td: 'EUR/SEK', tv: 'FX:EURSEK', cat: 'Exotic' },
  { name: 'EUR/NOK', td: 'EUR/NOK', tv: 'FX:EURNOK', cat: 'Exotic' },
  { name: 'EUR/PLN', td: 'EUR/PLN', tv: 'FX:EURPLN', cat: 'Exotic' },
  { name: 'EUR/TRY', td: 'EUR/TRY', tv: 'FX:EURTRY', cat: 'Exotic' },
  { name: 'EUR/HUF', td: 'EUR/HUF', tv: 'FX:EURHUF', cat: 'Exotic' },
  { name: 'GBP/SEK', td: 'GBP/SEK', tv: 'FX:GBPSEK', cat: 'Exotic' },
  { name: 'GBP/NOK', td: 'GBP/NOK', tv: 'FX:GBPNOK', cat: 'Exotic' },
  { name: 'SGD/JPY', td: 'SGD/JPY', tv: 'FX:SGDJPY', cat: 'Exotic' },
  { name: 'USD/INR', td: 'USD/INR', tv: 'FX:USDINR', cat: 'Exotic' },
  { name: 'USD/THB', td: 'USD/THB', tv: 'FX:USDTHB', cat: 'Exotic' },
  { name: 'USD/CNH', td: 'USD/CNH', tv: 'FX:USDCNH', cat: 'Exotic' },
]

// 🔴 Categories, in the order the market-picker tabs should display them.
export const MARKET_CATEGORIES = ['Major', 'Cross', 'Exotic']

export function getMarketsByCategory(cat) {
  return FOREX_MARKETS.filter((m) => m.cat === cat)
}

export function findMarketByName(name) {
  return FOREX_MARKETS.find((m) => m.name === name) || null
   }
