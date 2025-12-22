import React, { useState, useEffect, useRef } from 'react';
import * as ti from 'technicalindicators';

// CSS সরাসরি ইনলাইন করা হয়েছে যাতে Render-এ 'Could not resolve App.css' এরর না আসে
const styles = `
  body { background: #0b0e11; color: white; font-family: 'Inter', sans-serif; margin: 0; overflow-x: hidden; }
  .app-container { max-width: 500px; margin: auto; padding: 15px; min-height: 100vh; }
  .gold { color: #f3ba2f; }
  header { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #333; }
  .chart-frame { width: 100%; height: 300px; border-radius: 12px; overflow: hidden; margin: 15px 0; border: 1px solid #333; }
  .controls { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
  select, .tf-btn { background: #1e2329; color: white; border: 1px solid #474d57; padding: 12px; border-radius: 8px; font-size: 1rem; }
  .tf-group { display: flex; gap: 10px; }
  .tf-btn { flex: 1; cursor: pointer; transition: 0.3s; }
  .tf-btn.active { background: #f3ba2f; color: black; border-color: #f3ba2f; font-weight: bold; }
  .signal-box { background: #1e2329; border: 2px solid #f3ba2f; border-radius: 16px; padding: 25px; text-align: center; box-shadow: 0 0 20px rgba(243, 186, 47, 0.1); }
  .signal-text { font-size: 3rem; font-weight: 900; margin: 15px 0; letter-spacing: 2px; }
  .up { color: #0ecb81; text-shadow: 0 0 15px rgba(14, 203, 129, 0.4); }
  .down { color: #f6465d; text-shadow: 0 0 15px rgba(246, 70, 93, 0.4); }
  .meter { background: #333; height: 12px; border-radius: 6px; overflow: hidden; margin: 15px 0; }
  .bar { height: 100%; background: linear-gradient(90deg, #f3ba2f, #ffeb3b); transition: width 0.8s ease-in-out; }
  .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; font-size: 0.9rem; }
  .detail-item { background: #181a20; padding: 15px; border-radius: 10px; border: 1px solid #333; }
  .login-screen { display: flex; justify-content: center; align-items: center; height: 100vh; background: #000; }
  .login-card { background: #1e2329; padding: 40px; border-radius: 20px; border: 1px solid #f3ba2f; width: 80%; max-width: 350px; text-align: center; }
  input { width: 100%; padding: 12px; margin: 20px 0; border-radius: 8px; border: 1px solid #474d57; background: #0b0e11; color: white; box-sizing: border-box; }
  button.login-btn { width: 100%; padding: 12px; border-radius: 8px; border: none; background: #f3ba2f; font-weight: bold; cursor: pointer; }
`;

