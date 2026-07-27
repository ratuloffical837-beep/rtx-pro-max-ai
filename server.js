// server.js — 🔴 payment/trial ONLY. Zero Twelve Data calls, zero API-key
// handling, zero signal-generation logic. If any of that logic ends up here,
// it's wrong — it belongs in the frontend (twelveDataClient.js / signalEngine.js).
//
// ── FIXES IN THIS VERSION ───────────────────────────────────────────────
// 1. Telegram webhook is registered automatically on boot via `setWebhook`.
// 2. notify-payment verifies Telegram's API response instead of failing silently.
// 3. Premium is saved to forex_users/{userId} (the Telegram user id), matching
//    what /api/check-status looks up — not forex_users/{phone}.
// 4. Self-ping every 5 minutes (was 10) to stay safely inside Render free
//    tier's ~15 minute idle-sleep window.
// 5. 🔴 NEW: the admin notification now sends REAL Telegram inline buttons
//    (✅ Approve / ❌ Reject) via `reply_markup.inline_keyboard`, instead of
//    plain `/approve_xxx` text. Telegram auto-linkifies bare slash-commands
//    in a message, which is why it looked like "just a link" before — that
//    was never a tappable button, just Telegram's command-link styling.
//    Tapping an inline button now fires a `callback_query` update, handled
//    below, which approves/rejects immediately, answers the callback (so
//    the button's loading spinner clears), and edits the original message
//    to show the final "✅ Approved" / "❌ Rejected" state so it can't be
//    tapped twice. The old `/approve_xxx` / `/reject_xxx` text-command path
//    is kept as a fallback in case an admin ever types a command manually.

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
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null

// Small shared helper — every Telegram Bot API call goes through this so
// error-checking (HTTP status AND Telegram's own {ok:false} payloads) is
// consistent everywhere instead of repeated ad hoc per call site.
async function telegramApi(method, body) {
  if (!TELEGRAM_API) {
    return { ok: false, description: 'BOT_TOKEN not configured' }
  }
  try {
    const res = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok || !data.ok) {
      console.error(`Telegram ${method} rejected:`, data.description || data)
    }
    return data
  } catch (e) {
    console.error(`Telegram ${method} request failed:`, e.message)
    return { ok: false, description: e.message }
  }
}

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
// 🔴 Now sends real inline Approve/Reject buttons instead of plain text
// commands, and verifies Telegram actually accepted the message.
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
    `নিচের বাটনে ট্যাপ করে অনুমোদন বা প্রত্যাখ্যান করুন।`

  // 🔴 Real inline keyboard — callback_data carries the paymentId so the
  // callback_query handler below knows exactly which record to act on.
  // Telegram callback_data has a 64-byte limit; Firestore auto-ids (~20
  // chars) comfortably fit inside "approve_"/"reject_" + id.
  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `approve_${paymentId}` },
        { text: '❌ Reject', callback_data: `reject_${paymentId}` },
      ],
    ],
  }

  const tgData = await telegramApi('sendMessage', {
    chat_id: ADMIN_TELEGRAM_ID,
    text,
    reply_markup: replyMarkup,
  })

  if (!tgData.ok) {
    return res.json({
      ok: false,
      warning: `Payment record was saved, but Telegram did not deliver the admin notification (${
        tgData.description || 'unknown reason'
      }). Make sure ADMIN_TELEGRAM_ID is correct and the admin has pressed "Start" on the bot at least once.`,
    })
  }

  return res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Shared approve/reject logic — used by BOTH the inline-button callback
// handler and the legacy /approve_xxx text-command fallback, so the two
// paths can never drift out of sync with each other.
// ---------------------------------------------------------------------------
async function approvePayment(paymentId) {
  if (!db) return { ok: false, message: 'Database unavailable' }

  const paymentRef = db.collection('forex_payments').doc(paymentId)
  const paymentSnap = await paymentRef.get()

  if (!paymentSnap.exists) {
    return { ok: false, message: `Payment ${paymentId} not found` }
  }

  const payment = paymentSnap.data()
  await paymentRef.update({ status: 'approved' })

  if (!payment.userId) {
    console.error(
      `Payment ${paymentId} has no userId field — cannot grant Premium. This payment predates the userId fix or PaymentPage failed to attach it.`
    )
    return { ok: false, message: 'Payment approved but has no userId — Premium NOT granted. Check Firestore manually.' }
  }

  // 🔴 THE CORE FIX: keyed by Telegram userId — the same id
  // /api/check-status looks up — not phone.
  const premiumUntil = new Date()
  premiumUntil.setDate(premiumUntil.getDate() + 30)
  await db.collection('forex_users').doc(payment.userId).set({ premiumUntil }, { merge: true })

  return { ok: true, message: `Premium granted to user ${payment.userId} until ${premiumUntil.toDateString()}` }
}

