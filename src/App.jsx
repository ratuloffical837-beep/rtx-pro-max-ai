import React, { useState, useEffect } from 'react';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  // অটো-লগইন চেক (রিফ্রেশ করলে লগআউট হবে না)
  useEffect(() => {
    const auth = localStorage.getItem('rtx_auth');
    if (auth === 'true') setIsLoggedIn(true);
    
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    // Render Env Variables (Vite এ VITE_ প্রেক্সিল লাগে)
    const envUser = import.meta.env.VITE_USER;
    const envPass = import.meta.env.VITE_PASS;

    if (username === envUser && password === envPass) {
      localStorage.setItem('rtx_auth', 'true');
      setIsLoggedIn(true);
      setError('');
    } else {
      setError('ভুল ইউজারনেম বা পাসওয়ার্ড!');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('rtx_auth');
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginBox}>
          <h1 style={{ color: '#FFD700', marginBottom: '10px' }}>RTX MASTER AI</h1>
          <p style={{ color: '#888', fontSize: '14px' }}>প্রবেশ করতে লগইন করুন</p>
          <form onSubmit={handleLogin}>
            <input 
              type="text" placeholder="Username" 
              style={styles.input} onChange={(e) => setUsername(e.target.value)} 
            />
            <input 
              type="password" placeholder="Password" 
              style={styles.input} onChange={(e) => setPassword(e.target.value)} 
            />
            <button type="submit" style={styles.loginBtn}>LOGIN</button>
          </form>
          {error && <p style={{ color: '#ff3b3b', marginTop: '10px' }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.dashboard}>
      <div style={styles.header}>
        <span style={{ color: '#FFD700', fontWeight: 'bold' }}>RTX MASTER AI</span>
        <span>{time} | <span style={{ color: '#00FF88' }}>LIVE 🟢</span></span>
        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </div>

      <div style={styles.signalCard}>
        <div style={{ fontSize: '12px', color: '#888' }}>CANDLE: Analysis Running...</div>
        <h1 style={{ fontSize: '40px', margin: '20px 0' }}>WAITING... 📉</h1>
        <div style={styles.timerBox}>
          <div style={{ fontSize: '14px', color: '#888' }}>SHARP ENTRY</div>
          <div style={{ fontSize: '32px', color: '#FFD700' }}>{time}</div>
        </div>
      </div>
      <div style={styles.aiNote}>AI NOTE: Waiting for high probability setup...</div>
    </div>
  );
}

const styles = {
  loginContainer: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000' },
  loginBox: { background: '#111', padding: '40px', borderRadius: '20px', textAlign: 'center', border: '1px solid #333', width: '300px' },
  input: { width: '100%', padding: '12px', margin: '10px 0', borderRadius: '8px', border: '1px solid #444', background: '#222', color: '#fff', boxSizing: 'border-box' },
  loginBtn: { width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#FFD700', color: '#000', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  dashboard: { padding: '20px', background: '#000', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  header: { width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '40px', fontSize: '14px' },
  signalCard: { width: '90%', maxWidth: '400px', background: '#111', padding: '30px', borderRadius: '30px', border: '2px solid #222', textAlign: 'center' },
  timerBox: { background: '#000', padding: '20px', borderRadius: '20px', marginTop: '20px', border: '1px solid #333' },
  aiNote: { marginTop: '30px', color: '#888', fontSize: '13px', textAlign: 'center' },
  logoutBtn: { background: 'none', border: 'none', color: '#ff3b3b', cursor: 'pointer' }
};
