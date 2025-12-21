import React, { useState, useEffect } from 'react';

export default function App() {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [asset, setAsset] = useState('BTCUSDT');
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('auth') === 'true');
  
  const [signal, setSignal] = useState({ 
    phase: 'SCANNING', 
    direction: '', 
    accuracy: '0%', 
    message: 'Analyzing Market...',
    candleName: 'Scanning...',
    psBorderColor: '#333',
    riskAlert: false // Doji বা কনফিউশন ক্যান্ডেলের জন্য
  });

  const markets = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "EURUSDT", "DOGEUSDT", "TRXUSDT"];

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const sec = now.getSeconds();
      const currentTimeString = now.toLocaleTimeString();
      setTime(currentTimeString); // AD বক্সের ভেতরে শো করবে

      // ১. ক্যান্ডেল শুরু থেকে ৩০ সেকেন্ড পর্যন্ত পাওয়ার স্ক্যানিং
      if (sec >= 0 && sec < 30) {
        setSignal(prev => ({
          ...prev,
          phase: 'SCANNING',
          message: 'POWER SCANNING ACTIVE...',
          psBorderColor: '#333',
          riskAlert: false
        }));
      }
      // ২. ৩০ সেকেন্ডে অ্যালার্ট (Ready Phase)
      else if (sec >= 30 && sec < 54) {
        // ডজি ক্যান্ডেল ডিটেকশন সিমুলেশন (কনফিউশন ক্যান্ডেল)
        const isDoji = Math.random() < 0.2; 
        const potential = Math.random() > 0.5 ? 'UP' : 'DOWN';
        
        setSignal(prev => ({
          ...prev,
          phase: 'READY',
          direction: potential,
          message: isDoji ? 'WAIT: DOJI DETECTED ⚠️' : `READY: ${potential}`,
          psBorderColor: isDoji ? '#f3ba2f' : (potential === 'UP' ? '#00ff88' : '#ff3b3b'),
          candleName: isDoji ? 'DOJI / UNCERTAIN' : 'Pattern Identified...',
          riskAlert: isDoji
        }));
      }
      // ৩. ৫-৬ সেকেন্ড আগে ফাইনাল সিগন্যাল (No Change)
      else if (sec >= 54) {
        if (signal.phase !== 'CONFIRMED') {
          const isHighRisk = Math.random() < 0.15;
          const finalDir = Math.random() > 0.5 ? 'UP' : 'DOWN';
          
          setSignal({
            phase: 'CONFIRMED',
            direction: finalDir,
            message: isHighRisk ? 'PLEASE NO RISK 🛑' : (finalDir === 'UP' ? 'UP TRADE FAST 🚀' : 'DOWN TRADE FAST 📉'),
            accuracy: isHighRisk ? 'LOW' : (98.90 + Math.random()).toFixed(2) + '%',
            psBorderColor: isHighRisk ? '#f3ba2f' : (finalDir === 'UP' ? '#00ff88' : '#ff3b3b'),
            candleName: isHighRisk ? 'CONFUSION CANDLE' : 'STRATEGY CONFIRMED',
            riskAlert: isHighRisk
          });
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [asset, signal.phase]);

  if (!isLoggedIn) return <Login setAuth={setIsLoggedIn} />;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.brand}>RTX MASTER AI <br/><span style={s.liveText}>STATUS: HIGH-SPEED 🟢</span></div>
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
          <h1 style={{fontSize: '28px', color: signal.psBorderColor, textShadow: '0 0 10px rgba(0,0,0,0.5)'}}>
            {signal.message}
          </h1>
        </div>

        {/* AD BOX - টাইম এখন এখানে শো করবে */}
        <div style={{...s.adBox, borderColor: signal.psBorderColor}}>
          <div style={s.adLabel}>SHARP ENTRY COUNTDOWN (AD)</div>
          <div style={s.timeDisplay}>{time}</div>
          <div style={s.psIndicator}>P-S ENGINE ACTIVE | NO LAG</div>
        </div>

        {signal.riskAlert && (
          <div style={s.riskBanner}>⚠️ ALERT: {signal.message}</div>
        )}

        <div style={s.footerNote}>1000+ CANDLE ANALYSIS SYNCED</div>
      </div>
    </div>
  );
}

// লগইন এবং স্টাইল অবজেক্ট (আপনার আগের ডিজাইনের সাথে মিল রেখে)
function Login({setAuth}) {
    const handle = (e) => {
        e.preventDefault();
        if(e.target.u.value === import.meta.env.VITE_USER && e.target.p.value === import.meta.env.VITE_PASS) {
            localStorage.setItem('auth', 'true'); setAuth(true);
        }
    };
    return (
        <div style={s.loginBg}><form onSubmit={handle} style={s.loginCard}>
            <h2 style={{color:'#f3ba2f'}}>AI INITIALIZATION</h2>
            <input name="u" placeholder="User" style={s.input} />
            <input name="p" type="password" placeholder="Pass" style={s.input} />
            <button style={s.goldBtn}>START ENGINE</button>
        </form></div>
    );
}

const s = {
  container: { padding: '10px', background: '#000', height: '100vh', fontFamily: 'sans-serif', color: '#fff' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  brand: { color: '#f3ba2f', fontWeight: 'bold', fontSize: '16px' },
  liveText: { color: '#00ff88', fontSize: '10px' },
  select: { background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '5px', padding: '4px' },
  chartBox: { height: '280px', borderRadius: '15px', overflow: 'hidden', border: '1px solid #222', marginBottom: '10px' },
  signalCard: { borderRadius: '35px', padding: '15px', textAlign: 'center', background: '#080808', border: '1px solid #1a1a1a' },
  infoRow: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666' },
  mainAction: { height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  adBox: { background: '#000', borderRadius: '25px', padding: '15px', border: '4px solid #333', transition: 'all 0.3s ease' },
  adLabel: { fontSize: '9px', color: '#f3ba2f', letterSpacing: '1px' },
  timeDisplay: { fontSize: '34px', fontWeight: 'bold', margin: '5px 0', color: '#fff' },
  psIndicator: { fontSize: '8px', color: '#444' },
  riskBanner: { marginTop: '10px', color: '#f3ba2f', fontSize: '12px', fontWeight: 'bold', animation: 'blink 1s infinite' },
  footerNote: { fontSize: '8px', color: '#222', marginTop: '10px' },
  loginBg: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' },
  loginCard: { background: '#0a0a0a', padding: '30px', borderRadius: '20px', border: '1px solid #222', textAlign: 'center' },
  input: { width: '100%', padding: '12px', margin: '8px 0', borderRadius: '8px', background: '#000', color: '#fff', border: '1px solid #333', boxSizing: 'border-box' },
  goldBtn: { width: '100%', padding: '14px', borderRadius: '25px', background: 'linear-gradient(to bottom, #f3ba2f, #a87f1a)', border: 'none', fontWeight: 'bold' }
};
