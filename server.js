// server.js — 🔴 payment/trial ONLY. Zero Twelve Data calls, zero API-key
// handling, zero signal-generation logic. If any of that logic ends up here,
// it's wrong — it belongs in the frontend (twelveDataClient.js / signalEngine.js).
//
// ── FIXES IN THIS VERSION ───────────────────────────────────────────────
// 1. 🔴 Telegram webhook is now REGISTERED automatically on boot via
//    `setWebhook`. Before, nothing ever told Telegram where to send
//    /approve_xxx and /reject_xxx admin messages, so the bot never called
//    our /webhook/:secret route at all — the admin's commands went nowhere.
// 2. 🔴 notify-payment now actually checks Telegram's API response. Before,
//    a bad BOT_TOKEN / ADMIN_TELEGRAM_ID / admin never having pressed
//    "Start" on the bot would fail silently and nobody would know why no
//    notification arrived.
// 3. 🔴 Premium status is now saved to forex_users/{userId} — the same
//    Telegram userId the frontend uses in /api/check-status. Before, this
//    was saved under forex_users/{phone}, which never matched the id
//    check-status queried by, so approved users never actually became
//    Premium in the app.
// 4. /api/notify-payment and the webhook now require/pass `userId` end to
//    end: PaymentPage.jsx -> Firestore forex_payments doc -> Telegram admin
//    message -> /approve_xxx handler -> forex_users/{userId}.

const express = require('express')
const cors = require('cors')

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
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const SELF_URL = process.env.RENDER_EXTERNAL_URL

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    firebase: db ? 'connected' : 'disconnected',
    webhookConfigured: !!(BOT_TOKEN && WEBHOOK_SECRET && SELF_URL),
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

    // 🔴 Premium is now looked up by the SAME userId the frontend sends —
    // this is the id that /webhook/:secret writes to after admin approval.
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
// Body: { paymentId, userId, phone, trxId }
// Pings the admin on Telegram so they can approve/reject the payment that
// the frontend already wrote to forex_payments/{paymentId} in Firestore.
//
// 🔴 This now VERIFIES Telegram actually accepted the message and returns a
// clear ok/warning to the caller instead of silently swallowing failures.
// ---------------------------------------------------------------------------
app.post('/api/notify-payment', async (req, res) => {
  const { paymentId, userId, phone, trxId } = req.body || {}
  if (!paymentId) return res.status(400).json({ error: 'paymentId is required' })

  if (!BOT_TOKEN || !ADMIN_TELEGRAM_ID) {
    console.error('BOT_TOKEN / ADMIN_TELEGRAM_ID not set — cannot notify admin.')
    return res.json({
      ok: false,
      warning:
        'Payment record was saved, but the server is missing BOT_TOKEN or ADMIN_TELEGRAM_ID, so no Telegram notification could be sent. Check Render environment variables.',
    })
  }

  const text =
    `💰 নতুন পেমেন্ট রিকোয়েস্ট\n\n` +
    `Payment ID: ${paymentId}\n` +
    `Telegram User ID: ${userId || 'N/A'}\n` +
    `Phone: ${phone || 'N/A'}\n` +
    `TrxID: ${trxId || 'N/A'}\n\n` +
    `অনুমোদন করতে /approve_${paymentId} অথবা প্রত্যাখ্যান করতে /reject_${paymentId} পাঠান।`

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_TELEGRAM_ID, text }),
    })
    const tgData = await tgRes.json()

    // 🔴 Telegram's sendMessage can return HTTP 200 with { ok: false } (e.g.
    // "chat not found" if the admin never pressed Start on the bot, or a bad
    // ADMIN_TELEGRAM_ID) — checking tgRes.ok alone would miss this.
    if (!tgRes.ok || !tgData.ok) {
      console.error('Telegram sendMessage rejected:', tgData.description || tgData)
      return res.json({
        ok: false,
        warning: `Payment record was saved, but Telegram did not deliver the admin notification (${
          tgData.description || 'unknown reason'
        }). Make sure ADMIN_TELEGRAM_ID is correct and the admin has pressed "Start" on the bot at least once.`,
      })
    }

    return res.json({ ok: true })
  } catch (e) {
    console.error('POST /api/notify-payment failed:', e.message)
    // Don't fail the request hard — the payment record already exists in
    // Firestore even if this notification ping fails.
    return res.json({ ok: false, warning: 'Notification request failed, but payment record was saved.' })
  }
})

// ---------------------------------------------------------------------------
// POST /webhook/:secret
// Telegram bot webhook — handles /approve_xxx and /reject_xxx admin commands.
// ---------------------------------------------------------------------------
app.post('/webhook/:secret', async (req, res) => {
  try {
    if (req.params.secret !== WEBHOOK_SECRET) {
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

        // 🔴 THE CORE FIX: premium is now keyed by the Telegram userId that
        // PaymentPage.jsx saved onto the payment doc — the exact same id
        // /api/check-status looks up. Previously this used `payment.phone`,
        // which never matched, so approval never actually unlocked Premium.
        if (payment.userId) {
          const premiumUntil = new Date()
          premiumUntil.setDate(premiumUntil.getDate() + 30)
          await db.collection('forex_users').doc(payment.userId).set({ premiumUntil }, { merge: true })
        } else {
          console.error(
            `Payment ${paymentId} has no userId field — cannot grant Premium. This payment predates the userId fix or PaymentPage failed to attach it.`
          )
        }
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
// 🔴 Auto-register the Telegram webhook on boot.
// Before this fix, nothing ever called Telegram's `setWebhook` API, so
// Telegram had no idea our /webhook/:secret route existed — admin commands
// like /approve_xxx were just normal messages that went nowhere.
// ---------------------------------------------------------------------------
async function registerTelegramWebhook() {
  if (!BOT_TOKEN || !WEBHOOK_SECRET || !SELF_URL) {
    console.error(
      '⚠️ Skipping Telegram webhook registration — BOT_TOKEN, WEBHOOK_SECRET, or RENDER_EXTERNAL_URL is missing. ' +
        'Admin /approve_xxx and /reject_xxx commands will NOT work until all three are set.'
    )
    return
  }

  const webhookUrl = `${SELF_URL.replace(/\/$/, '')}/webhook/${WEBHOOK_SECRET}`

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    })
    const data = await res.json()

    if (!res.ok || !data.ok) {
      console.error('🔥 Telegram setWebhook FAILED:', data.description || data)
      return
    }

    console.log(`✅ Telegram webhook registered: ${webhookUrl}`)
  } catch (e) {
    console.error('🔥 Telegram setWebhook request failed:', e.message)
  }
}

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
// 🔴 Render's free tier spins a web service down after ~15 minutes of no
// inbound traffic. Pinging every 10 minutes left too thin a margin (a slow
// or delayed tick could let the service fall asleep before the next ping).
// Every 5 minutes keeps comfortably inside that window.
// ---------------------------------------------------------------------------
const SELF_PING_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

if (SELF_URL) {
  setInterval(() => {
    fetch(`${SELF_URL}/health`)
      .then((res) => {
        if (!res.ok) {
          console.error(`Self-ping got non-OK status: ${res.status}`)
        }
      })
      .catch((e) => console.error('Self-ping failed:', e.message))
  }, SELF_PING_INTERVAL_MS)
} else {
  console.error(
    '⚠️ RENDER_EXTERNAL_URL not set — self-ping is disabled, so this service may spin down after ~15 minutes of inactivity on Render\'s free tier.'
  )
}

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 RTX Pro Max Forex backend running on port ${PORT}`)
  registerTelegramWebhook()
})
