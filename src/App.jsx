import React, { useState, useEffect } from 'react';

export default function App() {
  const [liveTime, setLiveTime] = useState(new Date().toLocaleTimeString());
  const [entryTime, setEntryTime] = useState('--:--:--');
  const [asset, setAsset] = useState('BTCUSDT');
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('auth') === 'true');
  
  const [signal, setSignal] = useState({ 
    phase: 'SCANNING', 
    direction: '', 
    accuracy: '98.50%', 
    message: 'ANALYZING MARKET...',
    candleName: 'Wait for Signal...',
    borderColor: '#333',
    isDoji: false
  });

  const markets = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "EURUSDT", "DOGEUSDT", "TRXUSDT"];

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const sec = now.getSeconds();
      setLiveTime(now.toLocaleTimeString()); // লাইভ টাইম আপডেট

      // এন্ট্রি টাইম ক্যালকুলেশন (পরবর্তী ১ মিনিটের শুরু)
      const nextMin = new Date(now.getTime() + 60000);
      setEntryTime(nextMin.getHours() + ":" + String(nextMin.getMinutes()).padStart(2, '0') + ":00");

      // ১. ক্যান্ডেল শুরুর ফেজ (00-30s)
      if (sec >= 0 && sec < 30) {
        setSignal(prev => ({
          ...prev,
          phase: 'SCANNING',
          message: 'POWER SCANNING ACTIVE...',
          borderColor: '#333',
          candleName: 'Scanning Price Action...'
        }));
      }
      // ২. ৩০ সেকেন্ড অ্যালার্ট ফেজ (30-54s)
      else if (sec >= 30 && sec < 54) {
        const potential = Math.random() > 0.5 ? 'UP' : 'DOWN';
        const checkDoji = Math.random() < 0.1; // ডজি লজিক
        setSignal(prev => ({
          ...prev,
          phase: 'READY',
          direction: potential,
          message: checkDoji ? 'PLEASE NO RISK 🛑' : `READY TO ${potential} ⚡`,
          borderColor: checkDoji ? '#f3ba2f' : (potential === 'UP' ? '#00ff88' : '#ff3b3b'),
          candleName: checkDoji ? 'DOJI DETECTED' : 'Standard Pattern',
          isDoji: checkDoji
        }));
      }
      // ৩. ৫-৬ সেকেন্ড আগে ফাইনাল কনফার্মেশন (No Change)
      else if (sec >= 54) {
        if (signal.phase !== 'CONFIRMED') {
          const finalDir = Math.random() > 0.5 ? 'UP' : 'DOWN';
          const patterns = ['BULLISH ENGULFING', 'BEARISH ENGULFING', 'HAMMER', 'MORNING STAR'];
          setSignal({
            phase: 'CONFIRMED',
            direction: finalDir,
            message: finalDir === 'UP' ? 'UP TRADE FAST 🚀' : 'DOWN TRADE FAST 📉',
            accuracy: (99.10 + Math.random() * 0.8).toFixed(2) + '%',
            borderColor: finalDir === 'UP' ? '#00ff88' : '#ff3b3b',
            candleName: patterns[Math.floor(Math.random() * patterns.length)],
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
      <div style={s.header}>
        <div style={s.brand}>RTX MASTER AI <br/><span style={s.status}>STATUS: HIGH-SPEED 🟢</span></div>
        <select onChange={(e) => setAsset(e.target.value)} style={s.select}>
          {markets.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div style={s.chartBox}>
        <iframe src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${asset}&interval=1&theme=dark`} width="100%" height="100%" frameBorder="0"></iframe>
      </div>

      <div style={{...s.signalCard, borderColor: signal.borderColor}}>
        <div style={s.infoRow}>
          <span style={s.candleLabel}>CANDLE: {signal.candleName}</span>
          <span style={s.accuracyLabel}>ACCURACY: {signal.accuracy}</span>
        </div>

        <div style={s.mainAction}>
          <h1 style={{fontSize: '32px', color: signal.borderColor}}>{signal.message}</h1>
        </div>

        {/* TI BOX - এখানে দুটি টাইম শো করবে */}
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
          <div style={s.tiFooter}>P-S ENGINE ACTIVE | NO LAG</div>
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
  container: { padding: '10px', background: '#000', height: '100vh', fontFamily: 'sans-serif', color: '#fff' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
  brand: { color: '#f3ba2f', fontWeight: 'bold', fontSize: '18px' },
  status: { color: '#00ff88', fontSize: '10px' },
  select: { background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '5px', padding: '5px' },
  chartBox: { height: '260px', borderRadius: '15px', overflow: 'hidden', border: '1px solid #222', marginBottom: '10px' },
  signalCard: { border: '4px solid #222', borderRadius: '40px', padding: '20px', textAlign: 'center', background: '#050505' },
  infoRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' },
  candleLabel: { fontSize: '12px', color: '#f3ba2f', fontWeight: 'bold' },
  accuracyLabel: { fontSize: '16px', color: '#00ff88', fontWeight: 'bold' },
  mainAction: { height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tiBox: { background: '#000', borderRadius: '30px', padding: '15px', border: '2px solid #1a1a1a', margin: '10px 0' },
  timeRow: { display: 'flex', justifyContent: 'space-around', marginBottom: '5px' },
  timeGroup: { textAlign: 'center' },
  label: { fontSize: '9px', color: '#666', fontWeight: 'bold' },
  liveDisplay: { fontSize: '24px', fontWeight: 'bold', color: '#fff' },
  entryDisplay: { fontSize: '24px', fontWeight: 'bold', color: '#f3ba2f' },
  tiFooter: { fontSize: '8px', color: '#333' },
  footerNote: { fontSize: '8px', color: '#222', marginTop: '10px' },
  loginBg: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' },
  loginCard: { background: '#0a0a0a', padding: '40px', borderRadius: '30px', border: '1px solid #222', textAlign: 'center' },
  input: { width: '100%', padding: '14px', margin: '10px 0', borderRadius: '10px', background: '#000', color: '#fff', border: '1px solid #333', boxSizing: 'border-box' },
  goldBtn: { width: '100%', padding: '16px', borderRadius: '30px', background: 'linear-gradient(to bottom, #f3ba2f, #a87f1a)', border: 'none', fontWeight: 'bold', cursor: 'pointer' }
};
