// server.js — payment/trial ONLY
// ✅ FINAL VERSION:
// - Admin ID verification for BOTH callback query AND legacy text commands
// - Node 18+ requirement documented
// - CORS improved

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
    console.error('🔥 FIREBASE_SERVICE_ACCOUNT_B64 not set')
  }
} catch (e) {
  console.error('🔥 Firebase admin init failed:', e.message)
  db = null
}

// ⚠️ Requires Node.js 18+ (for global fetch)
if (typeof fetch === 'undefined') {
  console.error('🔥 CRITICAL: This server requires Node.js 18+ (global fetch not found)')
  process.exit(1)
}

const app = express()

const FRONTEND_URL = process.env.FRONTEND_URL
if (FRONTEND_URL) {
  app.use(cors({ origin: FRONTEND_URL }))
  console.log(`✅ CORS restricted to: ${FRONTEND_URL}`)
} else {
  console.warn('⚠️ FRONTEND_URL not set — CORS is wide open. Set it in production!')
  app.use(cors())
}

app.use(express.json())

const FREE_TRIAL_LIMIT = 5
const BOT_TOKEN = process.env.BOT_TOKEN
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const SELF_URL = process.env.RENDER_EXTERNAL_URL
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null

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

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    firebase: db ? 'connected' : 'disconnected',
    webhookConfigured: !!(BOT_TOKEN && WEBHOOK_SECRET && SELF_URL),
    adminIdSet: !!ADMIN_TELEGRAM_ID,
    time: new Date().toISOString(),
  })
})

