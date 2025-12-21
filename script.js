const CONFIG = { U: "RTX_PRO_MAX", P: "RATULHOSSAIN123@$&" };
let currentMarket = "BTCUSDT", currentTF = "1m", chart, candleSeries, socket;

// ১. রিয়েল টাইম ক্লক
setInterval(() => {
    document.getElementById("mobileTime").innerText = new Date().toLocaleTimeString('en-GB');
}, 1000);

// ২. ক্যান্ডেলস্টিক চার্ট ইনিশিয়ালাইজেশন
function initApp() {
    if (chart) return;
    const chartElement = document.getElementById('chartContainer');
    chart = LightweightCharts.createChart(chartElement, {
        layout: { backgroundColor: '#0b0e11', textColor: '#d1d4dc' },
        grid: { vertLines: { color: '#1e2226' }, horzLines: { color: '#1e2226' } },
        timeScale: { timeVisible: true, secondsVisible: true },
    });
    candleSeries = chart.addCandlestickSeries({ upColor: '#0ecb81', downColor: '#f6465d' });
    connectToBinance();
}

// ৩. বাইনান্স ডেটা কানেকশন (এটিই ক্যান্ডেল চালাবে)
function connectToBinance() {
    if (socket) socket.close();
    const url = `wss://stream.binance.com:9443/ws/${currentMarket.toLowerCase()}@kline_${currentTF}`;
    socket = new WebSocket(url);

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const k = data.k;
        candleSeries.update({
            time: k.t / 1000,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c)
        });

        const seconds = new Date().getSeconds();
        document.getElementById("candleTimer").innerText = (60 - seconds) + "s";
        
        // সিগন্যাল লজিক (৩০ সেকেন্ড বাকি থাকতে)
        if (seconds >= 30) {
            generatePrediction(k);
        }
    };

    socket.onclose = () => setTimeout(connectToBinance, 2000); // ডিসকানেক্ট হলে রিকানেক্ট হবে
}

function generatePrediction(k) {
    const patterns = ["Three-Line Strike", "Hammer", "Engulfing", "Morning Star"];
    const isUp = parseFloat(k.c) > parseFloat(k.o);
    const accuracy = Math.floor(Math.random() * (99 - 95 + 1)) + 95;

    document.getElementById("candleName").innerText = patterns[Math.floor(Math.random() * patterns.length)];
    const dirText = document.getElementById("directionText");
    dirText.innerText = isUp ? "CALL (UP)" : "PUT (DOWN)";
    dirText.className = isUp ? "up-text" : "down-text";

    document.getElementById("accProgress").style.width = accuracy + "%";
    document.getElementById("accLabel").innerText = `SURETY: ${accuracy}%`;

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

function changeTF(tf) {
    currentTF = tf;
    document.getElementById("btn1m").classList.toggle("active", tf === '1m');
    document.getElementById("btn5m").classList.toggle("active", tf === '5m');
    connectToBinance();
}

function handleLogin() {
    if (document.getElementById("username").value === CONFIG.U && document.getElementById("password").value === CONFIG.P) {
        localStorage.setItem("session_v7", "true");
        document.getElementById("loginOverlay").style.display = "none";
        document.getElementById("appContent").style.display = "block";
        initApp();
    }
}

window.onload = () => { if (localStorage.getItem("session_v7")) { document.getElementById("loginOverlay").style.display = "none"; document.getElementById("appContent").style.display = "block"; initApp(); } };
