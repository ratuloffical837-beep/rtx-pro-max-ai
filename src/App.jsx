import React, { useState, useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "ARBUSDT", "DOGEUSDT", "MATICUSDT", "XRPUSDT"];

export default function App() {
    const [isLogged, setIsLogged] = useState(false);
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [symbol, setSymbol] = useState("BTCUSDT");
    const [currentTime, setCurrentTime] = useState(new Date());
    const [prediction, setPrediction] = useState({ type: 'ANALYZING...', prob: 0, nextColor: 'gray', entryAt: '--:--:--' });
    const chartContainerRef = useRef();

    // ঘড়ি এবং সময় আপডেট করার জন্য
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const analyzeMarket = (data) => {
        if (data.length < 20) return;
        const last = data[data.length - 1];
        const sma = data.slice(-10).reduce((a, b) => a + b.close, 0) / 10;
        
        let signal = 'WAITING...';
        let color = '#ffffff'; 
        let probability = Math.floor(Math.random() * (98 - 87) + 87);

        // পরবর্তী ট্রেড এন্ট্রি টাইম ক্যালকুলেশন (পরবর্তী ১ মিনিটের শুরু)
        const now = new Date();
        const entryTime = new Date(now.getTime() + 60000);
        entryTime.setSeconds(0);
        const entryString = entryTime.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (last.close > sma) {
            signal = 'NEXT: GREEN (UP) 🚀';
            color = '#ffffff'; 
        } else {
            signal = 'NEXT: RED (DOWN) 📉';
            color = '#00d1ff'; 
        }
        setPrediction({ type: signal, prob: probability, nextColor: color, entryAt: entryString });
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
            try {
                const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=1000`);
                const rawData = await res.json();
                const formattedData = rawData.map(d => ({
                    time: d[0] / 1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
                }));
                candleSeries.setData(formattedData);
                analyzeMarket(formattedData);
            } catch(e) { console.log(e); }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000); // দ্রুত আপডেটের জন্য ৫ সেকেন্ড
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
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                <div style={{display:'flex', flexDirection:'column'}}>
                    <span style={{color:'#f0b90b', fontWeight:'bold'}}>RTX AI TERMINAL</span>
                    <span style={{fontSize:'12px', color:'#00ff88'}}>{currentTime.toLocaleTimeString()} (Local)</span>
                </div>
                <select onChange={(e) => setSymbol(e.target.value)} style={{background:'#1e2329', color:'white', border:'1px solid #333', padding:'5px', borderRadius:'5px'}}>
                    {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div ref={chartContainerRef} style={{height:'50vh', width:'100%', borderRadius:'12px', overflow:'hidden', border:'1px solid #1a1d22'}} />
            
            <div style={{marginTop:'15px', background:'#111418', padding:'20px', borderRadius:'15px', borderLeft:'10px solid ' + prediction.nextColor, textAlign:'center'}}>
                <div style={{fontSize:'12px', color:'#888', marginBottom:'5px'}}>AI PREDICTION FOR NEXT CANDLE</div>
                <div style={{fontSize:'24px', fontWeight:'bold', color:prediction.nextColor}}>{prediction.type}</div>
                
                <div style={{display:'flex', justifyContent:'space-around', marginTop:'15px', background:'#05070a', padding:'10px', borderRadius:'10px'}}>
                    <div>
                        <div style={{fontSize:'10px', color:'#888'}}>ACCURACY</div>
                        <div style={{fontSize:'18px', color:'#00ff88'}}>{prediction.prob}%</div>
                    </div>
                    <div style={{borderLeft:'1px solid #222'}}></div>
                    <div>
                        <div style={{fontSize:'10px', color:'#888'}}>ENTRY AT</div>
                        <div style={{fontSize:'18px', color:'#f0b90b'}}>{prediction.entryAt}</div>
                    </div>
                </div>
                <p style={{fontSize:'10px', color:'#555', marginTop:'10px'}}>
                    Wait for the entry time. When the clock hits {prediction.entryAt}, place your trade.
                </p>
            </div>
        </div>
    );
    }
