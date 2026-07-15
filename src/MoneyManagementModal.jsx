// MoneyManagementModal.jsx — replaces the old AmountSetModal.jsx.
// 🔴 Risk per trade is a hardcoded 1% — shown here but NEVER editable. There
// is no input, slider, or setting anywhere in this file that can change it.

import React, { useEffect, useState } from 'react'
import { C, FIXED_RISK_PERCENT } from './constants.js'

export default function MoneyManagementModal({ onClose }) {
  const [balanceInput, setBalanceInput] = useState('')
  const [savedBalance, setSavedBalance] = useState(null)
  const [drawdownAlertOn, setDrawdownAlertOn] = useState(true)
  const [lossCountToday, setLossCountToday] = useState(0)

  useEffect(() => {
    try {
      const bal = localStorage.getItem('rtx_account_balance')
      if (bal) {
        setSavedBalance(parseFloat(bal))
        setBalanceInput(bal)
      }

      const alertPref = localStorage.getItem('rtx_drawdown_alert_on')
      setDrawdownAlertOn(alertPref !== 'off') // default ON

      const today = new Date().toISOString().slice(0, 10)
      const storedDate = localStorage.getItem('rtx_daily_loss_date')
      if (storedDate === today) {
        setLossCountToday(parseInt(localStorage.getItem('rtx_daily_loss_count') || '0', 10))
      } else {
        setLossCountToday(0)
      }
    } catch (e) {
      console.error('MoneyManagementModal: failed to read localStorage:', e.message)
    }
  }, [])

  function handleSaveBalance() {
    const val = parseFloat(balanceInput)
    if (!val || val <= 0 || Number.isNaN(val)) {
      alert('⚠️ সঠিক একটি ব্যালেন্স লিখুন (0 এর বেশি)')
      return
    }
    try {
      localStorage.setItem('rtx_account_balance', String(val))
      setSavedBalance(val)
    } catch (e) {
      console.error('MoneyManagementModal: failed to save balance:', e.message)
    }
  }

  function handleDeleteBalance() {
    try {
      localStorage.removeItem('rtx_account_balance')
      setSavedBalance(null)
      setBalanceInput('')
    } catch (e) {
      console.error('MoneyManagementModal: failed to delete balance:', e.message)
    }
  }

  function toggleDrawdownAlert() {
    const next = !drawdownAlertOn
    setDrawdownAlertOn(next)
    try {
      localStorage.setItem('rtx_drawdown_alert_on', next ? 'on' : 'off')
    } catch (e) {
      console.error('MoneyManagementModal: failed to save drawdown toggle:', e.message)
    }
  }

  const riskAmount = savedBalance ? (savedBalance * FIXED_RISK_PERCENT).toFixed(2) : null

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.handle} />
        <div style={styles.title}>💰 Money Management (Fixed Risk System)</div>

        <div style={styles.label}>Account Balance (USD)</div>
        <input
          type="number"
          inputMode="decimal"
          value={balanceInput}
          onChange={(e) => setBalanceInput(e.target.value)}
          placeholder="যেমন: 5000"
          style={styles.input}
        />

        <div style={styles.row}>
          <button style={styles.saveBtn} onClick={handleSaveBalance}>
            ✅ Save
          </button>
          {savedBalance !== null && (
            <button style={styles.deleteBtn} onClick={handleDeleteBalance}>
              🗑 Delete
            </button>
          )}
        </div>

        <div style={styles.riskBox}>
          <div style={styles.riskLabel}>Risk per trade</div>
          <div style={styles.riskValue}>1% — fixed, non-editable</div>
          {riskAmount && (
            <div style={styles.riskAmount}>= ${riskAmount} per trade (of ${savedBalance})</div>
          )}
        </div>

        <div style={styles.explainerBox}>
          ✅ প্রতি ট্রেডে ব্যালেন্সের মাত্র ১% ঝুঁকি — জিতুন বা হারুন, পরিমাণ সবসময় একই থাকে। ❌ লস
          হলে পরের ট্রেডে সাইজ বাড়ানো (Martingale) এই অ্যাপে সাপোর্ট করা হয় না, কারণ এটি অ্যাকাউন্ট
          উড়িয়ে দেওয়ার সবচেয়ে বড় কারণ।
        </div>

        <div style={styles.toggleRow}>
          <div>
            <div style={styles.label}>Drawdown Alert</div>
            <div style={styles.subtext}>আজ {lossCountToday}টি লস রেকর্ড হয়েছে</div>
          </div>
          <button
            style={{
              ...styles.toggle,
              background: drawdownAlertOn ? C.green + '33' : C.panel,
              borderColor: drawdownAlertOn ? C.green : C.border,
            }}
            onClick={toggleDrawdownAlert}
          >
            {drawdownAlertOn ? 'চালু' : 'বন্ধ'}
          </button>
        </div>

        <button style={styles.closeBtn} onClick={onClose}>
          ✅ Save & Close
        </button>
      </div>
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
    zIndex: 100,
  },
  sheet: {
    width: '100%',
    background: C.card,
    borderTop: `1px solid ${C.border}`,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: '10px 16px 20px',
    maxHeight: '85vh',
    overflowY: 'auto',
  },
  handle: {
    width: 40,
    height: 4,
    background: C.dim,
    borderRadius: 999,
    margin: '4px auto 14px',
  },
  title: { fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6 },
  subtext: { fontSize: 11, color: C.dim, marginTop: 2 },
  input: {
    width: '100%',
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '10px 12px',
    color: C.text,
    fontSize: 14,
    marginBottom: 10,
    boxSizing: 'border-box',
  },
  row: { display: 'flex', gap: 8, marginBottom: 16 },
  saveBtn: {
    flex: 1,
    background: C.green,
    border: 'none',
    borderRadius: 10,
    padding: '10px 0',
    color: '#04120c',
    fontWeight: 800,
    cursor: 'pointer',
  },
  deleteBtn: {
    background: C.panel,
    border: `1px solid ${C.red}`,
    borderRadius: 10,
    padding: '10px 14px',
    color: C.red,
    fontWeight: 700,
    cursor: 'pointer',
  },
  riskBox: {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  riskLabel: { fontSize: 11, color: C.muted, marginBottom: 4 },
  riskValue: { fontSize: 14, fontWeight: 800, color: C.gold },
  riskAmount: { fontSize: 12, color: C.text, marginTop: 4 },
  explainerBox: {
    background: `${C.blue}15`,
    border: `1px solid ${C.blue}55`,
    borderRadius: 10,
    padding: 12,
    fontSize: 12,
    lineHeight: 1.6,
    color: C.text,
    marginBottom: 16,
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  toggle: {
    border: '1px solid',
    borderRadius: 999,
    padding: '6px 16px',
    fontSize: 12,
    fontWeight: 700,
    color: C.text,
    cursor: 'pointer',
  },
  closeBtn: {
    width: '100%',
    background: C.cyan,
    border: 'none',
    borderRadius: 10,
    padding: '12px 0',
    color: '#041018',
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
  },
        }
