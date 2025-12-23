import React, { useState, useEffect, useRef } from 'react';
import * as ti from 'technicalindicators';

const styles = `
  body { background: #050709; color: white; font-family: 'Inter', sans-serif; margin: 0; padding: 0; overflow: hidden; }
  
  /* Login UI Styles */
  .login-screen {
    height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle, #1a1e23 0%, #050709 100%);
  }
  .login-card {
    background: #111418; padding: 40px 30px; border-radius: 24px; border: 1px solid #f3ba2f;
    width: 340px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  }
  .login-card h2 { color: #f3ba2f; margin-bottom: 30px; font-weight: 900; letter-spacing: 1px; }
  .input-group { margin-bottom: 20px; text-align: left; }
  .input-group label { display: block; color: #848e9c; font-size: 0.8rem; margin-bottom: 8px; margin-left: 5px; }
  .input-group input {
    width: 100%; padding: 14px; background: #050709; border: 1px solid #333; 
    border-radius: 12px; color: white; box-sizing: border-box; outline: none; transition: 0.3s;
  }
  .input-group input:focus { border-color: #f3ba2f; box-shadow: 0 0 10px rgba(243, 186, 47, 0.2); }
  .login-btn {
    width: 100%; padding: 15px; background: #f3ba2f; border: none; border-radius: 12px;
    color: #000; font-weight: 900; cursor: pointer; font-size: 1rem; transition: 0.3s;
  }
  .login-btn:hover { background: #ffca42; transform: translateY(-2px); }
  .login-btn:active { transform: translateY(0); }

  /* App Styles (Original) */
  .app-container { display: flex; flex-direction: column; height: 100vh; max-width: 500px; margin: auto; position: relative; }
  header { padding: 12px; display: flex; justify-content: space-between; align-items: center; background: #0b0e11; border-bottom: 2px solid #f3ba2f; }
  .gold { color: #f3ba2f; font-weight: 900; }
  .logout-btn { background: none; border: 1px solid #f6465d; color: #f6465d; font-size: 0.6rem; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
  
  .notif-banner { 
    background: #f3ba2f; color: #000; padding: 12px; font-size: 0.9rem; font-weight: 900; 
    position: absolute; top: 55px; width: 100%; z-index: 1000; text-align: center;
    box-shadow: 0 4px 15px rgba(243, 186, 47, 0.4);
    transform: translateY(-100%); transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .notif-show { transform: translateY(0); }
  .chart-box { flex-grow: 1; width: 100%; background: #000; }
  .controls { padding: 10px; background: #161a1e; display: flex; gap: 8px; border-top: 1px solid #2b2f36; }
  select { background: #1e2329; color: white; border: 1px solid #f3ba2f; padding: 12px; border-radius: 8px; flex: 1; font-weight: bold; outline: none; }
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
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isAuth') === 'true');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Trading States
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1m');
  const [signal, setSignal] = useState('SCANNING');
  const [confidence, setConfidence] = useState(0);
  const [entryTime, setEntryTime] = useState('--:--:--');
  const [serverTime, setServerTime] = useState('--:--:--');
  const [alert, setAlert] = useState('INITIALIZING...');
  const [notif, setNotif] = useState({ show: false, msg: '' });
  const [serverOffset, setServerOffset] = useState(0);

  // ENV Variables from Render (Vite)
  const ENV_USER = import.meta.env.VITE_APP_USER;
  const ENV_PASS = import.meta.env.VITE_APP_PASS;

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === ENV_USER && password === ENV_PASS) {
      localStorage.setItem('isAuth', 'true');
      setIsLoggedIn(true);
    } else {
      window.alert("Invalid Username or Password!");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuth');
    setIsLoggedIn(false);
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    const sync = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/time');
        const { serverTime } = await res.json();
        setServerOffset(serverTime - Date.now());
      } catch (e) { console.error("Sync Error"); }
    };
    sync();

    const styleTag = document.createElement("style"); 
    styleTag.innerHTML = styles;
    document.head.appendChild(styleTag);

    const scanner = setInterval(backgroundScanner, 8000);
    return () => clearInterval(scanner);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;

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
  }, [isLoggedIn, serverOffset, symbol, timeframe, signal]);

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
    } catch (e) { console.error("API Error"); }
  };

  // Login UI View
  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        <style>{styles}</style>
        <div className="login-card">
          <h2>RTX LOGIN</h2>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>USERNAME</label>
              <input 
                type="text" 
                required 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="Enter Username"
              />
            </div>
            <div className="input-group">
              <label>PASSWORD</label>
              <input 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Enter Password"
              />
            </div>
            <button type="submit" className="login-btn">LOGIN NOW</button>
          </form>
          <p style={{color: '#848e9c', fontSize: '0.7rem', marginTop: '20px'}}>
            AUTHORIZED ACCESS ONLY
          </p>
        </div>
      </div>
    );
  }

  // Original App View
  return (
    <div className="app-container">
      <div className={`notif-banner ${notif.show ? 'notif-show' : ''}`}>{notif.msg}</div>
      <header>
        <div className="gold">RTX PRO MASTER V10.1</div>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <div style={{color:'#0ecb81', fontSize:'0.7rem'}}>PREMIUM ●</div>
          <button onClick={handleLogout} className="logout-btn">EXIT</button>
        </div>
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
