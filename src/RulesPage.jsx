import { useState } from 'react'
import { FIXED_RISK_PERCENT, MIN_RR_RATIO } from './constants.js'

// ── Colors (matches App.jsx / PaymentPage.jsx palette) ─────────
const C = {
  bg: '#0b0e11', card: '#141820', panel: '#1a1f2e',
  border: '#2b3139', text: '#e0e0e0', muted: '#666',
  green: '#0ecb81', red: '#f6465d', gold: '#f3ba2f', blue: '#60a5fa',
}

// ═══════════════════════════════════════════════════════════════
// FOREX CONVERSION NOTES (read this before editing)
// ─────────────────────────────────────────────────────────────
// The original file was written for binary options: fixed 85% payout,
// flat ৳100 stakes, and a "Martingale recovery" tab that doubled the stake
// after every loss to chase back cumulative losses. That entire model
// contradicts this app's own hard rule (constants.js FIXED_RISK_PERCENT,
// riskManager.js, MoneyManagementModal.jsx) that position size is NEVER
// increased after a loss — Martingale is explicitly banned in the master
// spec because it's the single most common cause of account blowups.
//
// This version replaces the Martingale tab with a "Fixed 1% Risk System"
// tab that explains the REAL system this app runs: every trade risks
// exactly 1% of account balance regardless of win/loss streaks, sized in
// lots via pip distance (pipUtils.js), with partial profit-taking across
// TP1/TP2/TP3 (50%/30%/20%, matching signalEngine.js's buildPositionSizing
// split). The compounding tab is now driven by R-multiples and Risk:Reward
// (constants.js MIN_RR_RATIO = 1.5), NOT a fictional guaranteed daily %,
// and is explicitly labeled as a hypothetical scenario, not a promise.
// ═══════════════════════════════════════════════════════════════

const RISK_PCT = FIXED_RISK_PERCENT * 100 // 1
const START_BALANCE = 5000

// ── Fixed 1% Risk System — worked example table ──────────────────
// Shows: if SL is hit, loss is always exactly 1% of CURRENT balance,
// never a fixed dollar amount and never increased after a loss.
const genFixedRiskSteps = () => {
  const rows = []
  let bal = START_BALANCE
  // Illustrative sequence: L, L, W(1.5R), L, W(2R) — mixed, not cherry-picked all-wins
  const sequence = [
    { result: 'LOSS', rMultiple: -1 },
    { result: 'LOSS', rMultiple: -1 },
    { result: 'WIN', rMultiple: 1.5 }, // TP1 hit
    { result: 'LOSS', rMultiple: -1 },
    { result: 'WIN', rMultiple: 2.2 }, // blended TP1+TP2 hit
  ]
  sequence.forEach((s, i) => {
    const riskAmount = +(bal * FIXED_RISK_PERCENT).toFixed(2)
    const pnl = +(riskAmount * s.rMultiple).toFixed(2)
    const newBal = +(bal + pnl).toFixed(2)
    rows.push({ step: i + 1, prevBalance: bal, riskAmount, result: s.result, rMultiple: s.rMultiple, pnl, newBalance: newBal })
    bal = newBal
  })
  return rows
}
const fixedRiskSteps = genFixedRiskSteps()
const fixedRiskFinalBalance = fixedRiskSteps[fixedRiskSteps.length - 1].newBalance

// ── RR-based compounding scenarios ────────────────────────────────
// Instead of a fictional "guaranteed 10%/day," this models expected value
// in R-multiples across three WIN-RATE assumptions, using the app's own
// MIN_RR_RATIO floor (1.5) as the conservative average win size, and a
// fixed 1% risk per trade. All three are explicitly hypothetical — real
// win rates are never known in advance and vary by market condition.
const AVG_WIN_R = MIN_RR_RATIO // 1.5 — conservative: assumes most wins close near TP1, not TP3
const LOSS_R = 1 // a full stop-loss is, by definition, -1R

function genCompoundingScenario(winRatePct, trades = 20) {
  const winRate = winRatePct / 100
  const rows = []
  let bal = START_BALANCE
  const expectedRPerTrade = winRate * AVG_WIN_R - (1 - winRate) * LOSS_R
  for (let t = 1; t <= trades; t++) {
    const pnl = +(bal * FIXED_RISK_PERCENT * expectedRPerTrade).toFixed(2)
    const end = +(bal + pnl).toFixed(2)
    rows.push({ trade: t, start: bal, pnl, end })
    bal = end
  }
  return { rows, expectedRPerTrade, finalBalance: bal }
}

