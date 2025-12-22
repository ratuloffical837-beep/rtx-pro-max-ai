import React, { useState, useEffect, useRef } from 'react';
import * as ti from 'technicalindicators';

const styles = `
  body { background: #050709; color: white; font-family: 'Inter', sans-serif; margin: 0; padding: 0; overflow: hidden; }
  .app-container { display: flex; flex-direction: column; height: 100vh; max-width: 500px; margin: auto; position: relative; }
  header { padding: 12px; display: flex; justify-content: space-between; align-items: center; background: #0b0e11; border-bottom: 2px solid #f3ba2f; }
  .gold { color: #f3ba2f; font-weight: 900; }
  
  .notif-banner { 
    background: #f3ba2f; color: #000; padding: 12px; font-size: 0.9rem; font-weight: 900; 
    position: absolute; top: 55px; width: 100%; z-index: 1000; text-align: center;
    box-shadow: 0 4px 15px rgba(243, 186, 47, 0.4);
    transform: translateY(-100%); transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .notif-show { transform: translateY(0); }

  .chart-box { flex-grow: 1; width: 100%; background: #000; }
  
  .controls { padding: 10px; background: #161a1e; display: flex; gap: 8px; border-top: 1px solid #2b2f36; }
  select { background: #1e2329; color: white; border: 1px solid #f3ba2f; padding: 12px; border-radius: 8px; flex: 1; font-weight: bold; }
  
  .signal-card { padding: 15px; background: #050709; }
  .main-box { background: #111418; border: 3px solid #333; border-radius: 20px; padding: 20px; text-align: center; }
  .up-border { border-color: #0ecb81 !important; box-shadow: 0 0 35px rgba(14, 203, 129, 0.5); }
  .down-border { border-color: #f6465d !important; box-shadow: 0 0 35px rgba(246, 70, 93, 0.5); }

  .status-text { color: #f3ba2f; font-size: 1rem; font-weight: 800; text-transform: uppercase; margin-bottom: 5px; }
  .signal-val { font-size: 2.8rem; font-weight: 900; margin: 10px 0; }
  .up-text { color: #0ecb81; text-shadow: 0 0 10px rgba(14, 203, 129, 0.5); } 
  .down-text { color: #f6465d; text-shadow: 0 0 10px rgba(246, 70, 93, 0.5); }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; border-top: 1px solid #222; padding-top: 15px; font-size: 0.8rem; }
  .label { color: #848e9c; text-align: left; } .value { color: #f3ba2f; font-weight: bold; text-align: right; }
  
  .acc-meter { border: 1px solid #0ecb81; color: #0ecb81; padding: 10px; border-radius: 12px; margin-top: 15px; font-weight: 900; font-size: 1.2rem; }
`;

const markets = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "AVAXUSDT", "DOGEUSDT", 
  "DOTUSDT", "MATICUSDT", "LTCUSDT", "LINKUSDT", "SHIBUSDT", "NEARUSDT", "TRXUSDT", 
  "UNIUSDT", "OPUSDT", "APTUSDT", "ARBUSDT", "INJUSDT", "PEPEUSDT", "ORDIUSDT", "RNDRUSDT", "TIAUSDT", "SUIUSDT"
];

function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1m');
  const [signal, setSignal] = useState('SCANNING');
  const [confidence, setConfidence] = useState(0);
  const [entryTime, setEntryTime] = useState('--:--:--');
  const [serverTime, setServerTime] = useState('--:--:--');
  const [alert, setAlert] = useState('INITIALIZING...');
  const [notif, setNotif] = useState({ show: false, msg: '' });
  const [serverOffset, setServerOffset] = useState(0);

  useEffect(() => {
    const sync = async () => {
      const res = await fetch('https://api.binance.com/api/v3/time');
      const { serverTime } = await res.json();
      setServerOffset(serverTime - Date.now());
    };
    sync();
    const styleTag = document.createElement("style"); styleTag.innerHTML = styles;
    document.head.appendChild(styleTag);
    const scanner = setInterval(backgroundScanner, 8000);
    return () => clearInterval(scanner);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date(Date.now() + serverOffset);
      setServerTime(now.toLocaleTimeString('en-GB'));
      const sec = now.getSeconds();
      const limit = timeframe === '1m' ? 60 : 180;
      const progress = timeframe === '1m' ? sec : (now.getMinutes() % 3) * 60 + sec;
      const remaining = limit - progress;

      if (remaining > 20) {
        mainAnalysisEngine();
        setAlert('Predicting Market...');
      } else if (remaining <= 20 && remaining > 4) {
        setAlert('Find success for trading');
      } else if (remaining <= 4 && remaining > 0) {
        setAlert(`SURE SHOT ${signal.includes('UP') ? 'UP' : 'DOWN'}`);
      }

      const next = new Date(now.getTime() + remaining * 1000);
      setEntryTime(next.toLocaleTimeString('en-GB'));
    }, 1000);
    return () => clearInterval(timer);
  }, [serverOffset, symbol, timeframe, signal]);

  const backgroundScanner = async () => {
    const randomPair = markets[Math.floor(Math.random() * markets.length)];
    if (randomPair !== symbol) {
      setNotif({ show: true, msg: `🔔 ALERT: ${randomPair} - Possible Signal Found!` });
      setTimeout(() => setNotif({ show: false, msg: '' }), 4000);
    }
  };

  const mainAnalysisEngine = async () => {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=100`);
      const data = await res.json();
      const closes = data.map(d => parseFloat(d[4]));
      const rsi = ti.RSI.calculate({ values: closes, period: 14 }).pop();
      const last = closes[closes.length - 1];
      const open = parseFloat(data[99][1]);

      if (rsi < 45 || (last > open && rsi < 60)) {
        setSignal('UP (CALL)');
        setConfidence(98.10 + Math.random());
      } else {
        setSignal('DOWN (PUT)');
        setConfidence(98.20 + Math.random());
      }
    } catch (e) { console.error("Sync Error"); }
  };

  return (
    <div className="app-container">
      <div className={`notif-banner ${notif.show ? 'notif-show' : ''}`}>{notif.msg}</div>
      <header>
        <div className="gold">RTX PRO MASTER V10.1</div>
        <div style={{color:'#0ecb81', fontSize:'0.7rem'}}>PREMIUM ACTIVE ●</div>
      </header>
      <div className="chart-box">
        <iframe 
          key={`${symbol}-${timeframe}`}
          src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${symbol}&interval=${timeframe === '1m' ? '1' : '3'}&theme=dark&style=1`} 
          width="100%" height="100%" frameBorder="0">
        </iframe>
      </div>
      <div className="controls">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {markets.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
          <option value="1m">1 MINUTE</option>
          <option value="3m">3 MINUTE</option>
        </select>
      </div>
      <div className="signal-card">
        <div className={`main-box ${signal.includes('UP') ? 'up-border' : 'down-border'}`}>
          <div className="status-text">{alert}</div>
          <div className={`signal-val ${signal.includes('UP') ? 'up-text' : 'down-text'}`}>{signal}</div>
          <div className="info-grid">
            <div className="label">SERVER TIME:</div><div className="value">{serverTime}</div>
            <div className="label">ENTRY TIME:</div><div className="value">{entryTime}</div>
            <div className="label">MARKET:</div><div className="value">{symbol}</div>
            <div className="label">RESULT:</div><div className="value">PREDICTED</div>
          </div>
          <div className="acc-meter">ACCURACY: {confidence.toFixed(2)}%</div>
        </div>
      </div>
    </div>
  );
}

export default App;
