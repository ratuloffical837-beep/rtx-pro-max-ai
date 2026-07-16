// server.js — 🔴 payment/trial ONLY. Zero Twelve Data calls, zero API-key
// handling, zero signal-generation logic. If any of that logic ends up here,
// it's wrong — it belongs in the frontend (twelveDataClient.js / signalEngine.js).

const express = require('express')
const cors = require('cors')
const crypto = require('crypto')

let admin = null
let db = null

try {
  admin = require('firebase-admin')
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64
  if (b64) {
    const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
    db = admin.firestore()
  } else {
    console.error('🔥 FIREBASE_SERVICE_ACCOUNT_B64 not set — Firestore features disabled.')
  }
} catch (e) {
  console.error('🔥 Firebase admin init failed:', e.message)
  db = null
}

const app = express()
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }))
app.use(express.json())

const FREE_TRIAL_LIMIT = 5
const BOT_TOKEN = process.env.BOT_TOKEN
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    firebase: db ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  })
})

// ---------------------------------------------------------------------------
// POST /api/check-status
// Body: { userId }
// Returns whether the user is Premium and how many free (lifetime) signals
// they have left. The backend is only the source of truth for the counter —
// it never sees the actual signal content or market data.
// ---------------------------------------------------------------------------
app.post('/api/check-status', async (req, res) => {
  try {
    const { userId } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    if (!db) return res.status(503).json({ error: 'Database unavailable' })

    const trialRef = db.collection('forex_trials').doc(userId)
    const trialSnap = await trialRef.get()

    let signalsUsed = 0
    if (trialSnap.exists) {
      signalsUsed = trialSnap.data().signalsUsed || 0
    } else {
      await trialRef.set({ signalsUsed: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() })
    }

    const userRef = db.collection('forex_users').doc(userId)
    const userSnap = await userRef.get()
    const isPremium = userSnap.exists && userSnap.data().premiumUntil && userSnap.data().premiumUntil.toDate() > new Date()

    // If this call is also being used to record a just-generated free
    // signal, increment here. Callers pass `consume: true` for that case.
    if (req.body.consume && !isPremium) {
      await trialRef.update({ signalsUsed: admin.firestore.FieldValue.increment(1) })
      signalsUsed += 1
    }

    res.json({
      isPremium: !!isPremium,
      signalsUsed,
      signalsRemaining: Math.max(FREE_TRIAL_LIMIT - signalsUsed, 0),
    })
  } catch (e) {
    console.error('POST /api/check-status failed:', e.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// ---------------------------------------------------------------------------
// POST /api/notify-payment
// Body: { paymentId, phone, trxId }
// Pings the admin on Telegram so they can approve/reject the payment that
// the frontend already wrote to forex_payments/{paymentId} in Firestore.
// ---------------------------------------------------------------------------
app.post('/api/notify-payment', async (req, res) => {
  try {
    const { paymentId, phone, trxId } = req.body || {}
    if (!paymentId) return res.status(400).json({ error: 'paymentId is required' })

    if (BOT_TOKEN && ADMIN_TELEGRAM_ID) {
      const text =
        `💰 নতুন পেমেন্ট রিকোয়েস্ট\n\n` +
        `Payment ID: ${paymentId}\n` +
        `Phone: ${phone || 'N/A'}\n` +
        `TrxID: ${trxId || 'N/A'}\n\n` +
        `অনুমোদন করতে /approve_${paymentId} অথবা প্রত্যাখ্যান করতে /reject_${paymentId} পাঠান।`

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: ADMIN_TELEGRAM_ID, text }),
      })
    } else {
      console.error('BOT_TOKEN / ADMIN_TELEGRAM_ID not set — skipping Telegram notify.')
    }

    res.json({ ok: true })
  } catch (e) {
    console.error('POST /api/notify-payment failed:', e.message)
    // Don't fail the request hard — the payment record already exists in
    // Firestore even if this notification ping fails.
    res.json({ ok: false, warning: 'Notification failed, but payment record was saved.' })
  }
})

// ---------------------------------------------------------------------------
// POST /webhook/:secret
// Telegram bot webhook — handles /approve_xxx and /reject_xxx admin commands.
// ---------------------------------------------------------------------------
app.post('/webhook/:secret', async (req, res) => {
  try {
    if (req.params.secret !== process.env.WEBHOOK_SECRET) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (!db) return res.status(503).json({ error: 'Database unavailable' })

    const message = req.body?.message
    const text = message?.text || ''

    const approveMatch = text.match(/^\/approve_(.+)/)
    const rejectMatch = text.match(/^\/reject_(.+)/)

    if (approveMatch) {
      const paymentId = approveMatch[1]
      const paymentRef = db.collection('forex_payments').doc(paymentId)
      const paymentSnap = await paymentRef.get()
      if (paymentSnap.exists) {
        const payment = paymentSnap.data()
        await paymentRef.update({ status: 'approved' })

        const premiumUntil = new Date()
        premiumUntil.setDate(premiumUntil.getDate() + 30)
        await db
          .collection('forex_users')
          .doc(payment.phone || paymentId)
          .set({ premiumUntil }, { merge: true })
      }
    } else if (rejectMatch) {
      const paymentId = rejectMatch[1]
      await db.collection('forex_payments').doc(paymentId).update({ status: 'rejected' })
    }

    res.json({ ok: true })
  } catch (e) {
    console.error('POST /webhook/:secret failed:', e.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// ---------------------------------------------------------------------------
// Auto-expire check — hourly sweep for expired Premium users.
// ---------------------------------------------------------------------------
setInterval(async () => {
  if (!db) return
  try {
    const now = new Date()
    const expiredSnap = await db.collection('forex_users').where('premiumUntil', '<', now).get()
    const batch = db.batch()
    expiredSnap.forEach((doc) => batch.update(doc.ref, { premiumUntil: null }))
    if (!expiredSnap.empty) await batch.commit()
  } catch (e) {
    console.error('Hourly expiry sweep failed:', e.message)
  }
}, 60 * 60 * 1000)

// ---------------------------------------------------------------------------
// Self-ping — keeps free-tier hosting awake.
// ---------------------------------------------------------------------------
const SELF_URL = process.env.RENDER_EXTERNAL_URL
if (SELF_URL) {
  setInterval(() => {
    fetch(`${SELF_URL}/health`).catch((e) => console.error('Self-ping failed:', e.message))
  }, 10 * 60 * 1000)
}

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 RTX Pro Max Forex backend running on port ${PORT}`)
})