const scenarioConservative = genCompoundingScenario(45) // below breakeven at 1.5R — shown deliberately to prove risk is real
const scenarioModerate = genCompoundingScenario(55)
const scenarioOptimistic = genCompoundingScenario(65)

export default function RulesPage({ onClose = () => {} }) {
  const [tab, setTab] = useState('disclaimer') // disclaimer | riskSystem | compounding

  return (
    <div style={{
      position: 'fixed', inset: 0, background: C.bg, zIndex: 999,
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: C.card, borderBottom: `1px solid ${C.border}`,
        padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: C.gold }}>📜 রুল্স ও গাইড</div>
        <button onClick={onClose} style={{
          background: C.panel, border: `1px solid ${C.border}`, color: C.muted,
          borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
        }}>✕ বন্ধ</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 12px 0' }}>
        {[
          { key: 'disclaimer', label: '⚠️ নিয়মাবলী' },
          { key: 'riskSystem', label: '🎯 1% Risk System' },
          { key: 'compounding', label: '📈 Growth Scenarios' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '10px 6px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            cursor: 'pointer',
            background: tab === t.key ? `${C.gold}22` : C.panel,
            color: tab === t.key ? C.gold : C.muted,
            border: tab === t.key ? `2px solid ${C.gold}` : `1px solid ${C.border}`,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 14 }}>

        {/* ══════════ DISCLAIMER TAB ══════════ */}
        {tab === 'disclaimer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <div style={{ ...s.card, textAlign: 'center', border: `1px solid ${C.gold}44` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.gold }}>
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>বিসমিল্লাহির রাহমানির রাহিম</div>
            </div>

            <div style={{ ...s.card, border: `1px solid ${C.red}55` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.red, marginBottom: 8 }}>
                ⚠️ ঝুঁকি সম্পর্কিত সতর্কতা
              </div>
              <ul style={s.ul}>
                <li>ফরেক্স ট্রেডিং একটি <b style={{ color: C.red }}>উচ্চ-ঝুঁকিপূর্ণ</b> কার্যক্রম, বিশেষ করে লিভারেজ ব্যবহার করলে। এখানে টাকা হারানোর সম্ভাবনা সবসময় থাকে।</li>
                <li>এই অ্যাপের সিগনাল কোনো নিশ্চিত লাভের গ্যারান্টি না — এটি স্ট্রাকচার/প্রাইস-অ্যাকশন ভিত্তিক একটি সহায়ক টুল মাত্র, বিশেষজ্ঞ আর্থিক পরামর্শ না।</li>
                <li>আপনি যা বিনিয়োগ করছেন তা সম্পূর্ণ হারানোর সম্ভাবনা মেনে নিয়েই ট্রেড করুন।</li>
                <li>নিজের আর্থিক সিদ্ধান্তের দায়ভার সম্পূর্ণ আপনার নিজের — এই অ্যাপ, এর ডেভেলপার বা সিগনাল কোনো ক্ষতির দায় নেবে না।</li>
              </ul>
            </div>

            <div style={{ ...s.card, border: `1px solid ${C.gold}55` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 8 }}>
                💰 মানি ম্যানেজমেন্ট — এই অ্যাপের নীতি
              </div>
              <ul style={s.ul}>
                <li>প্রতি ট্রেডে ব্যালেন্সের ঠিক <b>{RISK_PCT}%</b> ঝুঁকি — এটাই একমাত্র নিয়ম, এবং এটি কোথাও এডিট করা যায় না।</li>
                <li>একদিনে সর্বোচ্চ ৩-৫টি ট্রেডের বেশি না করাই ভালো।</li>
                <li>লাভ বা লস — কোনোটাতেই আবেগের বশে ট্রেডের সাইজ বদলাবেন না।</li>
                <li>পরিকল্পনামতো ট্রেড করুন, আল্লাহর উপর ভরসা রাখুন — ফলাফল সবসময় আল্লাহর হাতে।</li>
              </ul>
            </div>

            <div style={{ ...s.card, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.blue, marginBottom: 8 }}>
                🚫 মার্টিঙ্গেল (লস কভার করতে সাইজ বাড়ানো) — এই অ্যাপে নিষিদ্ধ
              </div>
              <ul style={s.ul}>
                <li>লসের পর পরের ট্রেডের এমাউন্ট বাড়িয়ে আগের লস "কভার" করার কৌশল (Martingale) এই অ্যাপে <b style={{ color: C.red }}>সম্পূর্ণ সাপোর্ট করা হয় না</b> — কোথাও এমন কোনো অপশন বা ক্যালকুলেটর নেই।</li>
                <li>টানা কয়েকটি লসের পর সাইজ বাড়াতে থাকলে একটি একক খারাপ streak-এই পুরো অ্যাকাউন্ট শেষ হয়ে যেতে পারে — এটি অ্যাকাউন্ট উড়িয়ে দেওয়ার সবচেয়ে পরিচিত কারণ ("risk of ruin")।</li>
                <li>এর পরিবর্তে এই অ্যাপ সবসময় ফিক্সড {RISK_PCT}% ঝুঁকি সিস্টেম ব্যবহার করে — জিতুন বা হারুন, পরের ট্রেডের ঝুঁকির শতাংশ সবসময় একই থাকে। বিস্তারিত পরের ট্যাবে।</li>
              </ul>
            </div>

          </div>
        )}

        {/* ══════════ FIXED 1% RISK SYSTEM TAB ══════════ */}
        {tab === 'riskSystem' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <div style={{ ...s.card, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.gold, marginBottom: 4 }}>بِسْمِ اللَّهِ — আল্লাহর নামে শুরু</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.gold }}>FIXED {RISK_PCT}% RISK SYSTEM</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>
                নিয়ম: প্রতিটা ট্রেডে ঠিক কারেন্ট ব্যালেন্সের {RISK_PCT}% ঝুঁকি — এসএল পিপ দূরত্ব ও পেয়ার
                অনুযায়ী লট সাইজ স্বয়ংক্রিয়ভাবে হিসাব হয় (দেখুন Position Sizing বক্স)। জিতুন বা হারুন,
                পরের ট্রেডে ঝুঁকির শতাংশ কখনো বাড়ে না।
              </div>
              <div style={{ marginTop: 10, background: '#0d1117', borderRadius: 8, padding: '8px 12px', display: 'inline-block' }}>
                <span style={{ fontSize: 11, color: C.muted }}>উদাহরণ ব্যালেন্স: </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>৳{START_BALANCE.toLocaleString()}</span>
              </div>
            </div>

            <div style={s.card}>
              <div style={s.sectionLabel}>লট সাইজ যেভাবে হিসাব হয়</div>
              <ul style={s.ul}>
                <li><b>Risk Amount</b> = Balance × {RISK_PCT}% (প্রতি ট্রেডে)</li>
                <li><b>Lot Size</b> = Risk Amount ÷ (SL দূরত্ব pip-এ × pip value)</li>
                <li>SL যত দূরে (বেশি pip), লট সাইজ তত ছোট — এভাবেই ডলার-ঝুঁকি সবসময় একই থাকে, SL দূরত্ব যাই হোক না কেন।</li>
                <li>TP1/TP2/TP3-এ লাভ ভাগ করে বন্ধ করা হয়: ৫০% / ৩০% / ২০% — সম্পূর্ণ Position Sizing বক্সে দেখানো হয়।</li>
              </ul>
            </div>

            {/* Worked example — mixed win/loss sequence, NOT all-wins */}
            <div style={s.card}>
              <div style={{ ...s.sectionLabel, color: C.blue }}>উদাহরণ সিকোয়েন্স (মিশ্র WIN/LOSS)</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.7 }}>
                এই টেবিলে ইচ্ছাকৃতভাবে কিছু LOSS-ও দেখানো হয়েছে — বাস্তবে টানা WIN কখনো নিশ্চিত না।
                প্রতিটা ধাপে ঝুঁকির পরিমাণ ঐ মুহূর্তের ব্যালেন্সের ঠিক {RISK_PCT}%, এবং LOSS-এর পরেও
                পরের ট্রেডে ঝুঁকি বাড়ানো হয়নি।
              </div>
              <TableHead cols={['ধাপ', 'আগের ব্যালেন্স', 'ঝুঁকি (' + RISK_PCT + '%)', 'রেজাল্ট', 'P/L', 'নতুন ব্যালেন্স']} small />
              {fixedRiskSteps.map(r => (
                <TableRow key={r.step} small cells={[
                  r.step,
                  `৳${r.prevBalance.toLocaleString()}`,
                  `৳${r.riskAmount.toLocaleString()}`,
                  <span style={{ color: r.result === 'WIN' ? C.green : C.red, fontWeight: 700 }}>
                    {r.result === 'WIN' ? `WIN (${r.rMultiple}R)` : 'LOSS (-1R)'}
                  </span>,
                  <span style={{ color: r.pnl >= 0 ? C.green : C.red }}>{r.pnl >= 0 ? '+' : ''}৳{r.pnl.toLocaleString()}</span>,
                  <b>৳{r.newBalance.toLocaleString()}</b>,
                ]} />
              ))}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.7, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                ৩টি LOSS ও ২টি WIN-এর পরেও চূড়ান্ত ব্যালেন্স:{' '}
                <b style={{ color: fixedRiskFinalBalance >= START_BALANCE ? C.green : C.red }}>
                  ৳{fixedRiskFinalBalance.toLocaleString()}
                </b>{' '}
                — কারণ WIN-এর R-multiple (risk:reward) LOSS-এর চেয়ে বড়। এটি প্রমাণ করে কেন শুধু
                R:R ≥ 1:{MIN_RR_RATIO} মেনে চলা এবং সাইজ ফিক্সড রাখা জরুরি।
              </div>
            </div>

          </div>
        )}

        {/* ══════════ GROWTH SCENARIOS TAB (RR-based, not a guarantee) ══════════ */}
        {tab === 'compounding' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <div style={{ ...s.card, textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.gold }}>GROWTH SCENARIOS (হাইপোথেটিক্যাল)</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Risk:Reward ও Win-Rate ভিত্তিক — কোনো গ্যারান্টি না</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Badge label="স্টার্ট" value={`৳${START_BALANCE.toLocaleString()}`} color={C.blue} />
                <Badge label="রিস্ক/ট্রেড" value={`${RISK_PCT}%`} color={C.gold} />
                <Badge label="ন্যূনতম R:R" value={`1:${MIN_RR_RATIO}`} color={C.green} />
              </div>
            </div>

            <div style={{ ...s.card, border: `1px solid ${C.red}55` }}>
              <div style={{ fontSize: 11, color: C.red, lineHeight: 1.7 }}>
                ⚠️ <b>এটি কোনো প্রতিশ্রুতি না।</b> নিচের ৩টি দৃশ্যকল্প শুধু গাণিতিকভাবে দেখাচ্ছে যে একই{' '}
                {RISK_PCT}% ফিক্সড ঝুঁকিতে বিভিন্ন win-rate কেমন প্রভাব ফেলতে পারে, গড় win সাইজ ধরা
                হয়েছে {AVG_WIN_R}R (এই অ্যাপের ন্যূনতম R:R ফ্লোর অনুযায়ী, রক্ষণশীল ধারণা)। বাস্তব
                win-rate কখনো আগে থেকে জানা যায় না এবং মার্কেট কন্ডিশন অনুযায়ী বদলায় — এমনকি{' '}
                <b>Conservative দৃশ্যকল্পে ব্যালেন্স কমেও যেতে পারে</b>, যেমনটা নিচে ইচ্ছাকৃতভাবেই দেখানো হয়েছে।
              </div>
            </div>

            <ScenarioBlock
              title="🔴 Conservative — 45% Win Rate"
              subtitle={`Expected value/trade: ${scenarioConservative.expectedRPerTrade.toFixed(3)}R (breakeven-এর নিচে — এখানে ইচ্ছাকৃতভাবে দেখানো হচ্ছে যে কম win-rate-এ ঝুঁকি বাস্তব)`}
              rows={scenarioConservative.rows}
              finalBalance={scenarioConservative.finalBalance}
              color={C.red}
            />

            <ScenarioBlock
              title="🟡 Moderate — 55% Win Rate"
              subtitle={`Expected value/trade: ${scenarioModerate.expectedRPerTrade.toFixed(3)}R`}
              rows={scenarioModerate.rows}
              finalBalance={scenarioModerate.finalBalance}
              color={C.gold}
            />

            <ScenarioBlock
              title="🟢 Optimistic — 65% Win Rate"
              subtitle={`Expected value/trade: ${scenarioOptimistic.expectedRPerTrade.toFixed(3)}R`}
              rows={scenarioOptimistic.rows}
              finalBalance={scenarioOptimistic.finalBalance}
              color={C.green}
            />

            <div style={{ ...s.card, border: `1px solid ${C.border}` }}>
              <div style={{ ...s.sectionLabel, color: C.blue }}>রিস্ক ম্যানেজমেন্ট প্ল্যান</div>
              <ul style={s.ul}>
                <li>প্রতিটা ট্রেডে SL (Stop Loss) বাধ্যতামূলক ব্যবহার করুন</li>
                <li>R:R কমপক্ষে 1:{MIN_RR_RATIO} রাখুন — এর নিচের সিগন্যাল এই অ্যাপ নিজেই discard করে</li>
                <li>আবেগ দিয়ে না, পরিকল্পনা দিয়ে ট্রেড করুন — লসের পর সাইজ বাড়াবেন না</li>
                <li>একদিনে ৩-৫টির বেশি ট্রেড না করাই ভালো — ওভারট্রেডিং এড়িয়ে চলুন</li>
                <li>প্রতিটা ট্রেডের আগে বিসমিল্লাহ বলে শুরু করুন, ফলাফল আল্লাহর হাতে ছেড়ে দিন</li>
              </ul>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}

