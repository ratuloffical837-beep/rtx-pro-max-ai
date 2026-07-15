// SettingsModal.jsx — same bottom-sheet pattern as the original app, with the
// 🆕 API key section and Credit Usage Meter added above the mode cards.

import React, { useEffect, useState } from 'react'
import { C, SIGNAL_MODES, TWELVE_DATA_DAILY_CREDIT_LIMIT } from './constants.js'
import { getApiKey, saveApiKey, getCreditUsageToday } from './twelveDataClient.js'
import MoneyManagementModal from './MoneyManagementModal.jsx'

export default function SettingsModal({ selectedModeId, onSelectMode, onClose }) {
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [creditUsed, setCreditUsed] = useState(0)
  const [moneyModalOpen, setMoneyModalOpen] = useState(false)

  useEffect(() => {
    try {
      const existing = getApiKey()
      if (existing) {
        setKeyInput(existing)
        setHasKey(true)
      }
      setCreditUsed(getCreditUsageToday())
    } catch (e) {
      console.error('SettingsModal: failed to read API key / credit usage:', e.message)
    }
  }, [])

  function handleSaveKey() {
    const trimmed = keyInput.trim()
    if (!trimmed) {
      alert('⚠️ একটি বৈধ API Key লিখুন')
      return
    }
    try {
      saveApiKey(trimmed)
      setHasKey(true)
    } catch (e) {
      console.error('SettingsModal: failed to save API key:', e.message)
      alert('⚠️ Key সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন')
    }
  }

  const creditPct = Math.min((creditUsed / TWELVE_DATA_DAILY_CREDIT_LIMIT) * 100, 100)
  const creditColor = creditPct < 60 ? C.green : creditPct < 85 ? C.gold : C.red

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.handle} />

        {/* 1. API Key section */}
        <div style={styles.sectionTitle}>🔑 আপনার Twelve Data API Key</div>
        <div style={styles.keyRow}>
          <input
            type={showKey ? 'text' : 'password'}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="আপনার API Key পেস্ট করুন"
            style={styles.keyInput}
          />
          <button style={styles.eyeBtn} onClick={() => setShowKey((v) => !v)} aria-label="Toggle visibility">
            {showKey ? '🙈' : '👁'}
          </button>
        </div>
        <button style={styles.saveKeyBtn} onClick={handleSaveKey}>
          ✅ Save Key
        </button>
        <div style={styles.helperText}>
          ⚠️ প্রতিদিন ৮০০ কল লিমিট — এই Key শুধু আপনার ব্রাউজারে সংরক্ষিত থাকে, আমাদের সার্ভারে যায়
          না।
        </div>
        {!hasKey && (
          <div style={styles.warnText}>⚠️ প্রথমে এখানে আপনার API Key যোগ করুন।</div>
        )}

        {/* 2. Credit usage meter */}
        <div style={styles.meterLabel}>
          আজকে ব্যবহৃত: {creditUsed} / {TWELVE_DATA_DAILY_CREDIT_LIMIT} credit
        </div>
        <div style={styles.meterTrack}>
          <div style={{ ...styles.meterFill, width: `${creditPct}%`, background: creditColor }} />
        </div>

        {/* 3. Mode cards */}
        <div style={styles.sectionTitle}>📊 সিগন্যাল মোড</div>
        <div style={styles.modeList}>
          {SIGNAL_MODES.map((mode) => {
            const active = mode.id === selectedModeId
            return (
              <button
                key={mode.id}
                onClick={() => onSelectMode(mode.id)}
                style={{
                  ...styles.modeCard,
                  borderColor: active ? mode.color : C.border,
                  background: active ? `${mode.color}18` : C.panel,
                }}
              >
                <span style={{ ...styles.modeDot, background: mode.color }} />
                <span style={styles.modeName}>{mode.name}</span>
                {active && <span style={{ color: mode.color, fontWeight: 800 }}>✓</span>}
              </button>
            )
          })}
        </div>

        {/* 4. Money management */}
        <button style={styles.moneyBtn} onClick={() => setMoneyModalOpen(true)}>
          💰 Money Management
        </button>

        {/* 5. Save & close */}
        <button style={styles.closeBtn} onClick={onClose}>
          ✅ Save & Close
        </button>
      </div>

      {moneyModalOpen && <MoneyManagementModal onClose={() => setMoneyModalOpen(false)} />}
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'flex-end',
    zIndex: 90,
  },
  sheet: {
    width: '100%',
    background: C.card,
    borderTop: `1px solid ${C.border}`,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: '10px 16px 22px',
    maxHeight: '88vh',
    overflowY: 'auto',
  },
  handle: {
    width: 40,
    height: 4,
    background: C.dim,
    borderRadius: 999,
    margin: '4px auto 16px',
  },
  sectionTitle: { fontSize: 14, fontWeight: 800, color: C.text, margin: '14px 0 8px' },
  keyRow: { display: 'flex', gap: 8 },
  keyInput: {
    flex: 1,
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '10px 12px',
    color: C.text,
    fontSize: 13,
    boxSizing: 'border-box',
  },
  eyeBtn: {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    width: 42,
    cursor: 'pointer',
    fontSize: 16,
  },
  saveKeyBtn: {
    width: '100%',
    marginTop: 8,
    background: C.cyan,
    border: 'none',
    borderRadius: 10,
    padding: '9px 0',
    color: '#041018',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
  },
  helperText: { fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.5 },
  warnText: { fontSize: 11, color: C.gold, marginTop: 6, fontWeight: 600 },
  meterLabel: { fontSize: 11, color: C.muted, marginTop: 14, marginBottom: 6 },
  meterTrack: {
    width: '100%',
    height: 8,
    background: C.panel,
    borderRadius: 999,
    overflow: 'hidden',
    border: `1px solid ${C.border}`,
  },
  meterFill: { height: '100%', borderRadius: 999, transition: 'width 0.3s' },
  modeList: { display: 'flex', flexDirection: 'column', gap: 8 },
  modeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid',
    borderRadius: 10,
    padding: '12px 14px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  modeDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  modeName: { flex: 1, fontSize: 12.5, fontWeight: 700, color: C.text },
  moneyBtn: {
    width: '100%',
    marginTop: 18,
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '12px 0',
    color: C.text,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  closeBtn: {
    width: '100%',
    marginTop: 10,
    background: C.green,
    border: 'none',
    borderRadius: 10,
    padding: '12px 0',
    color: '#04120c',
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
  },
        }
