import "./App.css";

import { useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

const API = import.meta.env.VITE_API_URL;

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("landing");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser({ token, role: decoded.role });
        setView("dashboard");
      } catch {
        localStorage.removeItem("token");
      }
    }
  }, []);

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setView("landing");
  };

  const goToLogin = () => setView("login");
  const goToRegister = () => setView("register");
  const goToLanding = () => setView("landing");

  return (
  <>
    {/* 🟢 Background layer - now at root level 🟢 */}
    <div className="background-animation">
      <div className="bg-grid"></div>
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>
    </div>

    {/* 🔴 Main app content 🔴 */}
    <div className="app-wrapper">
      <nav className="navbar fade-in">
        <div className="logo">EventOrizon</div>
        <div className="nav-links">
          <button className="text-link-nav" onClick={goToLanding}>Home</button>
          <button className="text-link-nav">Features</button>
          <button className="text-link-nav">About</button>
          {!user ? (
            <>
              <button className="nav-btn secondary" onClick={goToLogin}>Login</button>
              <button className="nav-btn primary" onClick={goToRegister}>Sign Up</button>
            </>
          ) : (
            <button className="nav-btn danger" onClick={logout}>Logout</button>
          )}
        </div>
      </nav>

      <main className="main-content">
        {view === "landing" && <Landing goToLogin={goToLogin} goToRegister={goToRegister} />}
        {view === "login" && <Login setUser={setUser} setView={setView} />}
        {view === "register" && <Register setView={setView} />}
        {view === "dashboard" && user && (
          <div className="dashboard-view-wrapper fade-in">
            <div className="top-status">
              <span className="status-dot"></span>
              System Active • <span className="role-tag">{user.role.toUpperCase()}</span>
            </div>
            <EventSystem role={user.role} token={user.token} />
          </div>
        )}
      </main>
    </div>
  </>
);
}

/* ── HELPERS ── */
function formatDateTime(dt) {
  const d = new Date(dt);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
         " • " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/* ── COMPONENTS ── */
function Landing({ goToLogin, goToRegister }) {
  return (
    <section className="hero slide-up">
      <div className="hero-content">
        <h1 className="glitch-text">EventOrizon</h1>
        <p className="tagline">Setting the benchmark for end-to-end academic event management</p>
        <div className="hero-cta">
          <button className="primary large" onClick={goToRegister}>Get Started Free</button>
          <button className="secondary large" onClick={goToLogin}>Operator Login</button>
        </div>
      </div>
    </section>
  );
}

function Login({ setUser, setView }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await axios.post(`${API}/api/auth/login`, form);
      localStorage.setItem("token", res.data.token);
      setUser({ token: res.data.token, role: res.data.user.role });
      setView("dashboard");
    } catch { setError("Invalid credentials"); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-container slide-in">
      <div className="auth-card">
        <h2>Sign In</h2>
        {error && <p className="error-msg">{error}</p>}
        <form onSubmit={submit} className="dynamic-form">
          <input className="full" placeholder="Email Address" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <input className="full" type="password" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          <button className="primary-glow-btn full" disabled={loading}>{loading ? "Verifying..." : "Access Dashboard"}</button>
        </form>
        <p className="switch-auth">New here? <button className="text-link" onClick={() => setView("register")}>Register</button></p>
      </div>
    </div>
  );
}

function Register({ setView }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await axios.post(`${API}/api/auth/register`, form);
      alert("Registration Successful");
      setView("login");
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Registration failed");
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-container slide-in">
      <div className="auth-card">
        <h2>Create Account</h2>
        {error && <p className="error-msg">{error}</p>}
        <form onSubmit={submit} className="dynamic-form">
          <input className="full" placeholder="Full Name" onChange={e => setForm({...form, name: e.target.value})} />
          <input className="full" placeholder="Email" onChange={e => setForm({...form, email: e.target.value})} />
          <input className="full" type="password" placeholder="Password" onChange={e => setForm({...form, password: e.target.value})} />
          <select className="full" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
            <option value="student">Student</option>
            <option value="organizer">Organizer</option>
          </select>
          <button className="primary-glow-btn full" disabled={loading}>Create Account</button>
        </form>
      </div>
    </div>
  );
}

