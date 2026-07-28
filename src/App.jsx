// App.jsx — root layout
// ✅ FINAL VERSION:
// - statusLoading gate — signal generation blocked until premium status resolves
// - Backend status re-check after payment close
// - initTelegramWebApp on mount

import React, { useEffect, useState } from 'react'
import {
  C,
  CONTACT,
  FREE_TRIAL_LIMIT,
  DEFAULT_MODE_ID,
  SIGNAL_MODES,
  BACKEND_URL,
} from './constants.js'
import ForexSection from './ForexSection.jsx'
import SettingsModal from './SettingsModal.jsx'
import PaymentPage from './PaymentPage.jsx'
import { initTelegramWebApp, getTelegramUser } from './telegramUser.js'

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [selectedModeId, setSelectedModeId] = useState(DEFAULT_MODE_ID)

  const [isPremium, setIsPremium] = useState(false)
  const [signalsUsed, setSignalsUsed] = useState(0)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState('')

  useEffect(() => {
    initTelegramWebApp()

    try {
      const saved = localStorage.getItem('rtx_selected_mode')
      if (saved && SIGNAL_MODES.some((m) => m.id === saved)) {
        setSelectedModeId(saved)
      }
    } catch (e) {
      console.error('App: could not read rtx_selected_mode:', e.message)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadStatus() {
      setStatusLoading(true)
      setStatusError('')

      if (!BACKEND_URL) {
        console.error('App: VITE_BACKEND_URL not set')
        if (!cancelled) {
          setStatusError('সার্ভার কনফিগারেশন সমস্যা — Premium স্ট্যাটাস লোড করা যায়নি।')
          setStatusLoading(false)
        }
        return
      }

      try {
        const { userId } = getTelegramUser()
        const res = await fetch(`${BACKEND_URL}/api/check-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })

        if (!res.ok) throw new Error(`check-status returned ${res.status}`)

        const data = await res.json()
        if (!cancelled) {
          setIsPremium(!!data.isPremium)
          setSignalsUsed(typeof data.signalsUsed === 'number' ? data.signalsUsed : 0)
        }
      } catch (e) {
        console.error('App: failed to load status:', e.message)
        if (!cancelled) {
          setStatusError('Premium স্ট্যাটাস লোড করা যায়নি — ইন্টারনেট চেক করুন।')
        }
      } finally {
        if (!cancelled) setStatusLoading(false)
      }
    }

    loadStatus()
    return () => {
      cancelled = true
    }
  }, [])

  const currentMode = SIGNAL_MODES.find((m) => m.id === selectedModeId) || SIGNAL_MODES[0]
  const signalsRemaining = Math.max(FREE_TRIAL_LIMIT - signalsUsed, 0)

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <div>
            <div style={styles.logo}>🚀 RTX PRO MAX</div>
            <div style={{ ...styles.modeLabel, color: currentMode.color }}>
              {currentMode.name}
            </div>
          </div>

          <div style={styles.headerRight}>
            {statusLoading ? (
              <span style={styles.loadingBadge}>...</span>
            ) : isPremium ? (
              <span style={styles.premiumBadge}>⭐ PREMIUM</span>
            ) : (
              <span style={styles.trialBadge}>
                🎁 {signalsRemaining}/{FREE_TRIAL_LIMIT}
              </span>
            )}
            <button
              style={styles.settingsBtn}
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
            >
              ⚙️
            </button>
          </div>
        </div>

        {statusError && <div style={styles.statusErrorBanner}>⚠️ {statusError}</div>}

        {!statusLoading && !isPremium && (
          <button style={styles.upgradeBanner} onClick={() => setPaymentOpen(true)}>
            🚀 Premium আনলক করুন — ৳{CONTACT.monthlyAmount}/মাস · সীমাহীন সিগন্যাল
          </button>
        )}
      </header>

      <main style={styles.main}>
        {statusLoading ? (
          <div style={styles.loadingCenter}>⏳ লোড হচ্ছে...</div>
        ) : (
          <ForexSection
            selectedModeId={selectedModeId}
            isPremium={isPremium}
            signalsUsed={signalsUsed}
            setSignalsUsed={setSignalsUsed}
            onRequirePremium={() => setPaymentOpen(true)}
          />
        )}
      </main>

      <footer style={styles.footer}>
        <a href={CONTACT.group} target="_blank" rel="noreferrer" style={styles.footerLink}>
          💬 গ্রুপ
        </a>
        <a href={CONTACT.channel} target="_blank" rel="noreferrer" style={styles.footerLink}>
          📢 চ্যানেল
        </a>
        <a href={CONTACT.support} target="_blank" rel="noreferrer" style={styles.footerLink}>
          🆘 সাপোর্ট
        </a>
      </footer>

      {settingsOpen && (
        <SettingsModal
          selectedModeId={selectedModeId}
          onSelectMode={(id) => {
            setSelectedModeId(id)
            try {
              localStorage.setItem('rtx_selected_mode', id)
            } catch (e) {
              console.error('App: could not persist mode:', e.message)
            }
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {paymentOpen && (
        <PaymentPage
          onClose={() => {
            setPaymentOpen(false)
            setStatusLoading(true)
            if (BACKEND_URL) {
              const { userId } = getTelegramUser()
              fetch(`${BACKEND_URL}/api/check-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
              })
                .then((res) => res.json())
                .then((data) => {
                  setIsPremium(!!data.isPremium)
                  setSignalsUsed(typeof data.signalsUsed === 'number' ? data.signalsUsed : 0)
                })
                .catch((e) => console.error('App: re-check failed:', e.message))
                .finally(() => setStatusLoading(false))
            } else {
              setStatusLoading(false)
            }
          }}
        />
      )}
    </div>
  )
}

const styles = {
  app: {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  header: {
    background: C.card,
    borderBottom: `1px solid ${C.border}`,
    padding: '12px 16px',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 18, fontWeight: 800, letterSpacing: 0.3 },
  modeLabel: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  loadingBadge: {
    fontSize: 12,
    fontWeight: 700,
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 999,
    padding: '4px 10px',
    color: C.muted,
  },
  trialBadge: {
    fontSize: 12,
    fontWeight: 700,
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 999,
    padding: '4px 10px',
    color: C.gold,
  },
  premiumBadge: {
    fontSize: 12,
    fontWeight: 700,
    background: C.panel,
    border: `1px solid ${C.gold}`,
    borderRadius: 999,
    padding: '4px 10px',
    color: C.gold,
  },
  settingsBtn: {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    width: 36,
    height: 36,
    fontSize: 16,
    color: C.text,
    cursor: 'pointer',
  },
  statusErrorBanner: {
    marginTop: 10,
    fontSize: 11,
    color: C.red,
    fontWeight: 600,
    lineHeight: 1.5,
  },
  upgradeBanner: {
    marginTop: 10,
    width: '100%',
    background: `linear-gradient(90deg, ${C.gold}22, ${C.orange}22)`,
    border: `1px solid ${C.gold}`,
    borderRadius: 10,
    padding: '8px 12px',
    color: C.gold,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  main: { flex: 1, padding: 12 },
  loadingCenter: {
    textAlign: 'center',
    fontSize: 14,
    color: C.muted,
    padding: '40px 0',
  },
  footer: {
    display: 'flex',
    justifyContent: 'center',
    gap: 20,
    padding: '14px 0',
    borderTop: `1px solid ${C.border}`,
    background: C.card,
  },
  footerLink: {
    color: C.muted,
    fontSize: 12,
    textDecoration: 'none',
    fontWeight: 600,
  },
    }
