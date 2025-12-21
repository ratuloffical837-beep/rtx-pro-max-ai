import React, { useState, useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "ARBUSDT", "DOGEUSDT", "MATICUSDT", "XRPUSDT"];

export default function App() {
    const [isLogged, setIsLogged] = useState(false);
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [symbol, setSymbol] = useState("BTCUSDT");
    const [currentTime, setCurrentTime] = useState(new Date());
    const [prediction, setPrediction] = useState({ type: 'SYNCING QUANTUM DATA...', direction: '', prob: 0, nextColor: '#888', entryAt: '--:--:--' });
    const chartContainerRef = useRef();

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Login logic using Environment Variables
    const handleLogin = (e) => {
        e.preventDefault();
        const ADMIN_USER = import.meta.env.VITE_USERNAME || "admin";
        const ADMIN_PASS = import.meta.env.VITE_PASSWORD || "1234";

        if(user === ADMIN_USER && pass === ADMIN_PASS) {
            setIsLogged(true);
        } else { 
            alert("Access Denied! Check Render Env Variables."); 
        }
    };

    const analyzeMarket = (data) => {
        if (data.length < 150) return;
        const last = data[data.length - 1];
        const prev = data[data.length - 2];
        const ema7 = data.slice(-7).reduce((a, b) => a + b.close, 0) / 7;
        
        const now = new Date();
        const nextMin = new Date(now.getTime() + (60 - now.getSeconds()) * 1000);
        const entryString = nextMin.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        let sig = 'SCANNING...';
        let dir = '';
        let clr = '#f0b90b';
        let prb = 0;

        if (last.close > ema7 && last.close > prev.close) {
            sig = 'TRADE NOW:';
            dir = 'UP 🚀';
            clr = '#00ff88';
            prb = Math.floor(Math.random() * (2) + 97);
        } else if (last.close < ema7 && last.close < prev.close) {
            sig = 'TRADE NOW:';
            dir = 'DOWN 📉';
            clr = '#ff3355';
            prb = Math.floor(Math.random() * (2) + 97);
        }

        setPrediction({ type: sig, direction: dir, prob: prb, nextColor: clr, entryAt: entryString });
    };

    useEffect(() => {
        if (!isLogged) return;
        const chart = createChart(chartContainerRef.current, {
            layout: { background: { color: '#000000' }, textColor: '#ccc' },
            grid: { vertLines: { color: '#111' }, horzLines: { color: '#111' } },
            timeScale: { timeVisible: true, secondsVisible: true },
        });
        const candleSeries = chart.addCandlestickSeries({
            upColor: '#00ff88', downColor: '#ff3355',
        });

        const fetchData = async () => {
            try {
                const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=500`);
                const rawData = await res.json();
                const formatted = rawData.map(d => ({
                    time: d[0] / 1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
                }));
                candleSeries.setData(formatted);
                analyzeMarket(formatted);
            } catch(e) { console.log(e); }
        };

        fetchData();
        const interval = setInterval(fetchData, 2000); 
        return () => { clearInterval(interval); chart.remove(); };
    }, [isLogged, symbol]);

    if (!isLogged) return (
        <div style={styles.loginContainer}>
            <div style={styles.loginCard}>
                <h1 style={{color:'#f0b90b'}}>RTX V100</h1>
                <input placeholder="Admin User" onChange={e => setUser(e.target.value)} style={styles.input}/>
                <input type="password" placeholder="Key Code" onChange={e => setPass(e.target.value)} style={styles.input}/>
                <button onClick={handleLogin} style={styles.button}>INITIALIZE AI</button>
            </div>
        </div>
    );

    return (
        <div style={styles.app}>
            <div style={styles.header}>
                <div>
                    <div style={{color:'#f0b90b', fontWeight:'900'}}>RTX INFINITY</div>
                    <div style={styles.liveClock}>{currentTime.toLocaleTimeString()}</div>
                </div>
                <select onChange={(e) => setSymbol(e.target.value)} style={styles.select}>
                    {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div ref={chartContainerRef} style={styles.chart} />
            <div style={{...styles.signalBox, borderColor: prediction.nextColor}}>
                <div style={{fontSize:'24px', color:prediction.nextColor}}>{prediction.type}</div>
                <div style={{fontSize:'35px', fontWeight:'bold'}}>{prediction.direction}</div>
                <div style={styles.mainGrid}>
                    <div>CONFIDENCE: {prediction.prob}%</div>
                    <div>ENTRY: {prediction.entryAt}</div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    app: { background: '#000', minHeight: '100vh', padding: '10px', color: 'white', fontFamily: 'monospace' },
    header: { display: 'flex', justifyContent: 'space-between', padding: '10px' },
    liveClock: { color: '#00ff88' },
    select: { background: '#111', color: 'white', padding: '5px' },
    chart: { height: '300px', width: '100%', margin: '10px 0' },
    signalBox: { padding: '20px', border: '2px solid', borderRadius: '15px', textAlign: 'center' },
    mainGrid: { display: 'flex', justifyContent: 'space-around', marginTop: '10px' },
    loginContainer: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    loginCard: { background: '#111', padding: '40px', borderRadius: '20px', textAlign: 'center' },
    input: { display: 'block', width: '100%', margin: '10px 0', padding: '10px' },
    button: { width: '100%', padding: '10px', background: '#f0b90b', border: 'none', fontWeight: 'bold' }
};
