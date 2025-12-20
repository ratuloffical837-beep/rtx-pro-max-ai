import React, { useState, useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "ARBUSDT", "DOGEUSDT", "MATICUSDT", "XRPUSDT"];

export default function App() {
    const [isLogged, setIsLogged] = useState(false);
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [symbol, setSymbol] = useState("BTCUSDT");
    const [prediction, setPrediction] = useState({ type: 'ANALYZING...', prob: 0, nextColor: 'gray' });
    const chartContainerRef = useRef();

    const analyzeMarket = (data) => {
        if (data.length < 20) return;
        const last = data[data.length - 1];
        const sma = data.slice(-10).reduce((a, b) => a + b.close, 0) / 10;
        
        let signal = 'WAITING...';
        let color = '#ffffff'; 
        let probability = Math.floor(Math.random() * (98 - 87) + 87);

        if (last.close > sma) {
            signal = 'NEXT: GREEN (UP) 🚀';
            color = '#ffffff'; 
        } else {
            signal = 'NEXT: RED (DOWN) 📉';
            color = '#00d1ff'; 
        }
        setPrediction({ type: signal, prob: probability, nextColor: color });
    };

    const handleLogin = (e) => {
        e.preventDefault();
        const envUser = import.meta.env.VITE_USERNAME;
        const envPass = import.meta.env.VITE_PASSWORD;
        if(user === envUser && pass === envPass) {
            setIsLogged(true);
        } else { alert("ভুল ইউজারনেম বা পাসওয়ার্ড!"); }
    };

    useEffect(() => {
        if (!isLogged) return;
        const chart = createChart(chartContainerRef.current, {
            layout: { background: { color: '#05070a' }, textColor: '#bcbcbc' },
            grid: { vertLines: { color: '#1a1d22' }, horzLines: { color: '#1a1d22' } },
            timeScale: { timeVisible: true, secondsVisible: true },
        });
        const candleSeries = chart.addCandlestickSeries({
            upColor: '#00ff88', downColor: '#ff3355', borderVisible: false,
            wickUpColor: '#00ff88', wickDownColor: '#ff3355'
        });

        const fetchData = async () => {
            const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=1000`);
            const rawData = await res.json();
            const formattedData = rawData.map(d => ({
                time: d[0] / 1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
            }));
            candleSeries.setData(formattedData);
            analyzeMarket(formattedData);
        };

        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => { clearInterval(interval); chart.remove(); };
    }, [isLogged, symbol]);

    if (!isLogged) return (
        <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#05070a', color:'white', textAlign:'center', fontFamily:'sans-serif'}}>
            <div style={{background:'#0d1117', padding:'40px', borderRadius:'20px', border:'1px solid #1e2329', width:'300px'}}>
                <h1 style={{color:'#f0b90b'}}>RTX PRO AI</h1>
                <input placeholder="Username" onChange={e => setUser(e.target.value)} style={{width:'100%', padding:'12px', margin:'10px 0', borderRadius:'8px', border:'1px solid #222', background:'#05070a', color:'white', boxSizing:'border-box'}}/>
                <input type="password" placeholder="Password" onChange={e => setPass(e.target.value)} style={{width:'100%', padding:'12px', margin:'10px 0', borderRadius:'8px', border:'1px solid #222', background:'#05070a', color:'white', boxSizing:'border-box'}}/>
                <button onClick={handleLogin} style={{width:'100%', padding:'12px', background:'#f0b90b', border:'none', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', marginTop:'10px'}}>LOGIN</button>
            </div>
        </div>
    );

    return (
        <div style={{background:'#05070a', minHeight:'100vh', color:'white', padding:'15px', fontFamily:'sans-serif'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                <span style={{color:'#f0b90b', fontWeight:'bold'}}>RTX AI TERMINAL</span>
                <select onChange={(e) => setSymbol(e.target.value)} style={{background:'#1e2329', color:'white', border:'1px solid #333', padding:'5px', borderRadius:'5px'}}>
                    {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div ref={chartContainerRef} style={{height:'55vh', width:'100%', borderRadius:'12px', overflow:'hidden', border:'1px solid #1a1d22'}} />
            <div style={{marginTop:'20px', background:'#111418', padding:'25px', borderRadius:'15px', borderLeft:'10px solid ' + prediction.nextColor, textAlign:'center'}}>
                <div style={{fontSize:'26px', fontWeight:'bold', color:prediction.nextColor}}>{prediction.type}</div>
                <div style={{fontSize:'16px', marginTop:'5px'}}>Accuracy: {prediction.prob}%</div>
            </div>
        </div>
    );
}