// ── Small sub-components ────────────────────────────────────────
function ScenarioBlock({ title, subtitle, rows, finalBalance, color }) {
  const displayRows = rows.filter((_, i) => i % 4 === 0 || i === rows.length - 1) // show every 4th trade to keep it compact
  return (
    <div style={s.card}>
      <div style={{ fontSize: 13, fontWeight: 800, color, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>{subtitle}</div>
      <TableHead cols={['ট্রেড #', 'শুরুর ব্যালেন্স', 'P/L', 'শেষ ব্যালেন্স']} small />
      {displayRows.map(r => (
        <TableRow key={r.trade} small cells={[
          r.trade,
          `৳${r.start.toLocaleString()}`,
          <span style={{ color: r.pnl >= 0 ? C.green : C.red }}>{r.pnl >= 0 ? '+' : ''}৳{r.pnl.toLocaleString()}</span>,
          <b style={{ color }}>৳{r.end.toLocaleString()}</b>,
        ]} />
      ))}
      <div style={{ fontSize: 11, color: C.muted, marginTop: 10, textAlign: 'center', borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
        {rows.length} ট্রেড পর (হাইপোথেটিক্যাল): <b style={{ color }}>৳{finalBalance.toLocaleString()}</b>
      </div>
    </div>
  )
}

function TableHead({ cols, small }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
      gap: 4, marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid ${C.border}`,
    }}>
      {cols.map((c, i) => (
        <div key={i} style={{ fontSize: small ? 9 : 10, color: C.muted, fontWeight: 700, textAlign: i === 0 ? 'left' : 'center' }}>{c}</div>
      ))}
    </div>
  )
}

function TableRow({ cells, small }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
      gap: 4, padding: small ? '5px 0' : '7px 0', borderBottom: `1px solid ${C.border}33`,
    }}>
      {cells.map((c, i) => (
        <div key={i} style={{ fontSize: small ? 10.5 : 12, color: C.text, textAlign: i === 0 ? 'left' : 'center' }}>{c}</div>
      ))}
    </div>
  )
}

function Badge({ label, value, color }) {
  return (
    <div style={{ background: '#0d1117', borderRadius: 8, padding: '6px 12px', border: `1px solid ${color}44` }}>
      <div style={{ fontSize: 9, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────
const s = {
  card: {
    background: C.card, borderRadius: 12, padding: 14,
    border: `1px solid ${C.border}`,
  },
  sectionLabel: {
    fontSize: 10, color: '#555', fontWeight: 700,
    letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
  },
  ul: {
    margin: 0, paddingLeft: 18, fontSize: 12, color: C.text,
    lineHeight: 1.9, display: 'flex', flexDirection: 'column', gap: 4,
  },
  }
