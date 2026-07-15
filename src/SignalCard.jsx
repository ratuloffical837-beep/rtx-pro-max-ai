// SignalCard.jsx — displays one generated signal. Pip-based, includes the
// Position Sizing box and the Won/Lost drawdown-counter buttons.
// 🔴 No leverage-suggestion row in the TP/SL box — that context lives only in
// the Position Sizing box below it.
// 🔴 Disclaimer line at the bottom is mandatory and must never be removed.

import React, { useState } from 'react'
import { C } from './constants.js'

// Expected `signal` shape (produced by signalEngine.js):
// {
//   direction: 'LONG' | 'SHORT',
//   modeName, modeColor, strength: 'Strong'|'Moderate'|'Weak',
//   pair: { name, cat, td },
//   entry: number,
//   tp1: { price, pips }, tp2: { price, pips }, tp3: { price, pips },
//   sl: { price, pips },
//   rr: number,
//   blocked: boolean, blockReason: string | null,
//   quickStats: [{ label, value }] (length 3),
//   structure: [{ label, value }],
//   mtfBias: { '4h': 'Bullish'|'Bearish'|'Neutral', '1h': ..., '15m': ..., '5m': ... },
//   pattern: string,
//   detail: string,
//   positionSizing: { lotSize, riskAmountUsd, riskPercent, potentialLossUsd,
//                      tp1ProfitUsd, tp2ProfitUsd, tp3ProfitUsd } | null
// }