function EventSystem({ role, token }) {
  if (role === "organizer") return <OrganizerDashboard token={token} />;
  if (role === "student")   return <StudentDashboard token={token} />;
  if (role === "admin")     return <AdminDashboard token={token} />;
  return <div>Role Error</div>;
}

/* ── ORGANIZER DASHBOARD ── */
function OrganizerDashboard({ token }) {
  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [form, setForm] = useState({
    name: "",
    eventDate: "",
    startTime: "",
    endTime: "",
    venue: "",
    description: "",
    maxSeats: 0,
    isPaid: false,
    registrationFee: 0
  });

  const headers = { Authorization: `Bearer ${token}` };

  const loadEvents = () => {
    setLoading(true);
    axios.get(`${API}/api/organizer/events`, { headers })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : [];
        setEvents(data);
      })
      .catch(err => {
        console.error("Load events error:", err);
        setEvents([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEvents(); }, [token]);

  const createEvent = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("eventDate", form.eventDate);
    formData.append("startTime", form.startTime);
    formData.append("endTime", form.endTime);
    formData.append("venue", form.venue);
    formData.append("description", form.description);
    formData.append("maxSeats", form.maxSeats);
    formData.append("registrationFee", form.isPaid ? form.registrationFee : 0);
    if (selectedFile) {
      formData.append("thumbnail", selectedFile);
    }

    try {
      await axios.post(`${API}/api/events`, formData, { 
        headers: { ...headers, "Content-Type": "multipart/form-data" } 
      });
      setForm({
        name: "", eventDate: "", startTime: "", endTime: "", venue: "", description: "", maxSeats: 0,
        isPaid: false,
        registrationFee: 0
      });
      setSelectedFile(null);
      loadEvents();
    } catch (err) {
      alert("Deployment failed. Check console.");
    }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm("Permanent Delete?")) return;
    await axios.delete(`${API}/api/events/${id}`, { headers });
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const viewRegs = (id) => {
    setLoading(true);
    axios.get(`${API}/api/organizer/events/${id}/registrations`, { headers })
      .then(res => setRegs(res.data))
      .finally(() => setLoading(false));
  };

  // Shared Industrial Input Style
  const inputStyle = {
    textTransform: 'uppercase',
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: '1px',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid var(--border)',
    padding: '1rem',
    borderRadius: '12px',
    color: 'white',
    width: '100%',
    marginBottom: '1rem'
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h2 style={{fontWeight: '800', letterSpacing: '1px'}}>CONTROL CENTER</h2>
        <p style={{color: 'var(--text-dim)'}}>Deploy and manage event infrastructure</p>
      </header>

      <div className="dashboard-grid">
        {/* ENHANCED DEPLOY FORM */}
{/* ENHANCED DEPLOY FORM: REORDERED LAYOUT */}
        <div className="glass-card">
          <h3 style={{fontWeight: '800', marginBottom: '20px'}}>DEPLOY NEW EVENT</h3>
          <form onSubmit={createEvent}>
            <input 
              placeholder="EVENT NAME" 
              value={form.name} 
              style={inputStyle}
              onChange={e => setForm({...form, name: e.target.value})} 
              required 
            />
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
              <input 
                type="date" 
                value={form.eventDate} 
                style={inputStyle}
                onChange={e => setForm({...form, eventDate: e.target.value})} 
                required 
              />
              <input 
                type="number" 
                placeholder="CAPACITY" 
                value={form.maxSeats} 
                style={inputStyle}
                onChange={e => setForm({...form, maxSeats: e.target.value})} 
              />
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
              <input type="time" value={form.startTime} style={inputStyle} onChange={e => setForm({...form, startTime: e.target.value})} />
              <input type="time" value={form.endTime} style={inputStyle} onChange={e => setForm({...form, endTime: e.target.value})} />
            </div>
            
            <input 
              placeholder="VENUE LOCATION" 
              value={form.venue} 
              style={inputStyle}
              onChange={e => setForm({...form, venue: e.target.value})} 
            />

            <textarea 
              placeholder="INTERNAL DESCRIPTION" 
              value={form.description} 
              style={{...inputStyle, minHeight: '80px', textTransform: 'none'}}
              onChange={e => setForm({...form, description: e.target.value})} 
            />

            {/* THUMBNAIL MOVED BELOW DESCRIPTION */}
            <div style={{marginBottom: "20px", padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "12px", border: "1px dashed var(--border)"}}>
              <label style={{fontSize: "0.7rem", fontWeight: '800', color: "var(--text-dim)", display: 'block', marginBottom: '8px', fontFamily: 'monospace'}}>
                THUMBNAIL ATTACHMENT (OPTIONAL)
              </label>
              <input 
                type="file" 
                accept="image/*" 
                style={{fontSize: '0.8rem', color: 'var(--text-dim)'}}
                onChange={e => setSelectedFile(e.target.files[0])} 
              />
            </div>

            {/* CHECKBOX MOVED TO THE BOTTOM */}
            <div style={{ margin: "10px 0 20px 0", padding: "10px", display: "flex", alignItems: "center", gap: "12px", background: "rgba(99, 102, 241, 0.05)", borderRadius: "12px" }}>
              <input
                type="checkbox"
                id="isPaid"
                checked={form.isPaid}
                onChange={e => setForm({ ...form, isPaid: e.target.checked })}
                style={{ width: "20px", height: "20px", accentColor: "var(--primary)", cursor: "pointer" }}
              />
              <label htmlFor="isPaid" style={{ fontSize: "0.9rem", fontWeight: '800', color: "#fff", cursor: "pointer", fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                ENABLE PAID REGISTRATION
              </label>
            </div>

            {form.isPaid && (
              <input
                type="number"
                placeholder="ENTRY FEE (₹)"
                value={form.registrationFee}
                style={{...inputStyle, border: '1px solid var(--primary)'}}
                onChange={e => setForm({...form, registrationFee: parseFloat(e.target.value) || 0})}
                required={form.isPaid}
              />
            )}
            
            <button className="primary-glow-btn full" style={{padding: '1.2rem', fontWeight: '800', fontSize: '1rem', letterSpacing: '1px'}}>
              PUBLISH TO SYSTEM
            </button>
          </form>
        </div>
        {/* ENHANCED REGISTRY LIST */}
        <div className="glass-card">
          <h3 style={{fontWeight: '800', marginBottom: '20px'}}>ACTIVE REGISTRY</h3>
          <div className="scroll-area">
            {events.map(e => (
              <div className="event-row-card" key={e.id} style={{background: 'rgba(255,255,255,0.03)', padding: '1.2rem'}}>
                <div>
                  <h4 style={{textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px', color: '#fff'}}>{e.name}</h4>
                  <small style={{fontFamily: 'monospace', color: 'var(--text-dim)'}}>
                    {e.venue} • {new Date(e.event_date).toLocaleDateString()}
                    {e.registration_fee > 0 && ` • ₹${e.registration_fee}`}
                  </small>
                </div>
                <div className="btn-group">
                  <button className="btn-mini-sec" style={{fontWeight: '700'}} onClick={() => viewRegs(e.id)}>TRACK</button>
                  <button className="btn-mini-danger" onClick={() => deleteEvent(e.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ATTENDANCE MANIFEST */}
      <div className="glass-card full-width-card" style={{marginTop: '2rem'}}>
        <div className="table-header">
          <h3 style={{fontWeight: '800'}}>ATTENDANCE MANIFEST</h3>
          <span className="badge" style={{fontFamily: 'monospace'}}>{regs.length} ENTRIES</span>
        </div>
        <div className="table-wrapper">
          <table style={{width: '100%'}}>
            <thead>
              <tr style={{textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px'}}>
                <th style={{padding: '15px'}}>Student</th>
                <th>ID</th>
                <th>Dept</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {regs.map((r, i) => (
                <tr key={i} className="table-row-anim">
                  <td style={{padding: '15px', fontWeight: '600'}}>{r.student_name}</td>
                  <td className="mono" style={{color: 'var(--primary)', fontWeight: '700'}}>{r.register_no}</td>
                  <td style={{textTransform: 'uppercase', fontSize: '0.85rem'}}>{r.department}</td>
                  <td>
                    <span className={`status-pill ${r.verified ? "verified" : "pending"}`} style={{fontWeight: '700', fontSize: '0.7rem'}}>
                      {r.verified ? "VERIFIED" : "PENDING"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── STUDENT DASHBOARD ── */
function StudentDashboard({ token }) {
  const [processingEvent, setProcessingEvent] = useState(null);

  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [form, setForm] = useState({ studentName: "", registerNo: "", department: "" });


  useEffect(() => {
    axios.get(`${API}/api/events`).then(res => {
      setEvents(Array.isArray(res.data) ? res.data : []);
    });

    axios.get(`${API}/api/student/registrations`, { 
      headers: { Authorization: `Bearer ${token}` } 
    }).then(res => {
      setRegistrations(Array.isArray(res.data) ? res.data : []);
    });
  }, [token]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

const register = async (eventId) => {

  // ✅ ADD (prevents double click)
  if (processingEvent === eventId) return;
  setProcessingEvent(eventId);

  if (!form.studentName || !form.registerNo || !form.department) {
    alert("Please fill your name, register number and department first");

    // ✅ ADD (reset on early exit)
    setProcessingEvent(null);
    return;
  }

  const selectedEvent = events.find(e => e.id === eventId);
  if (!selectedEvent) {

    // ✅ ADD (reset on early exit)
    setProcessingEvent(null);
    return;
  }

  // ⛔ BLOCK duplicate registration BEFORE payment popup
const alreadyRegistered = registrations.some(
  r => r.event_name === selectedEvent.name
);

if (alreadyRegistered) {
  alert("You are already registered for this event");
  setProcessingEvent(null);
  return;
}


  const fee = Number(selectedEvent.registration_fee) || 0;

if (fee <= 0) {
  try {
    const regCode = Math.random().toString(36).substring(2, 15);

    const verifyRes = await axios.post(
      `${API}/api/events/${eventId}/verify-payment-and-register`,
      {
        razorpay_payment_id: "FREE_EVENT_" + regCode,
        razorpay_order_id: "FREE_ORDER_" + regCode,
        razorpay_signature: "FREE",
        studentName: form.studentName,
        registerNo: form.registerNo,
        department: form.department,
        amount: 0
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // 🔹 Show QR exactly like paid event
    const wWidth = 450;
    const wHeight = 650;
    const xPos = (window.screen.width / 2) - (wWidth / 2);
    const yPos = (window.screen.height / 2) - (wHeight / 2);
    const w = window.open(
      "",
      "_blank",
      `width=${wWidth},height=${wHeight},left=${xPos},top=${yPos}`
    );

    w.document.write(`
      <html>
        <body style="background:#0f172a;color:white;text-align:center;font-family:sans-serif;padding:30px;">
          <h2 style="margin-bottom:20px;">ENTRY PASS - ${selectedEvent.name}</h2>
          <div style="background:white;padding:20px;border-radius:12px;display:inline-block;margin-bottom:25px;">
            <img src="${verifyRes.data.qrDataUrl}" width="240" />
          </div>
          <p style="font-size:1.3rem;color:#e2e8f0;margin-bottom:15px;">${form.studentName}</p>
          <p style="color:#34d399;font-weight:bold;">Registered ✓ (Free Event)</p>
          <button onclick="window.print()" style="padding:12px 40px;background:#6366f1;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;">
            Print Pass
          </button>
        </body>
      </html>
    `);
    w.document.close();

  } catch (err) {
    alert(err.response?.data?.message || "Registration failed");
  } finally {
    setProcessingEvent(null);
  }
  return;
}


  try {
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded || !window.Razorpay) {
      alert("Failed to load payment gateway.");

      // ✅ ADD
      setProcessingEvent(null);
      return;
    }

    const orderResponse = await axios.post(
      `${API}/api/events/${eventId}/create-payment-order`,
      { amount: fee },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const { orderId, amount, currency } = orderResponse.data;

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount,
      currency,
      name: "EventOrizon",
      description: `Registration for ${selectedEvent.name}`,
      order_id: orderId,
      handler: async function (response) {
        try {
          const verifyRes = await axios.post(
            `${API}/api/events/${eventId}/verify-payment-and-register`,
            {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              studentName: form.studentName,
              registerNo: form.registerNo,
              department: form.department,
              amount,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const wWidth = 450;
          const wHeight = 650;
          const xPos = (window.screen.width / 2) - (wWidth / 2);
          const yPos = (window.screen.height / 2) - (wHeight / 2);
          const w = window.open("", "_blank", `width=${wWidth},height=${wHeight},left=${xPos},top=${yPos}`);

          w.document.write(`
            <html>
              <body style="background:#0f172a;color:white;text-align:center;font-family:sans-serif;padding:30px;">
                <h2 style="margin-bottom:20px;">ENTRY PASS - ${selectedEvent.name}</h2>
                <div style="background:white;padding:20px;border-radius:12px;display:inline-block;margin-bottom:25px;">
                  <img src="${verifyRes.data.qrDataUrl}" width="240" />
                </div>
                <p style="font-size:1.3rem;color:#e2e8f0;margin-bottom:15px;">${form.studentName}</p>
                <p style="color:#34d399;font-weight:bold;">Payment Successful ✓</p>
                <button onclick="window.print()" style="padding:12px 40px;background:#6366f1;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;">Print Pass</button>
              </body>
            </html>
          `);
          w.document.close();
          alert("Registration successful!");
        } catch (err) {
          alert("Verification failed.");
        } finally {

          // ✅ ADD (reset after payment flow)
          setProcessingEvent(null);
        }
      },
      modal: {
    ondismiss: function () {
      setProcessingEvent(null);
    }
  },
      prefill: { name: form.studentName },
      theme: { color: "#6366f1" },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  } catch (err) {
  const msg =
    err.response?.data?.message ||
    "Payment initiation failed.";

  alert(msg);
  setProcessingEvent(null);
}

};


  return (
    <div className="dashboard-container">
      {/* PIC 1 FIX: INDUSTRIAL STUDENT PROFILE GRID */}
      <div className="glass-card full-width-card">
        <h3 style={{fontWeight: '800', letterSpacing: '0.5px', marginBottom: '5px'}}>Student Profile</h3>
        <p style={{color:"var(--text-dim)", fontSize:"0.9rem", marginBottom:"2rem"}}>
          Verify your identity for credential generation
        </p>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '1.2rem' 
        }}>
           <input 
             placeholder="FULL NAME" 
             style={{ 
               textTransform: 'uppercase', 
               fontWeight: '700', 
               fontFamily: 'monospace', 
               letterSpacing: '1px',
               background: 'rgba(0,0,0,0.3)',
               border: '1px solid var(--border)',
               padding: '1.1rem',
               borderRadius: '12px',
               color: 'white'
             }} 
             onChange={e => setForm({...form, studentName: e.target.value})} 
           />
           <input 
             placeholder="REGISTER NO" 
             style={{ 
               textTransform: 'uppercase', 
               fontFamily: 'monospace', 
               fontWeight: '700', 
               letterSpacing: '1px',
               background: 'rgba(0,0,0,0.3)',
               border: '1px solid var(--border)',
               padding: '1.1rem',
               borderRadius: '12px',
               color: 'white'
             }} 
             onChange={e => setForm({...form, registerNo: e.target.value})} 
           />
           <input 
             placeholder="DEPARTMENT" 
             style={{ 
               textTransform: 'uppercase', 
               fontFamily: 'monospace', 
               fontWeight: '700', 
               letterSpacing: '1px',
               background: 'rgba(0,0,0,0.3)',
               border: '1px solid var(--border)',
               padding: '1.1rem',
               borderRadius: '12px',
               color: 'white'
             }} 
             onChange={e => setForm({...form, department: e.target.value})} 
           />
        </div>
      </div>

      <h3 style={{marginTop: "40px", marginBottom: "20px", fontWeight: '800'}}>Available Opportunities</h3>
      
      {/* PIC 2 FIX: BALANCED PROPORTIONS */}
      <div className="event-grid-industrial">
        {events.map(e => (
          <div className="event-card" key={e.id}>
            <div className="event-thumb">
{e.thumbnail && (
  <img
    src={`${API}${e.thumbnail}`}
    onError={(e) => (e.target.style.display = "none")}
  />
)}
            </div>
            <div className="event-details">
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                <span style={{fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary)'}}>
                  {new Date(e.event_date).toLocaleDateString('en-GB')}
                </span>
                <span style={{fontSize: '0.85rem', fontWeight: '800', color: e.registration_fee > 0 ? "#fbbf24" : "#10b981"}}>
                  {e.registration_fee > 0 ? `₹${e.registration_fee}` : "FREE"}
                </span>
              </div>
              <h4 style={{textTransform: 'uppercase', fontSize: '1.05rem', fontWeight: '800', marginBottom: '8px', color: '#fff'}}>
                {e.name}
              </h4>
              <p className="e-venue" style={{fontSize: '0.8rem', opacity: '0.8'}}>📍 {e.venue}</p>
             <button
  className="primary-glow-btn full"
  disabled={processingEvent === e.id}
  onClick={() => register(e.id)}
>
  {processingEvent === e.id
    ? "PROCESSING..."
    : e.registration_fee > 0
      ? "PAY & REGISTER"
      : "REGISTER NOW"}
</button>


            </div>
          </div>
        ))}
      </div>

      {/* PIC 3 FIX: INDUSTRIAL MY CREDENTIALS */}
   <div className="glass-card full-width-card" style={{ marginTop: "40px" }}>
  <h3 style={{ fontWeight: '800', marginBottom: '20px' }}>
    My Credentials
  </h3>

  {registrations.filter(r => r.verified === 1).length === 0 ? (
    <p style={{ color: 'var(--text-dim)' }}>
      No verified credentials yet.
    </p>
  ) : (
    registrations
      .filter(r => r.verified === 1)
      .map(r => (
        <div
          className="event-row-card"
          key={r.reg_code}
          style={{
            padding: '1.5rem',
            background: 'rgba(255,255,255,0.02)'
          }}
        >
          <span
            style={{
              textTransform: 'uppercase',
              fontWeight: '700',
              letterSpacing: '1px',
              fontSize: '0.95rem'
            }}
          >
            {r.event_name}
          </span>

          <button
            className="btn-mini-sec"
            onClick={() =>
              window.open(
                `${API}/api/certificate/${r.reg_code}`,
                "_blank"
              )
            }
          >
            Download Certificate
          </button>
        </div>
      ))
  )}
</div>

      </div>
  );
}

/* ── ADMIN DASHBOARD ── */
function AdminDashboard({ token }) {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    axios.get(`${API}/api/admin/events`, { headers: { Authorization: `Bearer ${token}` } }).then(res => setEvents(res.data));
  }, [token]);

  return (
    <div className="dashboard-container">
      <div className="glass-card full-width-card">
        <h3>System Analytics</h3>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Event</th><th>Capacity</th><th>Registrations</th><th>Attended</th></tr></thead>
            <tbody>
              {events.map(e => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.max_seats}</td>
                  <td>{e.registrations}</td>
                  <td className="verified">{e.attended}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;