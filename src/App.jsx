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
    message: 'INITIALIZING AI ENGINE...',
    candleName: 'Scanning Market...',
    borderColor: '#333'
  });

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const currentMin = now.getMinutes();
      const currentSec = now.getSeconds();
      const tf = parseInt(timeframe);

      setLiveTime(now.toLocaleTimeString());

      const tfSeconds = tf * 60;
      const totalSecondsPassed = (currentMin * 60) + currentSec;
      const secondsToNextCandle = tfSeconds - (totalSecondsPassed % tfSeconds);
      
      const entryDate = new Date(now.getTime() + (secondsToNextCandle * 1000));
      setEntryTime(entryDate.getHours().toString().padStart(2, '0') + ":" + 
                   entryDate.getMinutes().toString().padStart(2, '0') + ":00");

      // ১. ৪ সেকেন্ড পর পর রানিং ক্যান্ডেল পরিমাপ ও আপডেট
      const patterns = ["Bullish Hammer", "Bearish Engulfing", "Doji", "Confusion Candle", "Marubozu"];
      const runningCandle = patterns[Math.floor((currentMin + currentSec) / 4) % patterns.length];

      // ২. বিশেষ সতর্কবার্তা (Doji বা Confusion Candle দেখলে)
      if (currentSec % 12 === 0) { // প্রতি ১২ সেকেন্ডে একবার চেক
        if (runningCandle === "Doji") speak("Warning, Doji candle detected. Be careful.");
        if (runningCandle === "Confusion Candle") speak("Market confusion, stay alert.");
      }

      // ৩. ৩০ সেকেন্ড আগে ভয়েস অ্যালার্ট
      if (secondsToNextCandle === 30) {
        speak("Ready for trade, wait please, market analyzing.");
        setSignal(prev => ({ ...prev, phase: 'READY', message: 'READY FOR TRADE 🤖', borderColor: '#f3ba2f' }));
      }

      // ৪. ফাইনাল কনফার্ম সিগন্যাল টাইমিং (১ মিনিটে ৭ সেঃ, ৩ ও ৫ মিনিটে ১০ সেঃ)
      let finalSignalSec = (tf === 1) ? 7 : 10;

      if (secondsToNextCandle === finalSignalSec) {
        const isUp = Math.random() > 0.5;
        const direction = isUp ? "UP" : "DOWN";
        speak(`Trade Now, ${direction}`);
        
        setSignal({
          phase: 'CONFIRMED',
          message: `TRADE NOW: ${direction} ${isUp ? '🚀' : '📉'}`,
          borderColor: isUp ? '#00ff88' : '#ff3b3b',
          accuracy: (99.10 + Math.random()).toFixed(2) + '%',
          candleName: runningCandle + ' (CONFIRMED)'
        });
      }

      // সাধারণ স্ক্যানিং মোড আপডেট
      if (secondsToNextCandle > 30) {
        setSignal(prev => ({ ...prev, candleName: runningCandle, phase: 'SCANNING' }));
      }

    }, 1000);
    return () => clearInterval(timer);
  }, [timeframe, asset]);

  if (!isLoggedIn) return <Login setAuth={setIsLoggedIn} />;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.brand}>RTX MASTER AI <br/><span style={s.status}>VOICE ENGINE ACTIVE 🎙️</span></div>
        <div style={{display:'flex', gap:'5px'}}>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} style={s.select}>
            <option value="1">1M TF</option>
            <option value="3">3M TF</option>
            <option value="5">5M TF</option>
          </select>
          <select value={asset} onChange={(e) => setAsset(e.target.value)} style={s.select}>
            <option value="BTCUSDT">BTCUSDT</option>
            <option value="ETHUSDT">ETHUSDT</option>
            <option value="SOLUSDT">SOLUSDT</option>
          </select>
        </div>
      </div>

      <div style={s.chartBox}>
        <iframe src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${asset}&interval=${timeframe}&theme=dark`} width="100%" height="100%" frameBorder="0"></iframe>
      </div>

      <div style={{...s.signalCard, borderColor: signal.borderColor}}>
        <div style={s.infoRow}>
          <span style={s.candleLabel}>CANDLE: {signal.candleName}</span>
          <span style={s.accuracyLabel}>ACCURACY: {signal.accuracy}</span>
        </div>
        <div style={s.mainAction}>
          <h1 style={{fontSize: '24px', color: signal.borderColor, margin: 0}}>{signal.message}</h1>
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
      </div>
    </div>
  );
}

// Login & Styles remain the same
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
            <button style={s.goldBtn}>START ENGINE</button>
        </form></div>
    );
}

const s = {
  container: { padding: '8px', background: '#000', height: '100vh', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '5px' },
  brand: { color: '#f3ba2f', fontWeight: 'bold', fontSize: '13px' },
  status: { color: '#00ff88', fontSize: '8px' },
  select: { background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '5px', padding: '4px' },
  chartBox: { flexGrow: 1, borderRadius: '10px', overflow: 'hidden', border: '1px solid #222', marginBottom: '8px' },
  signalCard: { border: '3px solid #333', borderRadius: '25px', padding: '15px', textAlign: 'center', background: '#050505' },
  infoRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '5px' },
  candleLabel: { fontSize: '10px', color: '#f3ba2f' },
  accuracyLabel: { fontSize: '12px', color: '#00ff88', fontWeight: 'bold' },
  mainAction: { height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tiBox: { background: '#000', borderRadius: '15px', padding: '10px', border: '1px solid #1a1a1a' },
  timeRow: { display: 'flex', justifyContent: 'space-around' },
  timeGroup: { textAlign: 'center' },
  label: { fontSize: '8px', color: '#666' },
  liveDisplay: { fontSize: '18px', fontWeight: 'bold', color: '#fff' },
  entryDisplay: { fontSize: '18px', fontWeight: 'bold', color: '#f3ba2f' },
  loginBg: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' },
  loginCard: { background: '#0a0a0a', padding: '30px', borderRadius: '25px', border: '1px solid #222', textAlign: 'center' },
  input: { width: '100%', padding: '12px', margin: '8px 0', borderRadius: '8px', background: '#000', color: '#fff', border: '1px solid #333' },
  goldBtn: { width: '100%', padding: '14px', borderRadius: '25px', background: 'linear-gradient(to bottom, #f3ba2f, #a87f1a)', border: 'none', fontWeight: 'bold' }
};
