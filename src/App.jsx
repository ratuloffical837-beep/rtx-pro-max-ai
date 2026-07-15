// App.jsx — root layout.
// 🔴 There is only ONE market type (Forex), so this renders <ForexSection />
// directly below the header — no Spot/Futures tab switcher exists anywhere
// in this file or below it.

import React, { useEffect, useState } from 'react'
import { C, CONTACT, FREE_TRIAL_LIMIT, DEFAULT_MODE_ID, SIGNAL_MODES } from './constants.js'
import ForexSection from './ForexSection.jsx'
import SettingsModal from './SettingsModal.jsx'
import PaymentPage from './PaymentPage.jsx'

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [selectedModeId, setSelectedModeId] = useState(DEFAULT_MODE_ID)

  // Premium / trial state. isPremium and signalsUsed are populated from the
  // backend's /api/check-status call (owned by ForexSection / a future
  // useTrialStatus hook) — this component only renders what it's given and
  // defaults to a safe "not premium, 0 used" state on first paint.
  const [isPremium, setIsPremium] = useState(false)
  const [signalsUsed, setSignalsUsed] = useState(0)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('rtx_selected_mode')
      if (saved && SIGNAL_MODES.some((m) => m.id === saved)) {
        setSelectedModeId(saved)
      }
    } catch (e) {
      // localStorage unavailable (e.g. private browsing) — fall back to default mode silently
      // eslint-disable-next-line no-console
      console.error('Could not read rtx_selected_mode from localStorage:', e.message)
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
            <div style={{ ...styles.modeLabel, color: currentMode.color }}>{currentMode.name}</div>
          </div>

          <div style={styles.headerRight}>
            {isPremium ? (
              <span style={styles.premiumBadge}>⭐ PREMIUM</span>
            ) : (
              <span style={styles.trialBadge}>🎁 {signalsRemaining}/{FREE_TRIAL_LIMIT}</span>
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

        {!isPremium && (
          <button style={styles.upgradeBanner} onClick={() => setPaymentOpen(true)}>
            🚀 Premium আনলক করুন — ৳{CONTACT.monthlyAmount}/মাস · সীমাহীন সিগন্যাল
          </button>
        )}
      </header>

      <main style={styles.main}>
        <ForexSection
          selectedModeId={selectedModeId}
          isPremium={isPremium}
          signalsUsed={signalsUsed}
          setSignalsUsed={setSignalsUsed}
          onRequirePremium={() => setPaymentOpen(true)}
        />
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
              console.error('Could not persist rtx_selected_mode:', e.message)
            }
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {paymentOpen && <PaymentPage onClose={() => setPaymentOpen(false)} />}
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
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: 0.3,
  },
  modeLabel: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 2,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
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
  main: {
    flex: 1,
    padding: 12,
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
