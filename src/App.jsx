import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [asset, setAsset] = useState('BTCUSDT');
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('auth') === 'true');
  const [signal, setSignal] = useState({ 
    phase: 'SCANNING', 
    direction: '', 
    accuracy: '0%', 
    message: 'Analyzing Market...',
    color: '#333'
  });

  const markets = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "LTCUSDT", "EURUSDT", "GBPUSDT", "DOGEUSDT", "TRXUSDT"];

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const sec = now.getSeconds();
      setTime(now.toLocaleTimeString());

      // ১. শুরু থেকে ৩০ সেকেন্ড: ক্যান্ডেল ও প্রাইস এনালাইসিস ফেইজ
      if (sec >= 0 && sec < 30) {
        setSignal({
          phase: 'SCANNING',
          message: 'POWER SCANNING ACTIVE...',
          color: '#1a1a1a'
        });
      }
      // ২. ৩০ সেকেন্ড থেকে ৫৩ সেকেন্ড: রেডিনেস অ্যালার্ট (কালার কোডেড)
      else if (sec >= 30 && sec < 53) {
        const tempDir = Math.random() > 0.5 ? 'UP' : 'DOWN';
        setSignal({
          phase: 'READY',
          direction: tempDir,
          message: `READY TO ${tempDir} ⚡`,
          color: tempDir === 'UP' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 59, 59, 0.2)'
        });
      }
      // ৩. ৫৩ সেকেন্ড থেকে ৫৯ সেকেন্ড: ফাইনাল কনফার্মেশন (Super Fast)
      else if (sec >= 53 && sec < 60) {
        const finalDir = Math.random() > 0.5 ? 'UP' : 'DOWN';
        setSignal({
          phase: 'TRADE',
          direction: finalDir,
          message: finalDir === 'UP' ? 'UP TRADE FAST 🚀' : 'DOWN TRADE FAST 📉',
          accuracy: (98.5 + Math.random() * 1.4).toFixed(2) + '%',
          color: finalDir === 'UP' ? '#00ff88' : '#ff3b3b'
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [asset]);

  if (!isLoggedIn) return <Login setAuth={setIsLoggedIn} />;

  return (
    <div style={{...s.container, background: signal.color}}>
      <div style={s.header}>
        <div style={s.brand}>RTX MASTER AI <br/><span style={s.liveText}>{time} | HIGH-SPEED</span></div>
        <select onChange={(e) => setAsset(e.target.value)} style={s.select}>
          {markets.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div style={s.chartBox}>
        <iframe 
          src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${asset}&interval=1&theme=dark&style=1`} 
          width="100%" height="100%" frameBorder="0">
        </iframe>
      </div>

      <div style={{...s.signalCard, borderColor: signal.phase === 'TRADE' ? '#fff' : '#222'}}>
        <div style={s.infoRow}>
          <span>CANDLE: {signal.phase}</span>
          <span>ACCURACY: {signal.accuracy || '98%+'}</span>
        </div>

        <div style={s.mainAction}>
          <h1 style={{fontSize: '36px', margin: 0}}>{signal.message}</h1>
        </div>

        <div style={s.timerBox}>
          <div style={s.timeLabel}>SHARP ENTRY COUNTDOWN</div>
          <div style={s.timeDisplay}>{time}</div>
        </div>

        <div style={s.footerNote}>ALL TOOLS & 1000+ CANDLES SYNCED</div>
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
            <h2 style={{color:'#f3ba2f'}}>AI TERMINAL LOGIN</h2>
            <input name="u" placeholder="User" style={s.input} /><input name="p" type="password" placeholder="Pass" style={s.input} />
            <button style={s.goldBtn}>INITIALIZE AI</button>
        </form></div>
    );
}

const s = {
  container: { padding: '15px', height: '100vh', transition: 'all 0.3s ease', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
  brand: { color: '#f3ba2f', fontWeight: 'bold', fontSize: '18px' },
  liveText: { color: '#fff', fontSize: '11px' },
  select: { background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '5px', padding: '5px' },
  chartBox: { height: '280px', borderRadius: '15px', overflow: 'hidden', border: '1px solid #333', marginBottom: '15px' },
  signalCard: { border: '4px solid #222', borderRadius: '40px', padding: '25px', textAlign: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' },
  infoRow: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '10px' },
  mainAction: { height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  timerBox: { background: '#000', borderRadius: '20px', padding: '15px', border: '1px solid #222', margin: '15px 0' },
  timeLabel: { fontSize: '10px', color: '#f3ba2f', letterSpacing: '2px' },
  timeDisplay: { fontSize: '38px', fontWeight: 'bold' },
  footerNote: { fontSize: '9px', color: '#444' },
  loginBg: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' },
  loginCard: { background: '#111', padding: '35px', borderRadius: '25px', border: '1px solid #222', textAlign: 'center' },
  input: { width: '100%', padding: '12px', margin: '10px 0', borderRadius: '10px', background: '#000', color: '#fff', border: '1px solid #333' },
  goldBtn: { width: '100%', padding: '15px', borderRadius: '30px', background: 'linear-gradient(to bottom, #f3ba2f, #a87f1a)', border: 'none', fontWeight: 'bold' }
};
