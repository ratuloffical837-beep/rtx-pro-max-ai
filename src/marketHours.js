// marketHours.js — approximate Forex session check (24/5 market).
// 🔴 This is an approximation based on UTC time, not a broker feed. Good
// enough to show/hide the "Market Closed" banner; do not present it as
// exact-to-the-second.

export function isForexMarketOpen(date = new Date()) {
  const day = date.getUTCDay() // 0 = Sunday, 6 = Saturday
  const hour = date.getUTCHours()

  if (day === 6) return false // all Saturday: closed
  if (day === 0 && hour < 21) return false // Sunday before ~21:00 UTC: closed
  if (day === 5 && hour >= 21) return false // Friday from ~21:00 UTC: closed
  return true
}

// Human-readable Bengali label for "খুলবে ___" in the Market Closed banner.
export function nextOpenDayLabel(date = new Date()) {
  const day = date.getUTCDay()

  // Market reopens Sunday ~21:00 UTC, so from the closed-window's
  // perspective it always reopens on "Sunday" evening (UTC), which for most
  // Bangladesh-time users lands on Monday morning locally.
  if (day === 5 || day === 6) return 'সোমবার'
  if (day === 0) return 'আজ রাতে (সোমবার সকাল, বাংলাদেশ সময়)'
  return 'শীঘ্রই'
    }
