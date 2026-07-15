// main.jsx — Vite/React entry point.
// Mounts <App /> into #root and does a one-time startup sanity check on the
// market list, per the master prompt's 🔴 validation requirement (#1.1).

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { FOREX_MARKETS } from './markets.js'
import './index.css'

// 🔴 Hard requirement: exactly 50 Forex pairs. If this list is ever edited to a
// different length, fail loudly in the console instead of silently shipping a
// broken market picker / category tabs.
if (FOREX_MARKETS.length !== 50) {
  // eslint-disable-next-line no-console
  console.error(
    `🔴 FOREX_MARKETS must contain exactly 50 pairs. Found ${FOREX_MARKETS.length}. ` +
      'Check src/markets.js — an entry was added or removed without updating the ' +
      'category tabs / QA checklist.'
  )
}

const rootEl = document.getElementById('root')

if (!rootEl) {
  // eslint-disable-next-line no-console
  console.error('🔴 #root element not found in index.html — cannot mount app.')
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
    }
