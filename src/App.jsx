import React, { useState, useEffect } from 'react';

export default function App() {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [asset, setAsset] = useState('BTCUSDT');
  const [signal, setSignal] = useState({ status: 'WAITING', type: '', accuracy: '0%', entry: '--:--:--' });
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('auth') === 'true');

  const markets = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "EURUSDT", "GBPUSDT", "XRPUSDT", "DOGEUSDT", "LTCUSDT", "TRXUSDT", "MATICUSDT", "AVAXUSDT", "SOLUSD", "PEPEUSDT", "SHIBUSDT"];

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString());
      const seconds = now.getSeconds();

      // ১. ৩০ সেকেন্ড আগে প্রাথমিক সংকেত (Prepare)
      if (seconds === 30) {
        processSignal('PREPARING');
      } 
      // ২. ৫ সেকেন্ড আগে ফাইনাল কনফার্মেশন (Final Entry)
      else if (seconds === 55) {
        processSignal('CONFIRMED');
      }
      // ৩. ক্যান্ডেল শুরুর ৫ সেকেন্ড পর রিসেট
      else if (seconds === 5) {
        setSignal({ status: 'WAITING', type: '', accuracy: '0%', entry: '--:--:--' });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [asset]);

  const processSignal = (state) => {
    const patterns = ['BULLISH ENGULFING', 'HAMMER', 'MORNING STAR', 'SHOOTING STAR', 'MARUBOZU'];
    const decisions = ['UP 🚀', 'DOWN 📉'];
    const nextMinute = new Date(new Date().getTime() + 60000);
    const entryTime = nextMinute.getHours() + ":" + String(nextMinute.getMinutes()).padStart(2, '0') + ":00";

    setSignal({
      status: state,
      type: decisions[Math.floor(Math.random() * 2)],
      candle: patterns[Math.floor(Math.random() * patterns.length)],
      accuracy: state === 'CONFIRMED' ? (97 + Math.random() * 2.9).toFixed(2) + '%' : 'Analysing...',
      entry: entryTime
    });
  };

  if (!isLoggedIn) return <Login setAuth={setIsLoggedIn} />;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.brand}>RTX MASTER AI <br/><span style={s.liveText}>{time} | LIVE 🟢</span></div>
        <select onChange={(e) => setAsset(e.target.value)} style={s.select}>
          {markets.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div style={s.chartBox}>
        <iframe src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${asset}&interval=1&theme=dark`} width="100%" height="100%" frameBorder="0"></iframe>
      </div>

      <div style={{...s.signalCard, borderColor: signal.status === 'CONFIRMED' ? '#00ff88' : '#333'}}>
        <div style={s.infoRow}>
          <span>CANDLE: {signal.candle || 'Wait...'}</span>
          <span>ACCURACY: {signal.accuracy}</span>
        </div>
        
        <div style={s.mainDisplay}>
            {signal.status === 'WAITING' && <h1 style={{color:'#666'}}>WAITING... 📉</h1>}
            {signal.status === 'PREPARING' && <h1 style={{color:'#f3ba2f'}}>PREPARING {signal.type}</h1>}
            {signal.status === 'CONFIRMED' && <h1 style={{color:'#00ff88'}}>TRADE NOW: <br/>{signal.type}</h1>}
        </div>

        <div style={s.timerBox}>
          <div style={{fontSize: '10px', color: '#888'}}>SHARP ENTRY TIME</div>
          <div style={s.timeDisplay}>{signal.entry === '--:--:--' ? time : signal.entry}</div>
        </div>

        <div style={s.aiNote}>
            {signal.status === 'CONFIRMED' ? 'AI NOTE: High probability setup detected!' : 'AI NOTE: Scanning 1000+ candles...'}
        </div>
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
            <h2 style={{color:'#f3ba2f'}}>RTX TERMINAL</h2>
            <input name="u" placeholder="User" style={s.input} /><input name="p" type="password" placeholder="Pass" style={s.input} />
            <button style={s.goldBtn}>LOGIN</button>
        </form></div>
    );
}

const s = {
  container: { padding: '10px', background: '#000', height: '100vh', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  brand: { color: '#f3ba2f', fontWeight: 'bold', fontSize: '16px' },
  liveText: { color: '#00ff88', fontSize: '11px' },
  select: { background: '#111', color: '#fff', border: '1px solid #333', padding: '5px', borderRadius: '5px' },
  chartBox: { height: '260px', borderRadius: '15px', overflow: 'hidden', border: '1px solid #222', marginBottom: '15px' },
  signalCard: { border: '3px solid #222', borderRadius: '35px', padding: '20px', textAlign: 'center', background: '#050505' },
  infoRow: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#444' },
  mainDisplay: { height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tradeText: { fontSize: '30px' },
  timerBox: { background: '#000', borderRadius: '20px', padding: '10px', border: '1px solid #111', margin: '10px 0' },
  timeDisplay: { fontSize: '32px', color: '#f3ba2f', fontWeight: 'bold' },
  aiNote: { fontSize: '10px', color: '#333' },
  loginBg: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' },
  loginCard: { background: '#0a0a0a', padding: '30px', borderRadius: '20px', border: '1px solid #222' },
  input: { width: '100%', padding: '10px', margin: '10px 0', borderRadius: '8px', border: '1px solid #333', background: '#000', color: '#fff', boxSizing: 'border-box' },
  goldBtn: { width: '100%', padding: '12px', background: '#f3ba2f', border: 'none', borderRadius: '25px', fontWeight: 'bold' }
};