app.post('/api/check-status', async (req, res) => {
  try {
    const { userId } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    if (!db) return res.status(503).json({ error: 'Database unavailable' })

    const trialRef = db.collection('forex_trials').doc(String(userId))
    const trialSnap = await trialRef.get()

    let signalsUsed = 0
    if (trialSnap.exists) {
      signalsUsed = trialSnap.data().signalsUsed || 0
    } else {
      await trialRef.set({
        signalsUsed: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    const userRef = db.collection('forex_users').doc(String(userId))
    const userSnap = await userRef.get()
    const isPremium =
      userSnap.exists &&
      userSnap.data().premiumUntil &&
      userSnap.data().premiumUntil.toDate() > new Date()

    if (req.body.consume && !isPremium) {
      await trialRef.update({
        signalsUsed: admin.firestore.FieldValue.increment(1),
      })
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

app.post('/api/notify-payment', async (req, res) => {
  const { paymentId, userId, phone, trxId } = req.body || {}
  if (!paymentId) return res.status(400).json({ error: 'paymentId is required' })

  if (!BOT_TOKEN || !ADMIN_TELEGRAM_ID) {
    console.error('BOT_TOKEN / ADMIN_TELEGRAM_ID not set')
    return res.json({
      ok: false,
      warning: 'Payment saved, but admin notification failed — missing config.',
    })
  }

  const text =
    `💰 নতুন পেমেন্ট রিকোয়েস্ট\n\n` +
    `Payment ID: ${paymentId}\n` +
    `Telegram User ID: ${userId || 'N/A'}\n` +
    `Phone: ${phone || 'N/A'}\n` +
    `TrxID: ${trxId || 'N/A'}\n\n` +
    `নিচের বাটনে ট্যাপ করে অনুমোদন বা প্রত্যাখ্যান করুন।`

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
      warning: `Payment saved, but Telegram notification failed (${tgData.description || 'unknown'}).`,
    })
  }

  return res.json({ ok: true })
})

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
    console.error(`Payment ${paymentId} has no userId — cannot grant Premium.`)
    return { ok: false, message: 'Payment approved but has no userId — Premium NOT granted.' }
  }

  const premiumUntil = new Date()
  premiumUntil.setDate(premiumUntil.getDate() + 30)
  await db
    .collection('forex_users')
    .doc(String(payment.userId))
    .set({ premiumUntil }, { merge: true })

  return {
    ok: true,
    message: `Premium granted to user ${payment.userId} until ${premiumUntil.toDateString()}`,
  }
}

async function rejectPayment(paymentId) {
  if (!db) return { ok: false, message: 'Database unavailable' }
  await db.collection('forex_payments').doc(paymentId).update({ status: 'rejected' })
  return { ok: true, message: `Payment ${paymentId} rejected` }
}

app.post('/webhook/:secret', async (req, res) => {
  try {
    if (req.params.secret !== WEBHOOK_SECRET) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (!db) return res.status(503).json({ error: 'Database unavailable' })

    // ── Path (a): inline button callback ──
    const callbackQuery = req.body?.callback_query
    if (callbackQuery) {
      // ✅ SECURITY: verify caller is the admin
      const callerId = String(callbackQuery.from?.id || '')
      if (callerId !== String(ADMIN_TELEGRAM_ID)) {
        console.warn(`⚠️ Unauthorized callback from ${callerId}`)
        await telegramApi('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: '❌ Unauthorized',
          show_alert: true,
        })
        return res.json({ ok: true })
      }

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
        resultText = result.ok
          ? `✅ অনুমোদিত হয়েছে\n\n${originalText}`
          : `⚠️ ${result.message}\n\n${originalText}`
        toastText = result.ok ? '✅ Approved & Premium granted' : `⚠️ ${result.message}`
      } else if (rejectMatch) {
        const result = await rejectPayment(rejectMatch[1])
        resultText = result.ok
          ? `❌ প্রত্যাখ্যাত হয়েছে\n\n${originalText}`
          : `⚠️ ${result.message}\n\n${originalText}`
        toastText = result.ok ? '❌ Rejected' : `⚠️ ${result.message}`
      }

      await telegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: toastText.slice(0, 200),
        show_alert: false,
      })

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

    // ── Path (b): legacy /approve_xxx text command ──
    const message = req.body?.message
    const text = message?.text || ''

    const approveMatch = text.match(/^\/approve_(.+)/)
    const rejectMatch = text.match(/^\/reject_(.+)/)

    if (approveMatch || rejectMatch) {
      // ✅ SECURITY: verify sender is the admin
      const senderId = String(message?.from?.id || '')
      if (senderId !== String(ADMIN_TELEGRAM_ID)) {
        console.warn(`⚠️ Unauthorized text command from ${senderId}`)
        return res.json({ ok: true })
      }

      if (approveMatch) {
        await approvePayment(approveMatch[1])
      } else if (rejectMatch) {
        await rejectPayment(rejectMatch[1])
      }
    }

    res.json({ ok: true })
  } catch (e) {
    console.error('POST /webhook/:secret failed:', e.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

async function registerTelegramWebhook() {
  if (!BOT_TOKEN || !WEBHOOK_SECRET || !SELF_URL) {
    console.error(
      '⚠️ Skipping webhook registration — BOT_TOKEN, WEBHOOK_SECRET, or RENDER_EXTERNAL_URL missing.'
    )
    return
  }

  const webhookUrl = `${SELF_URL.replace(/\/$/, '')}/webhook/${WEBHOOK_SECRET}`
  const data = await telegramApi('setWebhook', { url: webhookUrl })

  if (data.ok) {
    console.log(`✅ Telegram webhook registered: ${webhookUrl}`)
  } else {
    console.error('🔥 setWebhook FAILED:', data.description || data)
  }
}

setInterval(async () => {
  if (!db) return
  try {
    const now = new Date()
    const expiredSnap = await db
      .collection('forex_users')
      .where('premiumUntil', '<', now)
      .get()
    const batch = db.batch()
    expiredSnap.forEach((doc) => batch.update(doc.ref, { premiumUntil: null }))
    if (!expiredSnap.empty) await batch.commit()
  } catch (e) {
    console.error('Hourly expiry sweep failed:', e.message)
  }
}, 60 * 60 * 1000)

const SELF_PING_INTERVAL_MS = 5 * 60 * 1000

if (SELF_URL) {
  setInterval(() => {
    fetch(`${SELF_URL}/health`)
      .then((res) => {
        if (!res.ok) console.error(`Self-ping non-OK: ${res.status}`)
      })
      .catch((e) => console.error('Self-ping failed:', e.message))
  }, SELF_PING_INTERVAL_MS)
} else {
  console.error('⚠️ RENDER_EXTERNAL_URL not set — self-ping disabled')
}

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 RTX Pro Max Forex backend running on port ${PORT}`)
  registerTelegramWebhook()
})