async function rejectPayment(paymentId) {
  if (!db) return { ok: false, message: 'Database unavailable' }
  await db.collection('forex_payments').doc(paymentId).update({ status: 'rejected' })
  return { ok: true, message: `Payment ${paymentId} rejected` }
}

// ---------------------------------------------------------------------------
// POST /webhook/:secret
// Telegram bot webhook — handles BOTH:
//   (a) callback_query from the inline Approve/Reject buttons (primary path)
//   (b) /approve_xxx and /reject_xxx typed text commands (fallback path)
// ---------------------------------------------------------------------------
app.post('/webhook/:secret', async (req, res) => {
  try {
    if (req.params.secret !== WEBHOOK_SECRET) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (!db) return res.status(503).json({ error: 'Database unavailable' })

    // ── Path (a): inline button tap ──────────────────────────────────
    const callbackQuery = req.body?.callback_query
    if (callbackQuery) {
      const data = callbackQuery.data || ''
      const chatId = callbackQuery.message?.chat?.id
      const messageId = callbackQuery.message?.message_id
      const originalText = callbackQuery.message?.text || ''

      const approveMatch = data.match(/^approve_(.+)/)
      const rejectMatch = data.match(/^reject_(.+)/)

      let resultText = null
      let toastText = ''

      if (approveMatch) {
        const result = await approvePayment(approveMatch[1])
        resultText = result.ok ? `✅ অনুমোদিত হয়েছে\n\n${originalText}` : `⚠️ ${result.message}\n\n${originalText}`
        toastText = result.ok ? '✅ Approved & Premium granted' : `⚠️ ${result.message}`
      } else if (rejectMatch) {
        const result = await rejectPayment(rejectMatch[1])
        resultText = result.ok ? `❌ প্রত্যাখ্যাত হয়েছে\n\n${originalText}` : `⚠️ ${result.message}\n\n${originalText}`
        toastText = result.ok ? '❌ Rejected' : `⚠️ ${result.message}`
      }

      // 🔴 answerCallbackQuery is mandatory — without it, Telegram leaves the
      // button's tap-spinner stuck indefinitely on the admin's screen.
      await telegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: toastText.slice(0, 200), // Telegram caps toast text length
        show_alert: false,
      })

      // Edit the original message to show the final state and REMOVE the
      // buttons (empty inline_keyboard) so it can't be approved/rejected
      // twice by accident.
      if (chatId && messageId && resultText) {
        await telegramApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: resultText,
          reply_markup: { inline_keyboard: [] },
        })
      }

      return res.json({ ok: true })
    }

    // ── Path (b): legacy typed /approve_xxx or /reject_xxx text command ──
    const message = req.body?.message
    const text = message?.text || ''

    const approveMatch = text.match(/^\/approve_(.+)/)
    const rejectMatch = text.match(/^\/reject_(.+)/)

    if (approveMatch) {
      await approvePayment(approveMatch[1])
    } else if (rejectMatch) {
      await rejectPayment(rejectMatch[1])
    }

    res.json({ ok: true })
  } catch (e) {
    console.error('POST /webhook/:secret failed:', e.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// ---------------------------------------------------------------------------
// Auto-register the Telegram webhook on boot.
// ---------------------------------------------------------------------------
async function registerTelegramWebhook() {
  if (!BOT_TOKEN || !WEBHOOK_SECRET || !SELF_URL) {
    console.error(
      '⚠️ Skipping Telegram webhook registration — BOT_TOKEN, WEBHOOK_SECRET, or RENDER_EXTERNAL_URL is missing. ' +
        'Admin approve/reject buttons will NOT work until all three are set.'
    )
    return
  }

  const webhookUrl = `${SELF_URL.replace(/\/$/, '')}/webhook/${WEBHOOK_SECRET}`
  const data = await telegramApi('setWebhook', { url: webhookUrl })

  if (data.ok) {
    console.log(`✅ Telegram webhook registered: ${webhookUrl}`)
  } else {
    console.error('🔥 Telegram setWebhook FAILED:', data.description || data)
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
// Self-ping — keeps free-tier hosting awake. Every 5 minutes, safely inside
// Render free tier's ~15 minute idle-sleep window.
// ---------------------------------------------------------------------------
const SELF_PING_INTERVAL_MS = 5 * 60 * 1000

if (SELF_URL) {
  setInterval(() => {
    fetch(`${SELF_URL}/health`)
      .then((res) => {
        if (!res.ok) console.error(`Self-ping got non-OK status: ${res.status}`)
      })
      .catch((e) => console.error('Self-ping failed:', e.message))
  }, SELF_PING_INTERVAL_MS)
} else {
  console.error(
    '⚠️ RENDER_EXTERNAL_URL not set — self-ping is disabled; this service may spin down after ~15 minutes of inactivity on Render\'s free tier.'
  )
}

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 RTX Pro Max Forex backend running on port ${PORT}`)
  registerTelegramWebhook()
})
