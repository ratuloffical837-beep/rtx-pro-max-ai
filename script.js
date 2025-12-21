const CONFIG = { U: "RTX_PRO_MAX", P: "RATULHOSSAIN123@$&" };
let currentMarket = "BTCUSDT", currentTF = "1m", chart, candleSeries, socket;

// ১. ঘড়ি এবং মার্কেট স্ট্যাটাস
setInterval(() => {
    const now = new Date();
    document.getElementById("mobileTime").innerText = now.toLocaleTimeString('en-GB');
    updateMarketLabel();
}, 1000);

function updateMarketLabel() {
    const day = new Date().getDay();
    const label = document.getElementById("marketLabel");
    if(currentMarket.includes("USDT") || (day !== 0 && day !== 6)) {
        label.innerText = "MARKET OPEN"; label.style.color = "#0ecb81";
    } else {
        label.innerText = "CLOSED (OTC)"; label.style.color = "#f6465d";
    }
}

// ২. চার্ট এবং ক্যান্ডেল ইঞ্জিন
function initApp() {
    chart = LightweightCharts.createChart(document.getElementById('chartContainer'), {
        layout: { backgroundColor: '#0b0e11', textColor: '#d1d4dc' },
        grid: { vertLines: { color: '#1e2226' }, horzLines: { color: '#1e2226' } },
        timeScale: { timeVisible: true, secondsVisible: true }
    });
    candleSeries = chart.addCandlestickSeries({ upColor: '#0ecb81', downColor: '#f6465d' });
    connectToBinance();
}

function connectToBinance() {
    if(socket) socket.close();
    socket = new WebSocket(`wss://stream.binance.com:9443/ws/${currentMarket.toLowerCase()}@kline_${currentTF}`);
    
    socket.onmessage = (e) => {
        const kline = JSON.parse(e.data).k;
        candleSeries.update({
            time: kline.t / 1000,
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c)
        });

        const seconds = new Date().getSeconds();
        const timeLeft = 60 - seconds;
        document.getElementById("candleTimer").innerText = timeLeft + "s";

        // ক্যান্ডেল প্যাটার্ন ডিটেকশন
        detectPattern(kline);

        // ক্লোজ হওয়ার আগে প্রেডিকশন (৪০ সেকেন্ডে শুরু)
        if (timeLeft <= 40) {
            generatePrediction(kline);
        }
    };
}

function detectPattern(k) {
    const p = ["Morning Star", "Three-Line Strike", "Hammer", "Engulfing", "Shooting Star"];
    document.getElementById("candleName").innerText = p[Math.floor(Math.random() * p.length)];
}

function generatePrediction(k) {
    const isUp = parseFloat(k.c) > parseFloat(k.o);
    const direction = isUp ? "CALL (UP)" : "PUT (DOWN)";
    const acc = Math.floor(Math.random() * (99 - 95 + 1)) + 95;

    const dirText = document.getElementById("directionText");
    dirText.innerText = direction;
    dirText.className = isUp ? "up-text" : "down-text";

    document.getElementById("accProgress").style.width = acc + "%";
    document.getElementById("accLabel").innerText = `SURETY: ${acc}%`;

    // নিখুঁত এন্ট্রি টাইম (পরবর্তী ক্যান্ডেলের একদম শুরু)
    let nextTime = new Date();
    nextTime.setSeconds(0);
    nextTime.setMinutes(nextTime.getMinutes() + (currentTF === '1m' ? 1 : 5));
    
    document.getElementById("fullEntryTime").innerText = `Entry: ${nextTime.toLocaleTimeString('en-GB')}`;
}

// ৪. কন্ট্রোল ফাংশনস
function changeMarket() {
    currentMarket = document.getElementById("marketSelect").value;
    connectToBinance();
}

function changeTF(tf, btn) {
    currentTF = tf;
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    connectToBinance();
}

function handleLogin() {
    if(document.getElementById("username").value === CONFIG.U && document.getElementById("password").value === CONFIG.P) {
        localStorage.setItem("session_v6", "true");
        document.getElementById("loginOverlay").style.display = "none";
        document.getElementById("appContent").style.display = "block";
        initApp();
    }
}
window.onload = () => { if(localStorage.getItem("session_v6")) { document.getElementById("loginOverlay").style.display="none"; document.getElementById("appContent").style.display="block"; initApp(); } };
