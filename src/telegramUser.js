// telegramUser.js — 🔴 SINGLE SOURCE for reading the current Telegram user's
// identity. Every file that needs `userId` (PaymentPage.jsx, ForexSection.jsx,
// App.jsx) must import from here — never read window.Telegram directly
// anywhere else. This is what was missing before: nothing in the codebase
// captured the Telegram user id, so the backend had no reliable key to save
// premium status against.
//
// 🔴 Fallback strategy: Telegram Mini Apps always inject
// window.Telegram.WebApp.initDataUnsafe.user.id when opened inside Telegram.
// If that's ever missing (e.g. testing in a plain browser), we fall back to
// a locally-generated persistent id so the app doesn't crash — but we flag
// that fallback clearly, because a browser-only id is NOT a real Telegram
// identity and premium/trial state tied to it won't survive a cleared
// localStorage or a different device.

const FALLBACK_ID_KEY = 'rtx_fallback_user_id'

function getTelegramWebApp() {
  try {
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
      return window.Telegram.WebApp
    }
  } catch (e) {
    console.error('telegramUser: failed to access window.Telegram.WebApp:', e.message)
  }
  return null
}

// Call this once on app boot (App.jsx) so Telegram knows the Mini App is
// ready — this also unlocks safe-area/theme params on some clients. Safe to
// call multiple times; Telegram no-ops repeat calls.
export function initTelegramWebApp() {
  const tg = getTelegramWebApp()
  if (!tg) return
  try {
    tg.ready()
    tg.expand()
  } catch (e) {
    console.error('telegramUser: tg.ready()/expand() failed:', e.message)
  }
}

function generateFallbackId() {
  // Not a real Telegram id — only used so the app has *some* stable key when
  // running outside Telegram (e.g. local dev in a normal browser tab).
  return 'local_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function getOrCreateFallbackId() {
  try {
    let id = localStorage.getItem(FALLBACK_ID_KEY)
    if (!id) {
      id = generateFallbackId()
      localStorage.setItem(FALLBACK_ID_KEY, id)
    }
    return id
  } catch (e) {
    console.error('telegramUser: failed to read/write fallback id:', e.message)
    // Last resort — non-persistent, but keeps the app from crashing.
    return generateFallbackId()
  }
}

// 🔴 The one function everything else should call. Returns a STRING userId,
// never null/undefined, so callers never need their own null-check branch.
//
// Returns { userId, isRealTelegramUser } — callers that gate payments/trial
// on a genuine Telegram identity (not a throwaway browser session) should
// check `isRealTelegramUser` and warn the person if false.
export function getTelegramUser() {
  const tg = getTelegramWebApp()
  const tgUser = tg && tg.initDataUnsafe && tg.initDataUnsafe.user

  if (tgUser && tgUser.id) {
    return {
      userId: String(tgUser.id),
      firstName: tgUser.first_name || '',
      username: tgUser.username || '',
      isRealTelegramUser: true,
    }
  }

  // Not running inside Telegram (or Telegram hasn't populated initDataUnsafe
  // yet) — fall back to a locally-persisted id so the rest of the app still
  // functions, but flag it so payment/trial screens can warn the user.
  return {
    userId: getOrCreateFallbackId(),
    firstName: '',
    username: '',
    isRealTelegramUser: false,
  }
    }
