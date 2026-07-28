// RulesPage.jsx
// ✅ FINAL VERSION:
// - Imports C from constants.js (no more local C mismatch)
// - Conservative scenario changed 45% → 35% (real negative EV)
// - Now accessible via SettingsModal

import { useState } from 'react'
import { C, FIXED_RISK_PERCENT, MIN_RR_RATIO } from './constants.js'

const RISK_PCT = FIXED_RISK_PERCENT * 100
const START_BALANCE = 5000

const genFixedRiskSteps = () => {
  const rows = []
  let bal = START_BALANCE
  const sequence = [
    { result: 'LOSS', rMultiple: -1 },
    { result: 'LOSS', rMultiple: -1 },
    { result: 'WIN', rMultiple: 1.5 },
    { result: 'LOSS', rMultiple: -1 },
    { result: 'WIN', rMultiple: 2.2 },
  ]
  sequence.forEach((s, i) => {
    const riskAmount = +(bal * FIXED_RISK_PERCENT).toFixed(2)
    const pnl = +(riskAmount * s.rMultiple).toFixed(2)
    const newBal = +(bal + pnl).toFixed(2)
    rows.push({
      step: i + 1,
      prevBalance: bal,
      riskAmount,
      result: s.result,
      rMultiple: s.rMultiple,
      pnl,
      newBalance: newBal,
    })
    bal = newBal
  })
  return rows
}
const fixedRiskSteps = genFixedRiskSteps()
const fixedRiskFinalBalance = fixedRiskSteps[fixedRiskSteps.length - 1].newBalance

const AVG_WIN_R = MIN_RR_RATIO
const LOSS_R = 1

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

// ✅ FIX: 35% (true negative EV at 1.5R), was incorrectly 45%
const scenarioConservative = genCompoundingScenario(35)
const scenarioModerate = genCompoundingScenario(55)
const scenarioOptimistic = genCompoundingScenario(65)