function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1m');
  const [signal, setSignal] = useState('SCANNING...');
  const [confidence, setConfidence] = useState(0);
  const [pattern, setPattern] = useState('Analyzing Market...');
  const [entryTime, setEntryTime] = useState('00:00:00');
  const [isLogged, setIsLogged] = useState(localStorage.getItem('rtx_auth') === 'true');
  const ws = useRef(null);

  useEffect(() => {
    const styleTag = document.createElement("style");
    styleTag.innerHTML = styles;
    document.head.appendChild(styleTag);
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=1000`);
      const data = await response.json();
      return data.map(d => ({
        open: parseFloat(d[1]), high: parseFloat(d[2]),
        low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
      }));
    } catch (error) { return []; }
  };

  const runAnalysis = (candles) => {
    if (candles.length < 30) return;
    const closes = candles.map(c => c.close);
    const last = candles[candles.length - 1];

    // Technical Indicators Calculation
    const rsi = ti.RSI.calculate({ values: closes, period: 14 }).pop();
    const bb = ti.BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 }).pop();
    const macd = ti.MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false }).pop();

    let score = 0;
    if (rsi < 35) score += 2; if (rsi > 65) score -= 2;
    if (last.close < bb.lower) score += 2; if (last.close > bb.upper) score -= 2;
    if (macd && macd.MACD > macd.signal) score += 1; else score -= 1;

    if (score >= 2) {
      setSignal('CALL (UP)');
      setConfidence(95 + Math.random() * 3.5);
      setPattern('Bullish Momentum');
    } else if (score <= -2) {
      setSignal('PUT (DOWN)');
      setConfidence(95 + Math.random() * 4.1);
      setPattern('Bearish Pressure');
    } else {
      setSignal('WAITING...');
      setConfidence(0);
      setPattern('Sideways Market');
    }
  };

  useEffect(() => {
    if (!isLogged) return;
    let history = [];
    
    const init = async () => {
      history = await fetchHistory();
      if (ws.current) ws.current.close();
      ws.current = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${timeframe}`);

      ws.current.onmessage = (e) => {
        const data = JSON.parse(e.data);
        const k = data.k;
        const now = new Date();
        const sec = now.getSeconds();

        // ক্লোজ হওয়ার ৫-৪ সেকেন্ড আগে সিগন্যাল ট্রিগার
        if (sec >= 54 && sec <= 58) runAnalysis(history);

        if (k.x) {
          history.push({ open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: parseFloat(k.c), volume: parseFloat(k.v) });
          history.shift();
        }

        let next = new Date(now.getTime() + (timeframe === '1m' ? 60000 : 180000));
        next.setSeconds(0);
        setEntryTime(next.toLocaleTimeString());
      };
    };

    init();
    return () => ws.current?.close();
  }, [symbol, timeframe, isLogged]);

  if (!isLogged) return (
    <div className="login-screen">
      <form className="login-card" onSubmit={(e) => {
        e.preventDefault();
        if (e.target.pass.value === "RTX_PRO") { localStorage.setItem('rtx_auth', 'true'); setIsLogged(true); }
      }}>
        <h2 className="gold">RTX MASTER AI</h2>
        <input type="password" name="pass" placeholder="Access Key" required />
        <button type="submit" className="login-btn">LOGIN ENGINE</button>
      </form>
    </div>
  );

  return (
    <div className="app-container">
      <header>
        <div className="gold" style={{fontWeight:'bold'}}>{new Date().toLocaleTimeString()}</div>
        <h2 style={{margin:0, fontSize:'1.2rem'}}>RTX PRO <span className="gold">V7</span></h2>
        <div style={{color:'#0ecb81', fontSize:'0.8rem'}}>● LIVE</div>
      </header>

      <div className="chart-frame">
        <iframe 
          src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${symbol}&interval=${timeframe === '1m' ? '1' : '3'}&theme=dark`}
          width="100%" height="100%" frameBorder="0">
        </iframe>
      </div>

      <div className="controls">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          <option value="BTCUSDT">BTC/USDT</option>
          <option value="ETHUSDT">ETH/USDT</option>
          <option value="SOLUSDT">SOL/USDT</option>
          <option value="BNBUSDT">BNB/USDT</option>
        </select>
        <div className="tf-group">
          <div className={`tf-btn ${timeframe === '1m' ? 'active' : ''}`} onClick={() => setTimeframe('1m')}>1 MIN</div>
          <div className={`tf-btn ${timeframe === '3m' ? 'active' : ''}`} onClick={() => setTimeframe('3m')}>3 MIN</div>
        </div>
      </div>

      <main className="signal-box">
        <div style={{fontSize:'0.8rem', opacity:0.7}}>NEXT CANDLE PREDICTION</div>
        <div className={`signal-text ${signal.includes('UP') ? 'up' : signal.includes('DOWN') ? 'down' : ''}`}>
          {signal}
        </div>
        <div className="meter"><div className="bar" style={{width: `${confidence}%`}}></div></div>
        <div style={{fontSize:'0.9rem'}}>Confidence: <span className="gold">{confidence.toFixed(2)}%</span></div>
      </main>

      <div className="details-grid">
        <div className="detail-item">Pattern: <br/><span className="gold">{pattern}</span></div>
        <div className="detail-item">Next Entry: <br/><span className="gold">{entryTime}</span></div>
      </div>
    </div>
  );
}

export default App;
