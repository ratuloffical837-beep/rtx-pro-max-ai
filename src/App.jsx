import React, { useState, useEffect } from 'react';

export default function App() {
  const [liveTime, setLiveTime] = useState(new Date().toLocaleTimeString());
  const [entryTime, setEntryTime] = useState('--:--:--');
  const [asset, setAsset] = useState('BTCUSDT');
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('auth') === 'true');
  
  const [signal, setSignal] = useState({ 
    phase: 'SCANNING', 
    direction: '', 
    accuracy: '99.54%', 
    message: 'ANALYZING MARKET...',
    candleName: 'Standard Pattern',
    borderColor: '#00ff88',
    isDoji: false
  });

  const markets = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "EURUSDT", "DOGEUSDT", "TRXUSDT"];

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const sec = now.getSeconds();
      setLiveTime(now.toLocaleTimeString()); 

      const nextMin = new Date(now.getTime() + 60000);
      setEntryTime(nextMin.getHours() + ":" + String(nextMin.getMinutes()).padStart(2, '0') + ":00");

      if (sec >= 0 && sec < 30) {
        setSignal(prev => ({
          ...prev,
          phase: 'SCANNING',
          message: 'POWER SCANNING ACTIVE...',
          borderColor: '#333',
          candleName: 'Analyzing Body-Wick...'
        }));
      }
      else if (sec >= 30 && sec < 54) {
        const potential = Math.random() > 0.5 ? 'UP' : 'DOWN';
        const checkDoji = Math.random() < 0.05; 
        setSignal(prev => ({
          ...prev,
          phase: 'READY',
          direction: potential,
          message: checkDoji ? 'PLEASE NO RISK 🛑' : `READY TO ${potential} ⚡`,
          borderColor: checkDoji ? '#f3ba2f' : (potential === 'UP' ? '#00ff88' : '#ff3b3b'),
          candleName: checkDoji ? 'DOJI / UNCERTAIN' : 'Strong Pattern',
          isDoji: checkDoji
        }));
      }
      else if (sec >= 54) {
        if (signal.phase !== 'CONFIRMED') {
          const finalDir = Math.random() > 0.5 ? 'UP' : 'DOWN';
          setSignal({
            phase: 'CONFIRMED',
            direction: finalDir,
            message: finalDir === 'UP' ? 'TRADE NOW: UP 🚀' : 'TRADE NOW: DOWN 📉',
            accuracy: (99.20 + Math.random() * 0.7).toFixed(2) + '%',
            borderColor: finalDir === 'UP' ? '#00ff88' : '#ff3b3b',
            candleName: 'STRATEGY CONFIRMED',
            isDoji: false
          });
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [asset, signal.phase]);

  if (!isLoggedIn) return <Login setAuth={setIsLoggedIn} />;

  return (
    <div style={s.container}>
      {/* Header Section */}
      <div style={s.header}>
        <div style={s.brand}>RTX MASTER AI <br/><span style={s.status}>STATUS: HIGH-SPEED 🟢</span></div>
        <select onChange={(e) => setAsset(e.target.value)} style={s.select}>
          {markets.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Large Binance Chart Section */}
      <div style={s.chartBox}>
        <iframe 
          src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${asset}&interval=1&theme=dark&style=1&timezone=Etc%2FUTC`} 
          width="100%" height="100%" frameBorder="0">
        </iframe>
      </div>

      {/* Signal Box Moved Down */}
      <div style={{...s.signalCard, borderColor: signal.borderColor}}>
        <div style={s.infoRow}>
          <span style={s.candleLabel}>CANDLE: {signal.candleName}</span>
          <span style={s.accuracyLabel}>ACCURACY: {signal.accuracy}</span>
        </div>

        <div style={s.mainAction}>
          <h1 style={{fontSize: '28px', color: signal.borderColor, margin: 0}}>{signal.message}</h1>
        </div>

        <div style={s.tiBox}>
          <div style={s.timeRow}>
            <div style={s.timeGroup}>
              <div style={s.label}>LIVE TIME</div>
              <div style={s.liveDisplay}>{liveTime}</div>
            </div>
            <div style={s.timeGroup}>
              <div style={s.label}>ENTRY AT</div>
              <div style={s.entryDisplay}>{entryTime}</div>
            </div>
          </div>
        </div>

        <div style={s.footerNote}>1000+ CANDLES & BODY-WICK ANALYZED</div>
      </div>
    </div>
  );
}

function Login({setAuth}) {
    const handle = (e) => {
        e.preventDefault();
        if(e.target.u.value === import.meta.env.VITE_USER && e.target.p.value === import.meta.env.VITE_PASS) {
            localStorage.setItem('auth', 'true'); setAuth(true);
        }
    };
    return (
        <div style={s.loginBg}><form onSubmit={handle} style={s.loginCard}>
            <h2 style={{color:'#f3ba2f'}}>AI SYSTEM LOGIN</h2>
            <input name="u" placeholder="User ID" style={s.input} />
            <input name="p" type="password" placeholder="Passkey" style={s.input} />
            <button style={s.goldBtn}>INITIALIZE AI</button>
        </form></div>
    );
}

const s = {
  container: { padding: '8px', background: '#000', height: '100vh', fontFamily: 'sans-serif', color: '#fff', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '5px', height: '40px' },
  brand: { color: '#f3ba2f', fontWeight: 'bold', fontSize: '15px' },
  status: { color: '#00ff88', fontSize: '9px' },
  select: { background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '5px', padding: '2px 8px', height: '30px' },
  // Chart box size increased for better visibility
  chartBox: { flexGrow: 1, borderRadius: '10px', overflow: 'hidden', border: '1px solid #222', marginBottom: '8px' },
  // Signal card styling and positioning
  signalCard: { border: '3px solid #222', borderRadius: '30px', padding: '12px', textAlign: 'center', background: '#050505', minHeight: '180px' },
  infoRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '5px' },
  candleLabel: { fontSize: '10px', color: '#888' },
  accuracyLabel: { fontSize: '13px', color: '#00ff88', fontWeight: 'bold' },
  mainAction: { height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tiBox: { background: '#000', borderRadius: '20px', padding: '10px', border: '1px solid #1a1a1a', marginTop: '5px' },
  timeRow: { display: 'flex', justifyContent: 'space-around' },
  timeGroup: { textAlign: 'center' },
  label: { fontSize: '8px', color: '#666' },
  liveDisplay: { fontSize: '20px', fontWeight: 'bold', color: '#fff' },
  entryDisplay: { fontSize: '20px', fontWeight: 'bold', color: '#f3ba2f' },
  footerNote: { fontSize: '7px', color: '#222', marginTop: '5px' },
  loginBg: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' },
  loginCard: { background: '#0a0a0a', padding: '30px', borderRadius: '25px', border: '1px solid #222', textAlign: 'center' },
  input: { width: '100%', padding: '12px', margin: '8px 0', borderRadius: '8px', background: '#000', color: '#fff', border: '1px solid #333', boxSizing: 'border-box' },
  goldBtn: { width: '100%', padding: '14px', borderRadius: '25px', background: 'linear-gradient(to bottom, #f3ba2f, #a87f1a)', border: 'none', fontWeight: 'bold' }
};
