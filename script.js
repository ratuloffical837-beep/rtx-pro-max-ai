// --- নিরাপত্তা কনফিগ (Render Env-এর বদলে এখানে সেট করা হয়েছে) ---
const CONFIG = {
    U: "RTX_PRO_MAX", // আপনার ইউজারনেম এখানে দিন
    P: "RATULHOSSAIN123@$&"  // আপনার পাসওয়ার্ড এখানে দিন
};

// --- লগইন চেক (রিফ্রেশ করলে লগআউট হবে না) ---
window.onload = function() {
    if (localStorage.getItem("isLoggedIn") === "true") {
        showApp();
    }
};

function handleLogin() {
    const uInput = document.getElementById("username").value;
    const pInput = document.getElementById("password").value;

    if (uInput === CONFIG.U && pInput === CONFIG.P) {
        localStorage.setItem("isLoggedIn", "true");
        showApp();
    } else {
        document.getElementById("loginError").style.display = "block";
    }
}

function handleLogout() {
    localStorage.removeItem("isLoggedIn");
    location.reload();
}

function showApp() {
    document.getElementById("loginOverlay").style.display = "none";
    document.getElementById("appContent").style.display = "block";
    updateMarketScan();
}

// --- আপনার সিগন্যাল লজিক (আগের মতোই) ---
const strategies = [
    { name: "Morning Star", type: "BUY", target: "Fib 161.8%" },
    { name: "Evening Star", type: "SELL", target: "Fib 161.8%" },
    { name: "Three-Line Strike", type: "SELL", target: "Next Low" },
    { name: "Rising Three Methods", type: "BUY", target: "Prev High" }
];

function updateMarketScan() {
    if (localStorage.getItem("isLoggedIn") !== "true") return;
    
    document.getElementById("actionText").innerText = "Analyzing Market...";
    setTimeout(() => {
        const strat = strategies[Math.floor(Math.random() * strategies.length)];
        displaySignal(strat);
    }, 1500);
}

function displaySignal(strat) {
    const card = document.getElementById("signalCard");
    card.className = strat.type === "BUY" ? "buy-mode" : "sell-mode";
    document.getElementById("actionText").innerHTML = `<strong>${strat.type}</strong><br>${strat.name}`;
    document.getElementById("keyLevel").innerText = "Fib 61.8%";
    document.getElementById("volStatus").innerText = "Smart Money OK";
    document.getElementById("patternFound").innerText = strat.name;
    addLog(`Signal: ${strat.type} - ${strat.name}`);
}

function addLog(msg) {
    const logs = document.getElementById("tradeLogs");
    const div = document.createElement("div");
    div.innerText = `> [${new Date().toLocaleTimeString()}] ${msg}`;
    logs.prepend(div);
}

setInterval(() => {
    if (localStorage.getItem("isLoggedIn") === "true") updateMarketScan();
}, 10000);
