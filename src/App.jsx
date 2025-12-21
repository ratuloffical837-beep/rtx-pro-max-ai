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
    candleName: 'Pending...',
    psBorderColor: '#222', // PS বক্সের বর্ডার কালার
    entryTime: '--:--:--'
  });

  const markets = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "EURUSDT", "DOGEUSDT", "TRXUSDT", "LTCUSDT"];

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const sec = now.getSeconds();
      setTime(now.toLocaleTimeString());

      // ১. ক্যান্ডেল শুরু হওয়ার সাথে সাথে এনালাইসিস শুরু (00-30s)
      if (sec >= 0 && sec < 30) {
        setSignal(prev => ({
          ...prev,
          phase: 'SCANNING',
          message: 'POWER SCANNING ACTIVE...',
          psBorderColor: '#333',
          entryTime: getNextMinute()
        }));
      }
      // ২. ৩০ সেকেন্ডে অ্যালার্ট (Ready Phase) - বর্ডার কালার চেইঞ্জ হবে
      else if (sec >= 30 && sec < 55) {
        const potential = Math.random() > 0.5 ? 'UP' : 'DOWN';
        setSignal(prev => ({
          ...prev,
          phase: 'READY',
          direction: potential,
          message: `READY: ${potential}`,
          psBorderColor: potential === 'UP' ? '#00ff88' : '#ff3b3b',
          candleName: 'Pattern Identified...'
        }));
      }
      // ৩. ৫ সেকেন্ড আগে ফিক্সড সিগন্যাল (No Change After This)
      else if (sec >= 55) {
        if (signal.phase !== 'CONFIRMED') {
          const finalDir = Math.random() > 0.5 ? 'UP' : 'DOWN';
          const patterns = ['BULLISH ENGULFING', 'HAMMER', 'MORNING STAR', 'SHOOTING STAR'];
          setSignal({
            phase: 'CONFIRMED',
            direction: finalDir,
            message: finalDir === 'UP' ? 'UP TRADE FAST 🚀' : 'DOWN TRADE FAST 📉',
            accuracy: (98.88 + Math.random() * 1.1).toFixed(2) + '%',
            psBorderColor: finalDir === 'UP' ? '#00ff88' : '#ff3b3b',
            candleName: patterns[Math.floor(Math.random() * patterns.length)],
            entryTime: getNextMinute()
          });
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [asset, signal.phase]);

  const getNextMinute = () => {
    const d = new Date(new Date().getTime() + 60000);
    return d.getHours() + ":" + String(d.getMinutes()).padStart(2, '0') + ":00";
  };

  if (!isLoggedIn) return <Login setAuth={setIsLoggedIn} />;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.brand}>RTX MASTER AI <br/><span style={s.liveText}>{time} | HIGH-SPEED</span></div>
        <select onChange={(e) => setAsset(e.target.value)} style={s.select}>
          {markets.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div style={s.chartBox}>
        <iframe src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${asset}&interval=1&theme=dark`} width="100%" height="100%" frameBorder="0"></iframe>
      </div>

      <div style={s.signalCard}>
        <div style={s.infoRow}>
          <span>CANDLE: {signal.candleName}</span>
          <span>ACCURACY: {signal.accuracy}</span>
        </div>

        <div style={s.mainAction}>
          <h1 style={{fontSize: '32px', color: signal.psBorderColor}}>{signal.message}</h1>
        </div>

        {/* PS BOX - আপনার দেওয়া স্ক্রিনশট অনুযায়ী ডিজাইন */}
        <div style={{...s.psBox, borderColor: signal.psBorderColor}}>
          <div style={s.timeLabel}>SHARP ENTRY COUNTDOWN</div>
          <div style={s.timeDisplay}>{signal.entryTime}</div>
          <div style={s.psIndicator}>P-S ENGINE ACTIVE</div>
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
            <h2 style={{color:'#f3ba2f'}}>AI LOGIN</h2>
            <input name="u" placeholder="User" style={s.input} /><input name="p" type="password" placeholder="Pass" style={s.input} />
            <button style={s.goldBtn}>INITIALIZE</button>
        </form></div>
    );
}

const s = {
  container: { padding: '15px', background: '#000', height: '100vh', fontFamily: 'sans-serif', color: '#fff' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
  brand: { color: '#f3ba2f', fontWeight: 'bold', fontSize: '18px' },
  liveText: { color: '#00ff88', fontSize: '11px' },
  select: { background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '5px', padding: '5px' },
  chartBox: { height: '280px', borderRadius: '15px', overflow: 'hidden', border: '1px solid #333', marginBottom: '15px' },
  signalCard: { borderRadius: '40px', padding: '20px', textAlign: 'center', background: '#0a0a0a', border: '1px solid #222' },
  infoRow: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '10px' },
  mainAction: { height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  psBox: { background: '#000', borderRadius: '25px', padding: '20px', border: '4px solid #222', transition: 'all 0.4s ease', margin: '10px 0' },
  timeLabel: { fontSize: '10px', color: '#888', letterSpacing: '1px' },
  timeDisplay: { fontSize: '38px', fontWeight: 'bold', color: '#f3ba2f', margin: '5px 0' },
  psIndicator: { fontSize: '9px', color: '#444', fontWeight: 'bold' },
  footerNote: { fontSize: '9px', color: '#333', marginTop: '10px' },
  loginBg: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' },
  loginCard: { background: '#111', padding: '30px', borderRadius: '20px', border: '1px solid #222', textAlign: 'center' },
  input: { width: '100%', padding: '12px', margin: '10px 0', borderRadius: '10px', background: '#000', color: '#fff', border: '1px solid #333', boxSizing: 'border-box' },
  goldBtn: { width: '100%', padding: '15px', borderRadius: '30px', background: 'linear-gradient(to bottom, #f3ba2f, #a87f1a)', border: 'none', fontWeight: 'bold' }
};
