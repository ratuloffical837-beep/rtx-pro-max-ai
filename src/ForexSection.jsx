// ForexSection.jsx
// ✅ FINAL VERSION:
// - Live price polls every 60s (with cache)
// - JPY-aware price format via formatPrice
// - Dead priceChangePct feature removed
// - Sound feature removed (was never implemented)
// - Uses telegramUser userId for check-status consume call

import React, { useEffect, useMemo, useState } from 'react'
import { C, FREE_TRIAL_LIMIT, SIGNAL_MODES, BACKEND_URL } from './constants.js'
import { FOREX_MARKETS, MARKET_CATEGORIES, getMarketsByCategory, findMarketByName } from './markets.js'
import { isForexMarketOpen, nextOpenDayLabel } from './marketHours.js'
import { getApiKey, fetchAllTimeframes, fetchLivePrice } from './twelveDataClient.js'
import { generateSignal } from './signalEngine.js'
import { getTelegramUser } from './telegramUser.js'
import { formatPrice } from './pipUtils.js'
import SignalCard from './SignalCard.jsx'

const LIVE_PRICE_POLL_MS = 60_000

export default function ForexSection({
  selectedModeId,
  isPremium,
  signalsUsed,
  setSignalsUsed,
  onRequirePremium,
}) {
  const [selectedPairName, setSelectedPairName] = useState('EUR/USD')
  const [favorites, setFavorites] = useState([])
  const [livePrice, setLivePrice] = useState(null)

  const [signal, setSignal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progressStep, setProgressStep] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [debugReason, setDebugReason] = useState(null)
  const [drawdownAlertOn, setDrawdownAlertOn] = useState(true)
  const [lossCountToday, setLossCountToday] = useState(0)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTab, setPickerTab] = useState('Major')
  const [pickerSearch, setPickerSearch] = useState('')

  const selectedMarket = useMemo(
    () => findMarketByName(selectedPairName) || FOREX_MARKETS[0],
    [selectedPairName]
  )
  const currentMode = SIGNAL_MODES.find((m) => m.id === selectedModeId) || SIGNAL_MODES[0]
  const marketOpen = isForexMarketOpen()
  const hasApiKey = !!getApiKey()
  const signalsRemaining = Math.max(FREE_TRIAL_LIMIT - signalsUsed, 0)

  useEffect(() => {
    try {
      const savedPair = localStorage.getItem('rtx_forex_pair')
      if (savedPair && findMarketByName(savedPair)) setSelectedPairName(savedPair)

      const savedFavs = localStorage.getItem('rtx_forex_favs')
      if (savedFavs) setFavorites(JSON.parse(savedFavs))

      const alertPref = localStorage.getItem('rtx_drawdown_alert_on')
      setDrawdownAlertOn(alertPref !== 'off')

      const today = new Date().toISOString().slice(0, 10)
      const storedDate = localStorage.getItem('rtx_daily_loss_date')
      setLossCountToday(
        storedDate === today
          ? parseInt(localStorage.getItem('rtx_daily_loss_count') || '0', 10)
          : 0
      )
    } catch (e) {
      console.error('ForexSection: failed to load preferences:', e.message)
    }
  }, [])

  // ✅ Live price polling every 60s
  useEffect(() => {
    let cancelled = false
    setLivePrice(null)

    if (!hasApiKey || !selectedMarket) return

    const fetchPrice = () => {
      fetchLivePrice(selectedMarket.td)
        .then((price) => {
          if (!cancelled) setLivePrice(price)
        })
        .catch((e) => {
          console.error('ForexSection: live price fetch failed:', e.message)
        })
    }

    fetchPrice()
    const intervalId = setInterval(fetchPrice, LIVE_PRICE_POLL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [selectedMarket, hasApiKey])

  function persistPair(name) {
    setSelectedPairName(name)
    setSignal(null)
    setErrorMsg('')
    setDebugReason(null)
    try {
      localStorage.setItem('rtx_forex_pair', name)
    } catch (e) {
      console.error('ForexSection: failed to persist pair:', e.message)
    }
  }

  function toggleFavorite(name) {
    setFavorites((prev) => {
      const next = prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]
      try {
        localStorage.setItem('rtx_forex_favs', JSON.stringify(next))
      } catch (e) {
        console.error('ForexSection: failed to persist favorites:', e.message)
      }
      return next
    })
  }

  function recordTrade(won) {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const storedDate = localStorage.getItem('rtx_daily_loss_date')
      let count =
        storedDate === today
          ? parseInt(localStorage.getItem('rtx_daily_loss_count') || '0', 10)
          : 0

      if (!won) count += 1

      localStorage.setItem('rtx_daily_loss_date', today)
      localStorage.setItem('rtx_daily_loss_count', String(count))
      setLossCountToday(count)
    } catch (e) {
      console.error('ForexSection: failed to record trade:', e.message)
    }
  }

  async function handleGenerate() {
    setErrorMsg('')
    setDebugReason(null)
    setSignal(null)

    if (!isPremium && signalsRemaining <= 0) {
      onRequirePremium()
      return
    }
    if (!hasApiKey) {
      setErrorMsg('⚠️ প্রথমে Settings থেকে আপনার API Key যোগ করুন।')
      return
    }
    if (!marketOpen) {
      setErrorMsg('🔴 Market Closed — এখন সিগন্যাল জেনারেট করা যাবে না।')
      return
    }

    setLoading(true)
    try {
      setProgressStep('📡 ক্যান্ডেল ডেটা আনা হচ্ছে...')
      const timeframes = await fetchAllTimeframes(selectedMarket.td)

      setProgressStep(`🔍 ${currentMode.name} মোডে বিশ্লেষণ চলছে...`)
      const result = await generateSignal({
        modeId: selectedModeId,
        market: selectedMarket,
        timeframes,
      })

      if (!result || result.noSignal) {
        setErrorMsg('❌ এই পেয়ারে এখন কোনো শক্তিশালী সিগন্যাল নেই।')
        setDebugReason(result?.debugReason || null)
        setLoading(false)
        setProgressStep('')
        return
      }

      setDebugReason(null)
      setSignal(result)

      if (!isPremium) {
        setSignalsUsed((prev) => prev + 1)
        try {
          if (BACKEND_URL) {
            const { userId } = getTelegramUser()
            const res = await fetch(`${BACKEND_URL}/api/check-status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, consume: true }),
            })
            if (!res.ok) {
              console.error('ForexSection: check-status returned', res.status)
            }
          }
        } catch (e) {
          console.error('ForexSection: check-status ping failed:', e.message)
        }
      }
    } catch (e) {
      console.error('ForexSection: signal generation failed:', e.message)
      if (e.message === 'API_KEY_MISSING') {
        setErrorMsg('⚠️ প্রথমে Settings থেকে আপনার API Key যোগ করুন।')
      } else if (/credit/i.test(e.message) || /limit/i.test(e.message)) {
        setErrorMsg('⚠️ আজকের API কল লিমিট শেষ — কাল আবার চেষ্টা করুন।')
      } else if (/15m/i.test(e.message)) {
        setErrorMsg('⚠️ 15m ক্যান্ডেল ডেটা পাওয়া যায়নি — কিছুক্ষণ পর আবার চেষ্টা করুন।')
      } else {
        setErrorMsg('⚠️ ডেটা আনতে সমস্যা হয়েছে — একটু পর আবার চেষ্টা করুন।')
      }
    } finally {
      setLoading(false)
      setProgressStep('')
    }
  }

  const generateDisabled = loading || !hasApiKey || !marketOpen

  const filteredPickerMarkets = useMemo(() => {
    const list = getMarketsByCategory(pickerTab)
    if (!pickerSearch.trim()) return list
    const q = pickerSearch.trim().toUpperCase()
    return list.filter((m) => m.name.includes(q))
  }, [pickerTab, pickerSearch])

  return (
    <div style={styles.wrap}>
      {!isPremium && (
        <div style={styles.trialBanner}>
          🎁 Free Signals Remaining: {signalsRemaining} / {FREE_TRIAL_LIMIT}
        </div>
      )}

      {drawdownAlertOn && lossCountToday >= 3 && (
        <div style={styles.drawdownBanner}>
          ⚠️ আজ {lossCountToday}টি লস হয়েছে — আজকের জন্য ট্রেডিং বিরতি নেওয়ার পরামর্শ।
        </div>
      )}

      {!marketOpen ? (
        <div style={styles.closedBanner}>🔴 Market Closed — খুলবে {nextOpenDayLabel()}</div>
      ) : (
        <>
          <div style={styles.chartBox}>
            <div style={styles.timeframeNote}>
              📊 এন্ট্রি টাইমফ্রেম: 15m (4h/1h = ট্রেন্ড কনফার্মেশন)
            </div>
            <iframe
              title="tradingview-chart"
              style={styles.chartFrame}
              src={`https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
                selectedMarket.tv
              )}&interval=15&theme=dark&style=1&hidesidetoolbar=1`}
            />
          </div>

          <div style={styles.pairInfoCard}>
            <div>
              <div style={styles.pairInfoName}>{selectedMarket.name}</div>
              <span style={styles.pairInfoCat}>{selectedMarket.cat}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={styles.pairInfoPrice}>
                {formatPrice(livePrice, selectedMarket.td)}
              </div>
            </div>
          </div>

          <button
            style={{ ...styles.generateBtn, opacity: generateDisabled ? 0.5 : 1 }}
            onClick={handleGenerate}
            disabled={generateDisabled}
          >
            🚀 GENERATE {currentMode.name} SIGNAL
          </button>

          {!hasApiKey && (
            <div style={styles.disabledHint}>
              ⚠️ প্রথমে Settings থেকে আপনার API Key যোগ করুন।
            </div>
          )}

          {loading && <div style={styles.progressBox}>{progressStep}</div>}

          {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}

          {debugReason && <div style={styles.debugBox}>🔍 DEBUG: {debugReason}</div>}

          {signal && (
            <SignalCard
              signal={signal}
              drawdownAlertOn={drawdownAlertOn}
              onWon={() => recordTrade(true)}
              onLost={() => recordTrade(false)}
            />
          )}
        </>
      )}

      <button style={styles.changeMarketBtn} onClick={() => setPickerOpen(true)}>
        🔁 Tap to Change Market
      </button>

      {pickerOpen && (
        <div style={styles.overlay} onClick={() => setPickerOpen(false)}>
          <div style={styles.pickerSheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.handle} />
            <input
              style={styles.searchInput}
              placeholder="🔍 পেয়ার খুঁজুন..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
            />

            <div style={styles.tabRow}>
              {MARKET_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setPickerTab(cat)}
                  style={{
                    ...styles.tabBtn,
                    borderColor: pickerTab === cat ? C.cyan : C.border,
                    color: pickerTab === cat ? C.cyan : C.muted,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {favorites.length > 0 && (
              <div style={styles.favRow}>
                {favorites.map((f) => (
                  <button
                    key={f}
                    style={styles.favChip}
                    onClick={() => {
                      persistPair(f)
                      setPickerOpen(false)
                    }}
                  >
                    ⭐ {f}
                  </button>
                ))}
              </div>
            )}

            <div style={styles.chipGrid}>
              {filteredPickerMarkets.map((m) => (
                <div key={m.name} style={styles.chip}>
                  <button
                    style={styles.chipMain}
                    onClick={() => {
                      persistPair(m.name)
                      setPickerOpen(false)
                    }}
                  >
                    {m.name}
                  </button>
                  <button style={styles.chipStar} onClick={() => toggleFavorite(m.name)}>
                    {favorites.includes(m.name) ? '⭐' : '☆'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 10 },
  trialBanner: {
    background: `${C.gold}18`,
    border: `1px solid ${C.gold}55`,
    borderRadius: 10,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    color: C.gold,
    textAlign: 'center',
  },
  drawdownBanner: {
    background: `${C.red}18`,
    border: `1px solid ${C.red}55`,
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 12,
    color: C.red,
    fontWeight: 600,
    lineHeight: 1.5,
  },
  closedBanner: {
    background: C.panel,
    border: `1px solid ${C.gold}55`,
    borderRadius: 12,
    padding: '30px 12px',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 700,
    color: C.gold,
  },
  chartBox: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    border: `1px solid ${C.border}`,
  },
  timeframeNote: {
    background: C.panel,
    color: C.cyan,
    fontSize: 10.5,
    fontWeight: 700,
    textAlign: 'center',
    padding: '6px 8px',
    borderBottom: `1px solid ${C.border}`,
  },
  chartFrame: { width: '100%', height: 260, border: 'none', display: 'block' },
  pairInfoCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '10px 14px',
  },
  pairInfoName: { fontSize: 15, fontWeight: 800, color: C.text },
  pairInfoCat: { fontSize: 10, color: C.muted, fontWeight: 700 },
  pairInfoPrice: { fontSize: 15, fontWeight: 800, color: C.text },
  generateBtn: {
    width: '100%',
    background: C.cyan,
    border: 'none',
    borderRadius: 12,
    padding: '14px 0',
    color: '#041018',
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
  },
  disabledHint: { fontSize: 11, color: C.gold, textAlign: 'center' },
  progressBox: {
    textAlign: 'center',
    fontSize: 12,
    color: C.cyan,
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 10,
  },
  errorBox: {
    background: `${C.red}18`,
    border: `1px solid ${C.red}55`,
    borderRadius: 10,
    padding: 12,
    fontSize: 12,
    color: C.red,
    fontWeight: 600,
    textAlign: 'center',
  },
  debugBox: {
    background: '#0d1117',
    border: `1px dashed ${C.blue}66`,
    borderRadius: 10,
    padding: 10,
    fontSize: 11,
    color: C.blue,
    lineHeight: 1.6,
    textAlign: 'center',
  },
  changeMarketBtn: {
    width: '100%',
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '12px 0',
    color: C.text,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'flex-end',
    zIndex: 95,
  },
  pickerSheet: {
    width: '100%',
    background: C.card,
    borderTop: `1px solid ${C.border}`,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: '10px 16px 20px',
    maxHeight: '85vh',
    overflowY: 'auto',
  },
  handle: { width: 40, height: 4, background: C.dim, borderRadius: 999, margin: '4px auto 12px' },
  searchInput: {
    width: '100%',
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '10px 12px',
    color: C.text,
    fontSize: 13,
    marginBottom: 10,
    boxSizing: 'border-box',
  },
  tabRow: { display: 'flex', gap: 8, marginBottom: 10 },
  tabBtn: {
    flex: 1,
    background: C.panel,
    border: '1px solid',
    borderRadius: 8,
    padding: '8px 0',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  },
  favRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  favChip: {
    background: `${C.gold}15`,
    border: `1px solid ${C.gold}55`,
    borderRadius: 999,
    padding: '5px 10px',
    fontSize: 11,
    color: C.gold,
    fontWeight: 700,
    cursor: 'pointer',
  },
  chipGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  chip: {
    display: 'flex',
    alignItems: 'center',
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    overflow: 'hidden',
  },
  chipMain: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    padding: '10px 8px',
    color: C.text,
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'left',
    cursor: 'pointer',
  },
  chipStar: {
    background: 'transparent',
    border: 'none',
    padding: '10px',
    cursor: 'pointer',
    fontSize: 13,
  },
}
