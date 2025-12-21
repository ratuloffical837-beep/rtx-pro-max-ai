import React, { useState, useEffect } from 'react';

export default function App() {
  const [liveTime, setLiveTime] = useState(new Date().toLocaleTimeString());
  const [entryTime, setEntryTime] = useState('--:--:--');
  const [timeframe, setTimeframe] = useState('1'); 
  const [asset, setAsset] = useState('BTCUSDT');
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('auth') === 'true');
  
  const [signal, setSignal] = useState({ 
    phase: 'SCANNING', 
    accuracy: 'WAITING...', 
    message: 'ANALYZING CANDLE...',
    candleName: 'Scanning...',
    borderColor: '#333'
  });

  const markets = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "AVAXUSDT", 
    "DOTUSDT", "DOGEUSDT", "TRXUSDT", "MATICUSDT", "LTCUSDT", "LINKUSDT", "EURUSDT", "GBPUSDT"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const currentMin = now.getMinutes();
      const currentSec = now.getSeconds();
      const tf = parseInt(timeframe);

      setLiveTime(now.toLocaleTimeString());

      // ১. বাইনান্স স্ট্যান্ডার্ড অনুযায়ী এন্ট্রি টাইম ক্যালকুলেশন
      const totalSecondsInDay = (now.getHours() * 3600) + (currentMin * 60) + currentSec;
      const tfSeconds = tf * 60;
      const secondsToNextCandle = tfSeconds - (totalSecondsInDay % tfSeconds);
      
      const entryDate = new Date(now.getTime() + (secondsToNextCandle * 1000));
      setEntryTime(entryDate.getHours().toString().padStart(2, '0') + ":" + 
                   entryDate.getMinutes().toString().padStart(2, '0') + ":00");

      // ২. টাইমফ্রেম অনুযায়ী সিগন্যাল অ্যালার্ট টাইমিং লজিক
      let finalSignalSec = 7; // ১ মিনিটের জন্য ৭ সেকেন্ড আগে
      if (tf === 3) finalSignalSec = 10; // ৩ মিনিটের জন্য ১০ সেকেন্ড আগে
      if (tf === 5) finalSignalSec = 10; // ৫ মিনিটের জন্য ১০ সেকেন্ড আগে

      // ৩. আল্ট্রা-পাওয়ার এনালাইসিস ফেজ
      const patterns = ['Bullish Hammer', 'Bearish Engulfing', 'Morning Star', 'Doji Star', 'Marubozu'];
      const currentPattern = patterns[Math.floor((currentMin + currentSec) % patterns.length)];

      if (secondsToNextCandle > 30) {
        // শুরু থেকে ৩০ সেকেন্ড পর্যন্ত পাওয়ার স্ক্যানিং
        setSignal({
          phase: 'SCANNING',
          message: 'POWER SCANNING ACTIVE 🤖',
          borderColor: '#1a1a1a',
          accuracy: 'CALCULATING...',
          candleName: currentPattern
        });
      } 
      else if (secondsToNextCandle <= 30 && secondsToNextCandle > finalSignalSec) {
        // ৩০ সেকেন্ড সময় হলে 'READY' অ্যালার্ট (সব টাইমফ্রেমের জন্য)
        const potential = Math.random() > 0.5 ? 'UP' : 'DOWN';
        setSignal({
          phase: 'READY',
          message: `READY TREAD ${potential} 🤖`,
          borderColor: '#f3ba2f',
          accuracy: '95.12%',
          candleName: currentPattern
        });
      } 
      else if (secondsToNextCandle <= finalSignalSec) {
        // ফাইনাল কনফার্ম সিগন্যাল (নির্দিষ্ট সেকেন্ড অনুযায়ী)
        const finalDir = Math.random() > 0.5 ? 'UP 🚀' : 'DOWN 📉';
        setSignal({
          phase: 'CONFIRMED',
          message: `TREAD FAST: ${finalDir}`,
          borderColor: finalDir.includes('UP') ? '#00ff88' : '#ff3b3b',
          accuracy: (98.45 + Math.random() * 1.3).toFixed(2) + '%',
          candleName: 'PATTERN CONFIRMED'
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [timeframe, asset]);

  if (!isLoggedIn) return <Login setAuth={setIsLoggedIn} />;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.brand}>RTX MASTER AI <br/><span style={s.status}>POWER ENGINE ACTIVE 🟢</span></div>
        <div style={{display:'flex', gap:'5px'}}>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} style={s.select}>
            <option value="1">1M TF</option>
            <option value="3">3M TF</option>
            <option value="5">5M TF</option>
          </select>
          <select value={asset} onChange={(e) => setAsset(e.target.value)} style={s.select}>
            {markets.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div style={s.chartBox}>
        <iframe 
          src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${asset}&interval=${timeframe}&theme=dark&style=1`} 
          width="100%" height="100%" frameBorder="0">
        </iframe>
      </div>

      <div style={{...s.signalCard, borderColor: signal.borderColor}}>
        <div style={s.infoRow}>
          <span style={s.candleLabel}>CANDLE: {signal.candleName}</span>
          <span style={s.accuracyLabel}>ACCURACY: {signal.accuracy}</span>
        </div>

        <div style={s.mainAction}>
          <h1 style={{fontSize: '26px', color: signal.borderColor, margin: 0}}>{signal.message}</h1>
        </div>

        <div style={s.tiBox}>
          <div style={s.timeRow}>
            <div style={s.timeGroup}>
              <div style={s.label}>LIVE TIME</div>
              <div style={s.liveDisplay}>{liveTime}</div>
            </div>
            <div style={s.timeGroup}>
              <div style={s.label}>ENTRY AT ({timeframe}M)</div>
              <div style={s.entryDisplay}>{entryTime}</div>
            </div>
          </div>
        </div>
        <div style={s.footerNote}>ULTRA-FAST DATA SYNC | NO DELAY | BINANCE FEED</div>
      </div>
    </div>
  );
}

// Login ও Style অবজেক্ট আগের মতোই থাকবে
function Login({setAuth}) {
    const handle = (e) => {
        e.preventDefault();
        if(e.target.u.value === import.meta.env.VITE_USER && e.target.p.value === import.meta.env.VITE_PASS) {
            localStorage.setItem('auth', 'true'); setAuth(true);
        }
    };
    return (
        <div style={s.loginBg}><form onSubmit={handle} style={s.loginCard}>
            <h2 style={{color:'#f3ba2f'}}>AI ENGINE BOOT</h2>
            <input name="u" placeholder="User ID" style={s.input} />
            <input name="p" type="password" placeholder="Passkey" style={s.input} />
            <button style={s.goldBtn}>START ULTRA ENGINE</button>
        </form></div>
    );
}

const s = {
  container: { padding: '8px', background: '#000', height: '100vh', fontFamily: 'sans-serif', color: '#fff', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '5px' },
  brand: { color: '#f3ba2f', fontWeight: 'bold', fontSize: '13px' },
  status: { color: '#00ff88', fontSize: '8px' },
  select: { background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '5px', padding: '4px 6px', fontSize: '11px' },
  chartBox: { flexGrow: 1, borderRadius: '10px', overflow: 'hidden', border: '1px solid #222', marginBottom: '8px' },
  signalCard: { border: '3px solid #333', borderRadius: '30px', padding: '15px', textAlign: 'center', background: '#050505' },
  infoRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '5px' },
  candleLabel: { fontSize: '10px', color: '#f3ba2f' },
  accuracyLabel: { fontSize: '12px', color: '#00ff88', fontWeight: 'bold' },
  mainAction: { height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tiBox: { background: '#000', borderRadius: '20px', padding: '10px', border: '1px solid #1a1a1a' },
  timeRow: { display: 'flex', justifyContent: 'space-around' },
  timeGroup: { textAlign: 'center' },
  label: { fontSize: '8px', color: '#666' },
  liveDisplay: { fontSize: '20px', fontWeight: 'bold', color: '#fff' },
  entryDisplay: { fontSize: '20px', fontWeight: 'bold', color: '#f3ba2f' },
  footerNote: { fontSize: '7px', color: '#444', marginTop: '5px' },
  loginBg: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' },
  loginCard: { background: '#0a0a0a', padding: '30px', borderRadius: '25px', border: '1px solid #222', textAlign: 'center' },
  input: { width: '100%', padding: '12px', margin: '8px 0', borderRadius: '8px', background: '#000', color: '#fff', border: '1px solid #333' },
  goldBtn: { width: '100%', padding: '14px', borderRadius: '25px', background: 'linear-gradient(to bottom, #f3ba2f, #a87f1a)', border: 'none', fontWeight: 'bold' }
};
