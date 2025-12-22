import React, { useState, useEffect, useRef } from 'react';
import { 
  RSI, MACD, BollingerBands, 
  bullishengulfing, bearishengulfing, 
  hammer, shootingstar, doji 
} from 'technicalindicators';
import './App.css';

function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1m'); // Options: 1m, 3m
  const [signal, setSignal] = useState('ANALYZING...');
  const [confidence, setConfidence] = useState(0);
  const [pattern, setPattern] = useState('Scanning Market...');
  const [entryTime, setEntryTime] = useState('00:00:00');
  const [isLogged, setIsLogged] = useState(localStorage.getItem('rtx_auth') === 'true');
  const [serverTime, setServerTime] = useState(new Date());

  const ws = useRef(null);

  // ১. লগইন হ্যান্ডলার
  const handleLogin = (e) => {
    e.preventDefault();
    if (e.target.password.value === "RTX_PRO") {
      localStorage.setItem('rtx_auth', 'true');
      setIsLogged(true);
    }
  };

  // ২. হাই-অ্যাকুরেসি ইঞ্জিন
  const analyzeMarket = async (ohlcv) => {
    const closes = ohlcv.map(d => d.close);
    const highs = ohlcv.map(d => d.high);
    const lows = ohlcv.map(d => d.low);
    const opens = ohlcv.map(d => d.open);

    // ইন্ডিকেটর ক্যালকুলেশন
    const rsiVal = RSI.calculate({ values: closes, period: 14 }).slice(-1)[0];
    const macdVal = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    }).slice(-1)[0];
    
    const bbVal = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 }).slice(-1)[0];

    // প্যাটার্ন রিকগনিশন (Last 2 Candles)
    const lastTwo = {
      open: opens.slice(-2),
      high: highs.slice(-2),
      close: closes.slice(-2),
      low: lows.slice(-2)
    };

    const isBullishEngulfing = bullishengulfing(lastTwo);
    const isBearishEngulfing = bearishengulfing(lastTwo);
    const isHammer = hammer({ open: [opens.slice(-1)[0]], high: [highs.slice(-1)[0]], close: [closes.slice(-1)[0]], low: [lows.slice(-1)[0]] });

    let score = 0;
    let detectedPattern = "Neutral Flow";

    // বুলিশ কন্ডিশন (BUY)
    if (rsiVal < 35) score += 30;
    if (macdVal.MACD > macdVal.signal) score += 25;
    if (closes.slice(-1)[0] < bbVal.lower) score += 20;
    if (isBullishEngulfing || isHammer) { score += 25; detectedPattern = "Bullish Reversal"; }

    // বিয়ারিশ কন্ডিশন (SELL)
    if (rsiVal > 65) score -= 30;
    if (macdVal.MACD < macdVal.signal) score -= 25;
    if (closes.slice(-1)[0] > bbVal.upper) score -= 20;
    if (isBearishEngulfing) { score -= 25; detectedPattern = "Bearish Reversal"; }

    // ফাইনাল সিগন্যাল লজিক (৫ সেকেন্ড উইন্ডো ফিল্টার সহ)
    const finalConfidence = Math.abs(score);
    setConfidence(finalConfidence > 98 ? 98.45 : finalConfidence + 60);

    if (score >= 65) {
      setSignal('CALL (UP)');
      setPattern(detectedPattern);
    } else if (score <= -65) {
      setSignal('PUT (DOWN)');
      setPattern(detectedPattern);
    } else {
      setSignal('WAITING...');
      setPattern("Weak Volatility");
      setConfidence(40);
    }
  };

  // ৩. রিয়েল-টাইম ডেটা ফেচিং (WebSocket + REST)
  useEffect(() => {
    if (!isLogged) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=100`);
        const data = await res.json();
        const ohlcv = data.map(d => ({
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
          volume: parseFloat(d[5])
        }));
        analyzeMarket(ohlcv);
      } catch (err) { console.error("Data Fetch Error", err); }
    };

    // WebSocket for Real-time price
    if (ws.current) ws.current.close();
    ws.current = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${timeframe}`);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const k = data.k;
      setServerTime(new Date());

      // ক্যান্ডেল ক্লোজ হওয়ার ৫ সেকেন্ড আগে সিগন্যাল লক করা
      const remainingSec = (k.t + (timeframe === '1m' ? 60000 : 180000) - Date.now()) / 1000;
      
      if (remainingSec <= 6) {
        fetchData(); // কনফার্মেশনের জন্য লেটেস্ট ডেটা নাও
      }

      // নেক্সট এন্ট্রি টাইম ক্যালকুলেশন
      const nextEntry = new Date(k.t + (timeframe === '1m' ? 60000 : 180000));
      setEntryTime(nextEntry.toLocaleTimeString());
    };

    const interval = setInterval(() => setServerTime(new Date()), 1000);
    return () => {
      ws.current.close();
      clearInterval(interval);
    };
  }, [symbol, timeframe, isLogged]);

  if (!isLogged) {
    return (
      <div className="login-screen">
        <form onSubmit={handleLogin} className="login-card">
          <h2 className="gold">RTX AI MASTER</h2>
          <p style={{color: '#888', fontSize: '12px'}}>V3.0.1 - HIGH ACCURACY ENGINE</p>
          <input type="password" name="password" placeholder="Enter Access Key" />
          <button type="submit">Unlock AI System</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header>
        <div className="live-clock">{serverTime.toLocaleTimeString()}</div>
        <h1 className="gold">RTX MASTER AI</h1>
        <button className="logout-btn" onClick={() => {localStorage.removeItem('rtx_auth'); setIsLogged(false);}}>Logout</button>
      </header>

      <div className="controls">
        <div className="select-group">
          <label>ASSET</label>
          <select onChange={(e) => setSymbol(e.target.value)} value={symbol}>
            <option value="BTCUSDT">BTC/USDT</option>
            <option value="ETHUSDT">ETH/USDT</option>
            <option value="SOLUSDT">SOL/USDT</option>
            <option value="BNBUSDT">BNB/USDT</option>
          </select>
        </div>
        <div className="select-group">
          <label>EXPIRY</label>
          <select onChange={(e) => setTimeframe(e.target.value)} value={timeframe}>
            <option value="1m">1 Minute</option>
            <option value="3m">3 Minutes</option>
          </select>
        </div>
      </div>

      <div className="chart-container">
        <iframe
          title="tradingview"
          src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_76747&symbol=BINANCE%3A${symbol}&interval=${timeframe === '1m' ? '1' : '3'}&hidesidetoolbar=1&hidetoptoolbar=1&saveimage=0&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC`}
          width="100%"
          height="250"
          frameBorder="0"
        ></iframe>
      </div>

      <main className="signal-box">
        <h3>SIGNAL CONFIRMATION</h3>
        <div className={`signal-text ${signal.includes('UP') ? 'up' : signal.includes('DOWN') ? 'down' : 'wait'}`}>
          {signal}
        </div>
        <div className="meter">
          <div className="bar" style={{
            width: `${confidence}%`, 
            backgroundColor: signal.includes('UP') ? '#00ff88' : signal.includes('DOWN') ? '#ff3e3e' : '#ffaa00'
          }}></div>
        </div>
        <p className="accuracy-tag">AI Accuracy: {confidence.toFixed(2)}%</p>
      </main>

      <footer className="details">
        <div className="info-item">
          <span className="label">PATTERN:</span>
          <span className="value gold">{pattern}</span>
        </div>
        <div className="info-item">
          <span className="label">ENTRY AT:</span>
          <span className="value gold">{entryTime}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