export default function SignalCard({ signal, drawdownAlertOn, onWon, onLost }) {
  const [detailOpen, setDetailOpen] = useState(false)

  if (!signal) return null

  const dirColor = signal.direction === 'LONG' ? C.green : C.red

  return (
    <div style={styles.card}>
      {/* Direction + mode + strength */}
      <div style={styles.headerRow}>
        <span style={{ ...styles.dirBadge, background: `${dirColor}22`, color: dirColor, borderColor: dirColor }}>
          {signal.direction === 'LONG' ? '🟢 LONG' : '🔴 SHORT'}
        </span>
        <span style={{ ...styles.modeBadge, color: signal.modeColor, borderColor: signal.modeColor }}>
          {signal.modeName}
        </span>
        <span style={styles.strengthBadge}>{signal.strength}</span>
      </div>

      <div style={styles.pairName}>{signal.pair?.name}</div>

      {/* TP/SL box */}
      <div style={styles.tpslBox}>
        <div style={styles.entryRow}>
          <span style={styles.entryLabel}>Entry</span>
          <span style={styles.entryValue}>{formatPrice(signal.entry)}</span>
        </div>
        <TpRow label="🎯 TP1 (50%)" data={signal.tp1} color={C.green} />
        <TpRow label="🎯 TP2 (30%)" data={signal.tp2} color={C.green} />
        <TpRow label="🎯 TP3 (20%)" data={signal.tp3} color={C.green} />
        <TpRow label="🛑 STOP LOSS" data={signal.sl} color={C.red} />
        <div style={styles.rrBox}>⚖️ R:R = 1:{signal.rr?.toFixed(2)}</div>
      </div>

      {/* Position sizing */}
      {signal.positionSizing ? (
        <div style={styles.sizingBox}>
          <div style={styles.sizingTitle}>📐 Position Sizing</div>
          <SizingRow label="Suggested Lot Size" value={`${signal.positionSizing.lotSize} lot`} />
          <SizingRow
            label="Risk This Trade"
            value={`$${signal.positionSizing.riskAmountUsd} (${(signal.positionSizing.riskPercent * 100).toFixed(0)}%)`}
          />
          <div style={styles.lossLine}>
            ❌ If SL Hits: -${signal.positionSizing.potentialLossUsd} — পরের ট্রেডেও একই ১% ঝুঁকি
            রাখুন, সাইজ বাড়াবেন না
          </div>
          <div style={styles.profitLine}>
            ✅ If TP1/TP2/TP3 Hit: +${signal.positionSizing.tp1ProfitUsd} / +$
            {signal.positionSizing.tp2ProfitUsd} / +${signal.positionSizing.tp3ProfitUsd}
          </div>
        </div>
      ) : (
        <div style={styles.noBalanceBox}>
          💡 Lot size দেখতে Settings → Money Management-এ আপনার account balance যোগ করুন।
        </div>
      )}

      {/* Won/Lost quick buttons */}
      {drawdownAlertOn && (
        <div style={styles.wonLostRow}>
          <button style={{ ...styles.wonLostBtn, borderColor: C.green, color: C.green }} onClick={onWon}>
            ✅ Won
          </button>
          <button style={{ ...styles.wonLostBtn, borderColor: C.red, color: C.red }} onClick={onLost}>
            ❌ Lost
          </button>
        </div>
      )}

      {/* Spread warning */}
      {signal.blocked && (
        <div style={styles.warningBox}>⚠️ {signal.blockReason || 'High spread — signal is not safe right now'}</div>
      )}

      {/* Quick stats */}
      {Array.isArray(signal.quickStats) && signal.quickStats.length > 0 && (
        <div style={styles.statsRow}>
          {signal.quickStats.map((s, i) => (
            <div key={i} style={styles.statBox}>
              <div style={styles.statLabel}>{s.label}</div>
              <div style={styles.statValue}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Structure grid */}
      {Array.isArray(signal.structure) && signal.structure.length > 0 && (
        <div style={styles.structureGrid}>
          {signal.structure.map((s, i) => (
            <div key={i} style={styles.structureItem}>
              <span style={styles.structureLabel}>{s.label}</span>
              <span style={styles.structureValue}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* MTF bias */}
      {signal.mtfBias && (
        <div style={styles.mtfRow}>
          {['4h', '1h', '15m', '5m'].map((tf) => (
            <div key={tf} style={styles.mtfItem}>
              <div style={styles.mtfTf}>{tf}</div>
              <div style={{ ...styles.mtfBias, color: biasColor(signal.mtfBias[tf]) }}>
                {signal.mtfBias[tf] || '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pattern badge */}
      {signal.pattern && <div style={styles.patternBadge}>🧩 {signal.pattern}</div>}

      {/* Collapsible detail */}
      {signal.detail && (
        <div>
          <button style={styles.detailToggle} onClick={() => setDetailOpen((v) => !v)}>
            {detailOpen ? '▲ বিস্তারিত লুকান' : '▼ বিস্তারিত বিশ্লেষণ দেখুন'}
          </button>
          {detailOpen && <div style={styles.detailBox}>{signal.detail}</div>}
        </div>
      )}

      {/* Disclaimer — mandatory, never remove */}
      <div style={styles.disclaimer}>
        ⚠️ This is a technical analysis, not investment advice. Trade at your own risk.
      </div>
    </div>
  )
}

function TpRow({ label, data, color }) {
  if (!data) return null
  return (
    <div style={styles.tpRow}>
      <span style={styles.tpLabel}>{label}</span>
      <span style={{ ...styles.tpValue, color }}>
        {formatPrice(data.price)} <span style={styles.tpPips}>({data.pips >= 0 ? '+' : ''}{data.pips?.toFixed(1)} pips)</span>
      </span>
    </div>
  )
}

function SizingRow({ label, value }) {
  return (
    <div style={styles.sizingRow}>
      <span style={styles.sizingLabel}>{label}</span>
      <span style={styles.sizingValue}>{value}</span>
    </div>
  )
}

function formatPrice(p) {
  if (typeof p !== 'number' || Number.isNaN(p)) return '—'
  return p.toFixed(5)
}

function biasColor(bias) {
  if (bias === 'Bullish') return C.green
  if (bias === 'Bearish') return C.red
  return C.muted
}

const styles = {
  card: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  headerRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  dirBadge: {
    border: '1px solid',
    borderRadius: 8,
    padding: '4px 10px',
    fontWeight: 800,
    fontSize: 13,
  },
  modeBadge: {
    border: '1px solid',
    borderRadius: 8,
    padding: '4px 10px',
    fontWeight: 700,
    fontSize: 11,
  },
  strengthBadge: {
    marginLeft: 'auto',
    fontSize: 11,
    color: C.muted,
    fontWeight: 700,
  },
  pairName: { fontSize: 15, fontWeight: 800, color: C.text },
  tpslBox: {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  entryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingBottom: 6,
    marginBottom: 4,
    borderBottom: `1px solid ${C.border}`,
  },
  entryLabel: { fontSize: 12, color: C.muted, fontWeight: 700 },
  entryValue: { fontSize: 15, fontWeight: 800, color: C.gold },
  tpRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12.5 },
  tpLabel: { color: C.muted, fontWeight: 600 },
  tpValue: { fontWeight: 700 },
  tpPips: { fontSize: 11, opacity: 0.8 },
  rrBox: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: 800,
    color: C.cyan,
  },
  sizingBox: {
    background: `${C.blue}12`,
    border: `1px solid ${C.blue}44`,
    borderRadius: 10,
    padding: 12,
  },
  sizingTitle: { fontSize: 12, fontWeight: 800, color: C.blue, marginBottom: 8 },
  sizingRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 },
  sizingLabel: { color: C.muted },
  sizingValue: { color: C.text, fontWeight: 700 },
  lossLine: { fontSize: 11, color: C.red, marginTop: 6, lineHeight: 1.5 },
  profitLine: { fontSize: 11, color: C.green, marginTop: 4, lineHeight: 1.5 },
  noBalanceBox: {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 12,
    fontSize: 12,
    color: C.cyan,
  },
  wonLostRow: { display: 'flex', gap: 8 },
  wonLostBtn: {
    flex: 1,
    background: 'transparent',
    border: '1px solid',
    borderRadius: 8,
    padding: '8px 0',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  },
  warningBox: {
    background: `${C.red}18`,
    border: `1px solid ${C.red}55`,
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    color: C.red,
    fontWeight: 600,
  },
  statsRow: { display: 'flex', gap: 8 },
  statBox: {
    flex: 1,
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 10,
    textAlign: 'center',
  },
  statLabel: { fontSize: 10, color: C.muted, marginBottom: 4 },
  statValue: { fontSize: 13, fontWeight: 800, color: C.text },
  structureGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  structureItem: {
    display: 'flex',
    justifyContent: 'space-between',
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 11,
  },
  structureLabel: { color: C.muted },
  structureValue: { color: C.text, fontWeight: 700 },
  mtfRow: { display: 'flex', gap: 6 },
  mtfItem: {
    flex: 1,
    textAlign: 'center',
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '6px 0',
  },
  mtfTf: { fontSize: 10, color: C.muted, fontWeight: 700 },
  mtfBias: { fontSize: 11, fontWeight: 800, marginTop: 2 },
  patternBadge: {
    alignSelf: 'flex-start',
    background: C.panel,
    border: `1px solid ${C.purple}55`,
    color: C.purple,
    borderRadius: 8,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 700,
  },
  detailToggle: {
    width: '100%',
    background: 'transparent',
    border: `1px dashed ${C.border}`,
    borderRadius: 8,
    padding: '8px 0',
    color: C.muted,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  },
  detailBox: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 1.7,
    color: C.text,
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 12,
  },
  disclaimer: {
    fontSize: 10.5,
    color: C.dim,
    textAlign: 'center',
    lineHeight: 1.5,
    borderTop: `1px solid ${C.border}`,
    paddingTop: 10,
  },
}
