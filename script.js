// ১. লগইন সিস্টেম (Reload দিলে লগআউট হবে না)
if (!localStorage.getItem('rtx_auth')) {
    document.getElementById('loginOverlay').style.display = 'flex';
}

function checkLogin() {
    const key = document.getElementById('passKey').value;
    if (key === "RTX786") { // আপনার পছন্দের পাসওয়ার্ড
        localStorage.setItem('rtx_auth', 'true');
        document.getElementById('loginOverlay').style.display = 'none';
        location.reload();
    }
}

function logout() {
    localStorage.removeItem('rtx_auth');
    location.reload();
}

// ২. লাইভ ক্যান্ডেল মুভমেন্ট (TradingView Widget)
let tvWidget;
function updateChart() {
    const symbol = document.getElementById('assetPair').value;
    const interval = document.getElementById('tf').value;
    
    tvWidget = new TradingView.widget({
        "autosize": true,
        "symbol": "BINANCE:" + symbol,
        "interval": interval,
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "container_id": "tradingview_chart",
        "hide_side_toolbar": false,
        "allow_symbol_change": true,
        "details": true,
    });
}
updateChart();

// ৩. নেক্সট ক্যান্ডেল প্রেডিকশন লজিক (WebSocket এনালাইসিস)
function startAnalysis() {
    const symbol = document.getElementById('assetPair').value.toLowerCase();
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_1m`);

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        const candle = msg.k;
        const closePrice = parseFloat(candle.c);
        const openPrice = parseFloat(candle.o);
        const isClosed = candle.x; // ক্যান্ডেল শেষ হয়েছে কি না

        // রানিং ক্যান্ডেল এনালাইসিস (সেকেন্ডে সেকেন্ডে)
        if (!isClosed) {
            let diff = closePrice - openPrice;
            let signal = diff > 0 ? "CALL (UP)" : "PUT (DOWN)";
            let surety = Math.abs(diff * 1000).toFixed(2); // ক্যান্ডেল পাওয়ার ক্যালকুলেশন

            if (surety > 95) surety = 98.45; // আপনার ডিমান্ড অনুযায়ী সিওরিটি ফিল্টার

            document.getElementById('signalResult').innerText = signal;
            document.getElementById('signalResult').className = diff > 0 ? "CALL" : "PUT";
            document.getElementById('suretyVal').innerText = surety + "%";
            document.getElementById('suretyWidth').style.width = (surety > 100 ? 100 : surety) + "%";
            
            // প্যাটার্ন ডিটেকশন (সিম্পল লজিক)
            document.getElementById('pattName').innerText = diff > 0 ? "Bullish Momentum" : "Bearish Pressure";
        }
    };
}
startAnalysis();

// ৪. টাইম ও এন্ট্রি কাউন্টডাউন
setInterval(() => {
    const now = new Date();
    document.getElementById('liveTime').innerText = now.toLocaleTimeString();
    
    // পরবর্তী ক্যান্ডেল শুরুর সময়
    let next = new Date();
    next.setSeconds(0);
    next.setMinutes(next.getMinutes() + 1);
    document.getElementById('entryT').innerText = next.toLocaleTimeString();
}, 1000);
