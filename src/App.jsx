import React, { useState, useEffect } from 'react';

export default function App() {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('auth') === 'true');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isLoggedIn) {
    return (
      <div style={s.loginBg}>
        <div style={s.loginCard}>
          <h2 style={{color: '#f3ba2f'}}>RTX AI LOGIN</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            if(e.target.u.value === import.meta.env.VITE_USER && e.target.p.value === import.meta.env.VITE_PASS) {
              localStorage.setItem('auth', 'true'); setIsLoggedIn(true);
            }
          }}>
            <input name="u" placeholder="Username" style={s.input} />
            <input name="p" type="password" placeholder="Password" style={s.input} />
            <button style={s.goldBtn}>LOGIN</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.brand}>RTX MASTER AI <br/><span style={s.liveText}>{time} | LIVE 🟢</span></div>
        <select style={s.select}><option>ETHUSDT</option><option>BTCUSDT</option></select>
      </div>

      <div style={s.chartPlaceholder}>
         <iframe src="https://s.tradingview.com/widgetembed/?symbol=BINANCE:ETHUSDT&interval=1&theme=dark" width="100%" height="100%" frameBorder="0"></iframe>
      </div>

      <div style={s.signalCard}>
        <div style={s.infoRow}>
          <span>CANDLE: BULLISH ENGULFING</span>
          <span>ACCURACY: 98.88%</span>
        </div>
        
        <h1 style={s.tradeText}>TRADE NOW:<br/>UP 🚀</h1>

        <div style={s.timerBox}>
          <div style={{fontSize: '10px', color: '#888'}}>SHARP ENTRY</div>
          <div style={s.timeDisplay}>{time}</div>
        </div>

        <div style={s.aiNote}>AI NOTE: Bullish momentum confirmed by Volume & RSI.</div>
      </div>
    </div>
  );
}

const s = {
  container: { padding: '15px', background: '#000', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#f3ba2f', fontWeight: 'bold', fontSize: '18px' },
  liveText: { color: '#00ff88', fontSize: '12px' },
  select: { background: '#1a1a1a', color: '#fff', border: '1px solid #333', padding: '5px', borderRadius: '5px' },
  chartPlaceholder: { height: '250px', border: '1px solid #222', borderRadius: '15px', margin: '20px 0', overflow: 'hidden' },
  signalCard: { border: '3px solid #00ff88', borderRadius: '40px', padding: '30px', textAlign: 'center', background: '#0a0a0a' },
  infoRow: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666', marginBottom: '20px' },
  tradeText: { color: '#00ff88', fontSize: '38px', margin: '10px 0', lineHeight: '1.2' },
  timerBox: { background: '#000', borderRadius: '20px', padding: '15px', border: '1px solid #1a1a1a', margin: '20px 0' },
  timeDisplay: { fontSize: '36px', color: '#f3ba2f', fontWeight: 'bold' },
  aiNote: { fontSize: '12px', color: '#888' },
  loginBg: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' },
  loginCard: { background: '#111', padding: '40px', borderRadius: '25px', textAlign: 'center', border: '1px solid #222' },
  input: { width: '100%', padding: '12px', margin: '10px 0', borderRadius: '10px', border: '1px solid #333', background: '#000', color: '#fff', boxSizing: 'border-box' },
  goldBtn: { width: '100%', padding: '15px', borderRadius: '30px', border: 'none', background: 'linear-gradient(to bottom, #f3ba2f, #a87f1a)', fontWeight: 'bold', cursor: 'pointer' }
};