export default function RulesPage({ onClose = () => {} }) {
  const [tab, setTab] = useState('disclaimer')

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: C.bg,
        zIndex: 999,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: C.card,
          borderBottom: `1px solid ${C.border}`,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 900, color: C.gold }}>📜 রুল্স ও গাইড</div>
        <button
          onClick={onClose}
          style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            color: C.muted,
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ✕ বন্ধ
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '12px 12px 0' }}>
        {[
          { key: 'disclaimer', label: '⚠️ নিয়মাবলী' },
          { key: 'riskSystem', label: '🎯 1% Risk System' },
          { key: 'compounding', label: '📈 Growth Scenarios' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: '10px 6px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              background: tab === t.key ? `${C.gold}22` : C.panel,
              color: tab === t.key ? C.gold : C.muted,
              border: tab === t.key ? `2px solid ${C.gold}` : `1px solid ${C.border}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 14 }}>
        {tab === 'disclaimer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ ...s.card, textAlign: 'center', border: `1px solid ${C.gold}44` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.gold }}>
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                বিসমিল্লাহির রাহমানির রাহিম
              </div>
            </div>

            <div style={{ ...s.card, border: `1px solid ${C.red}55` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.red, marginBottom: 8 }}>
                ⚠️ ঝুঁকি সম্পর্কিত সতর্কতা
              </div>
              <ul style={s.ul}>
                <li>
                  ফরেক্স ট্রেডিং একটি <b style={{ color: C.red }}>উচ্চ-ঝুঁকিপূর্ণ</b> কার্যক্রম।
                </li>
                <li>
                  এই অ্যাপের সিগনাল কোনো নিশ্চিত লাভের গ্যারান্টি না — এটি সহায়ক টুল মাত্র।
                </li>
                <li>যা বিনিয়োগ করছেন তা সম্পূর্ণ হারানোর সম্ভাবনা মেনে নিয়েই ট্রেড করুন।</li>
                <li>আর্থিক সিদ্ধান্তের দায়ভার সম্পূর্ণ আপনার নিজের।</li>
              </ul>
            </div>

            <div style={{ ...s.card, border: `1px solid ${C.gold}55` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 8 }}>
                💰 মানি ম্যানেজমেন্ট — এই অ্যাপের নীতি
              </div>
              <ul style={s.ul}>
                <li>
                  প্রতি ট্রেডে ব্যালেন্সের ঠিক <b>{RISK_PCT}%</b> ঝুঁকি — এটাই একমাত্র নিয়ম।
                </li>
                <li>একদিনে সর্বোচ্চ ৩-৫টি ট্রেডের বেশি না করাই ভালো।</li>
                <li>আবেগের বশে ট্রেডের সাইজ বদলাবেন না।</li>
                <li>পরিকল্পনামতো ট্রেড করুন, ফলাফল আল্লাহর হাতে।</li>
              </ul>
            </div>

            <div style={{ ...s.card, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.blue, marginBottom: 8 }}>
                🚫 মার্টিঙ্গেল — এই অ্যাপে নিষিদ্ধ
              </div>
              <ul style={s.ul}>
                <li>
                  লসের পর সাইজ বাড়ানোর কৌশল (Martingale){' '}
                  <b style={{ color: C.red }}>সম্পূর্ণ সাপোর্ট করা হয় না</b>।
                </li>
                <li>টানা লসে সাইজ বাড়ালে একটি খারাপ streak-এই অ্যাকাউন্ট শেষ হয়ে যেতে পারে।</li>
                <li>ফিক্সড {RISK_PCT}% ঝুঁকি সিস্টেমই একমাত্র নিরাপদ পথ।</li>
              </ul>
            </div>
          </div>
        )}

        {tab === 'riskSystem' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ ...s.card, textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.gold }}>
                FIXED {RISK_PCT}% RISK SYSTEM
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>
                নিয়ম: প্রতিটা ট্রেডে ঠিক কারেন্ট ব্যালেন্সের {RISK_PCT}% ঝুঁকি। SL দূরত্ব ও পেয়ার
                অনুযায়ী লট সাইজ স্বয়ংক্রিয়ভাবে হিসাব হয়।
              </div>
              <div
                style={{
                  marginTop: 10,
                  background: '#0d1117',
                  borderRadius: 8,
                  padding: '8px 12px',
                  display: 'inline-block',
                }}
              >
                <span style={{ fontSize: 11, color: C.muted }}>উদাহরণ ব্যালেন্স: </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
                  ৳{START_BALANCE.toLocaleString()}
                </span>
              </div>
            </div>

            <div style={s.card}>
              <div style={s.sectionLabel}>লট সাইজ যেভাবে হিসাব হয়</div>
              <ul style={s.ul}>
                <li>
                  <b>Risk Amount</b> = Balance × {RISK_PCT}%
                </li>
                <li>
                  <b>Lot Size</b> = Risk Amount ÷ (SL pips × pip value)
                </li>
                <li>SL যত দূরে, লট সাইজ তত ছোট — ডলার-ঝুঁকি সবসময় একই।</li>
                <li>TP1/TP2/TP3-এ লাভ ভাগ: ৫০% / ৩০% / ২০%।</li>
              </ul>
            </div>

            <div style={s.card}>
              <div style={{ ...s.sectionLabel, color: C.blue }}>
                উদাহরণ সিকোয়েন্স (মিশ্র WIN/LOSS)
              </div>
              <TableHead
                cols={['ধাপ', 'আগের ব্যালেন্স', 'ঝুঁকি', 'রেজাল্ট', 'P/L', 'নতুন ব্যালেন্স']}
                small
              />
              {fixedRiskSteps.map((r) => (
                <TableRow
                  key={r.step}
                  small
                  cells={[
                    r.step,
                    `৳${r.prevBalance.toLocaleString()}`,
                    `৳${r.riskAmount.toLocaleString()}`,
                    <span style={{ color: r.result === 'WIN' ? C.green : C.red, fontWeight: 700 }}>
                      {r.result === 'WIN' ? `WIN (${r.rMultiple}R)` : 'LOSS (-1R)'}
                    </span>,
                    <span style={{ color: r.pnl >= 0 ? C.green : C.red }}>
                      {r.pnl >= 0 ? '+' : ''}৳{r.pnl.toLocaleString()}
                    </span>,
                    <b>৳{r.newBalance.toLocaleString()}</b>,
                  ]}
                />
              ))}
              <div
                style={{
                  fontSize: 11,
                  color: C.muted,
                  marginTop: 10,
                  lineHeight: 1.7,
                  borderTop: `1px solid ${C.border}`,
                  paddingTop: 10,
                }}
              >
                চূড়ান্ত ব্যালেন্স:{' '}
                <b style={{ color: fixedRiskFinalBalance >= START_BALANCE ? C.green : C.red }}>
                  ৳{fixedRiskFinalBalance.toLocaleString()}
                </b>
              </div>
            </div>
          </div>
        )}

        {tab === 'compounding' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ ...s.card, textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.gold }}>
                GROWTH SCENARIOS (হাইপোথেটিক্যাল)
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                Risk:Reward ও Win-Rate ভিত্তিক — কোনো গ্যারান্টি না
              </div>
            </div>

            <div style={{ ...s.card, border: `1px solid ${C.red}55` }}>
              <div style={{ fontSize: 11, color: C.red, lineHeight: 1.7 }}>
                ⚠️ <b>এটি কোনো প্রতিশ্রুতি না।</b> নিচের ৩টি দৃশ্যকল্প শুধু গাণিতিকভাবে দেখাচ্ছে যে
                বিভিন্ন win-rate কেমন প্রভাব ফেলতে পারে।
              </div>
            </div>

            <ScenarioBlock
              title="🔴 Conservative — 35% Win Rate"
              subtitle={`Expected value/trade: ${scenarioConservative.expectedRPerTrade.toFixed(3)}R (breakeven-এর নিচে)`}
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
          </div>
        )}
      </div>
    </div>
  )
}

function ScenarioBlock({ title, subtitle, rows, finalBalance, color }) {
  const displayRows = rows.filter((_, i) => i % 4 === 0 || i === rows.length - 1)
  return (
    <div style={s.card}>
      <div style={{ fontSize: 13, fontWeight: 800, color, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>
        {subtitle}
      </div>
      <TableHead cols={['ট্রেড #', 'শুরু', 'P/L', 'শেষ']} small />
      {displayRows.map((r) => (
        <TableRow
          key={r.trade}
          small
          cells={[
            r.trade,
            `৳${r.start.toLocaleString()}`,
            <span style={{ color: r.pnl >= 0 ? C.green : C.red }}>
              {r.pnl >= 0 ? '+' : ''}৳{r.pnl.toLocaleString()}
            </span>,
            <b style={{ color }}>৳{r.end.toLocaleString()}</b>,
          ]}
        />
      ))}
      <div
        style={{
          fontSize: 11,
          color: C.muted,
          marginTop: 10,
          textAlign: 'center',
          borderTop: `1px solid ${C.border}`,
          paddingTop: 8,
        }}
      >
        {rows.length} ট্রেড পর: <b style={{ color }}>৳{finalBalance.toLocaleString()}</b>
      </div>
    </div>
  )
}

function TableHead({ cols, small }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
        gap: 4,
        marginBottom: 6,
        paddingBottom: 6,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {cols.map((c, i) => (
        <div
          key={i}
          style={{
            fontSize: small ? 9 : 10,
            color: C.muted,
            fontWeight: 700,
            textAlign: i === 0 ? 'left' : 'center',
          }}
        >
          {c}
        </div>
      ))}
    </div>
  )
}

function TableRow({ cells, small }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
        gap: 4,
        padding: small ? '5px 0' : '7px 0',
        borderBottom: `1px solid ${C.border}33`,
      }}
    >
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            fontSize: small ? 10.5 : 12,
            color: C.text,
            textAlign: i === 0 ? 'left' : 'center',
          }}
        >
          {c}
        </div>
      ))}
    </div>
  )
}

const s = {
  card: {
    background: C.card,
    borderRadius: 12,
    padding: 14,
    border: `1px solid ${C.border}`,
  },
  sectionLabel: {
    fontSize: 10,
    color: '#555',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  ul: {
    margin: 0,
    paddingLeft: 18,
    fontSize: 12,
    color: C.text,
    lineHeight: 1.9,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  }
