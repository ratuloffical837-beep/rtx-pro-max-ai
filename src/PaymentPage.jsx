// PaymentPage.jsx — manual bKash/Nagad payment flow, same pattern as the
// original crypto app. Writes a pending payment doc to Firestore and pings
// the backend so the admin gets a Telegram approval prompt. Price comes only
// from constants.js — never hardcoded here.

import React, { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'
import { C, CONTACT, BACKEND_URL } from './constants.js'

export default function PaymentPage({ onClose }) {
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState(String(CONTACT.monthlyAmount))
  const [trxId, setTrxId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  function handleCopyNumber() {
    try {
      navigator.clipboard.writeText(CONTACT.paymentNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (e) {
      console.error('PaymentPage: clipboard copy failed:', e.message)
    }
  }

  async function handleSubmit() {
    setError('')

    if (!phone.trim() || !trxId.trim()) {
      setError('⚠️ ফোন নাম্বার এবং TrxID দুটোই আবশ্যক')
      return
    }
    if (!db) {
      setError('⚠️ সার্ভার সংযোগ পাওয়া যায়নি — একটু পর আবার চেষ্টা করুন')
      return
    }

    setSubmitting(true)
    try {
      const docRef = await addDoc(collection(db, 'forex_payments'), {
        phone: phone.trim(),
        amount: Number(amount) || CONTACT.monthlyAmount,
        trxId: trxId.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      })

      // Notify backend so the admin gets a Telegram approval prompt. The
      // backend never sees market/signal data — only this payment record.
      try {
        if (!BACKEND_URL) {
          console.error('PaymentPage: VITE_BACKEND_URL is not set — cannot notify admin.')
        } else {
          await fetch(`${BACKEND_URL}/api/notify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentId: docRef.id, phone: phone.trim(), trxId: trxId.trim() }),
          })
        }
      } catch (notifyErr) {
        // Payment record is already saved in Firestore even if the notify
        // ping fails — the admin can still find it manually, so don't block
        // the success state on this.
        console.error('PaymentPage: notify-payment ping failed:', notifyErr.message)
      }

      setSubmitted(true)
    } catch (e) {
      console.error('PaymentPage: Firestore write failed:', e.message)
      setError('⚠️ পেমেন্ট তথ্য সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.page}>
        <div style={styles.topBar}>
          <div style={styles.topBarText}>
            🚀 RTX Pro Max Forex | ৳{CONTACT.monthlyAmount}/month | 🎁 5 Free Signals
          </div>
          <button style={styles.closeX} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {submitted ? (
          <div style={styles.successBox}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            <div style={styles.successTitle}>পেমেন্ট তথ্য জমা হয়েছে</div>
            <div style={styles.successText}>
              আমাদের এডমিন যাচাই করে কিছুক্ষণের মধ্যে আপনার Premium একাউন্ট চালু করে দেবেন।
              অনুগ্রহ করে অপেক্ষা করুন।
            </div>
            <button style={styles.closeBtn} onClick={onClose}>
              ঠিক আছে
            </button>
          </div>
        ) : (
          <>
            <div style={styles.hero}>
              <div style={styles.heroTitle}>💎 Premium Membership</div>
              <div style={styles.heroSubtitle}>
                5 Institutional-Grade Strategy Modes — Now for Forex
              </div>
              <div style={styles.priceBox}>৳{CONTACT.monthlyAmount}<span style={styles.perMonth}>/মাস</span></div>
            </div>

            <div style={styles.payBox}>
              <div style={styles.payLabel}>bKash / Nagad নাম্বারে Send Money করুন:</div>
              <div style={styles.numberRow} onClick={handleCopyNumber}>
                <span style={styles.number}>{CONTACT.paymentNumber}</span>
                <span style={styles.copyTag}>{copied ? '✅ Copied' : '📋 Tap to copy'}</span>
              </div>
            </div>

            <div style={styles.form}>
              <label style={styles.label}>আপনার ফোন নাম্বার</label>
              <input
                style={styles.input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                inputMode="tel"
              />

              <label style={styles.label}>Amount (৳)</label>
              <input
                style={styles.input}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
              />

              <label style={styles.label}>Transaction ID (TrxID)</label>
              <input
                style={styles.input}
                value={trxId}
                onChange={(e) => setTrxId(e.target.value)}
                placeholder="যেমন: 9XK3PLM2QZ"
              />

              {error && <div style={styles.errorText}>{error}</div>}

              <button style={styles.submitBtn} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'পাঠানো হচ্ছে...' : '✅ পেমেন্ট নিশ্চিত করুন'}
              </button>
            </div>

            <div style={styles.supportLine}>
              সমস্যা হলে সাপোর্টে যোগাযোগ করুন:{' '}
              <a href={CONTACT.support} target="_blank" rel="noreferrer" style={styles.supportLink}>
                {CONTACT.support}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: C.bg,
    zIndex: 200,
    overflowY: 'auto',
  },
  page: { padding: 16, maxWidth: 480, margin: '0 auto' },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: C.panel,
    border: `1px solid ${C.gold}55`,
    borderRadius: 10,
    padding: '8px 12px',
    marginBottom: 16,
  },
  topBarText: { fontSize: 11, fontWeight: 700, color: C.gold },
  closeX: {
    background: 'transparent',
    border: 'none',
    color: C.muted,
    fontSize: 18,
    cursor: 'pointer',
  },
  hero: { textAlign: 'center', marginBottom: 18 },
  heroTitle: { fontSize: 22, fontWeight: 800, color: C.text },
  heroSubtitle: { fontSize: 12, color: C.muted, marginTop: 6 },
  priceBox: { fontSize: 34, fontWeight: 900, color: C.gold, marginTop: 14 },
  perMonth: { fontSize: 14, color: C.muted, fontWeight: 600 },
  payBox: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  payLabel: { fontSize: 12, color: C.muted, marginBottom: 8 },
  numberRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: C.panel,
    border: `1px solid ${C.cyan}55`,
    borderRadius: 10,
    padding: '12px 14px',
    cursor: 'pointer',
  },
  number: { fontSize: 18, fontWeight: 800, color: C.cyan, letterSpacing: 0.5 },
  copyTag: { fontSize: 11, color: C.muted, fontWeight: 600 },
  form: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 11, fontWeight: 700, color: C.muted, marginTop: 10, marginBottom: 4 },
  input: {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '10px 12px',
    color: C.text,
    fontSize: 13,
    boxSizing: 'border-box',
  },
  errorText: { fontSize: 12, color: C.red, marginTop: 10, fontWeight: 600 },
  submitBtn: {
    marginTop: 18,
    background: C.green,
    border: 'none',
    borderRadius: 10,
    padding: '13px 0',
    color: '#04120c',
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
  },
  supportLine: { textAlign: 'center', fontSize: 11, color: C.muted, marginTop: 18 },
  supportLink: { color: C.cyan },
  successBox: { textAlign: 'center', padding: '40px 10px' },
  successTitle: { fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 10 },
  successText: { fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 22 },
  closeBtn: {
    background: C.cyan,
    border: 'none',
    borderRadius: 10,
    padding: '11px 26px',
    color: '#041018',
    fontWeight: 800,
    cursor: 'pointer',
  },
        }
