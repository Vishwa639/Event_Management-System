import { useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import "./App.css";

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
    <div className="app-wrapper">
      <nav className="navbar fade-in">
        <div className="logo">eventsphere_</div>
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
        <h1 className="glitch-text">EventSphere</h1>
        <p className="tagline">The Industrial Standard for Academic Event Lifecycle Management</p>
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
/* ── ORGANIZER DASHBOARD ── */
function OrganizerDashboard({ token }) {
  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Form state — added only isPaid and registrationFee
  const [form, setForm] = useState({
    name: "",
    eventDate: "",
    startTime: "",
    endTime: "",
    venue: "",
    description: "",
    maxSeats: 0,
    isPaid: false,           // ← new
    registrationFee: 0       // ← new
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
    
    // Send fee: 0 if not paid, or the value if paid
    formData.append("registrationFee", form.isPaid ? form.registrationFee : 0);
    
    if (selectedFile) {
      formData.append("thumbnail", selectedFile);
    }

    try {
      await axios.post(`${API}/api/events`, formData, { 
        headers: { ...headers, "Content-Type": "multipart/form-data" } 
      });
      
      // Reset form (including new fields)
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

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h2>Control Center</h2>
        <p>Deploy and manage event infrastructure</p>
      </header>

      <div className="dashboard-grid">
        <div className="glass-card">
          <h3>Deploy New Event</h3>
          <form onSubmit={createEvent} className="dynamic-form">
            <input 
              className="full" 
              placeholder="Event Name" 
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value})} 
              required 
            />
            
            <input 
              type="date" 
              value={form.eventDate} 
              onChange={e => setForm({...form, eventDate: e.target.value})} 
              required 
            />
            
            <input 
              type="number" 
              placeholder="Capacity" 
              value={form.maxSeats} 
              onChange={e => setForm({...form, maxSeats: e.target.value})} 
            />

            {/* ── NEW: Paid checkbox + conditional fee field ── */}
            <div style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                id="isPaid"
                checked={form.isPaid}
                onChange={e => setForm({ ...form, isPaid: e.target.checked })}
                style={{ width: "18px", height: "18px", accentColor: "#6366f1" }}
              />
              <label 
                htmlFor="isPaid" 
                style={{ fontSize: "0.95rem", color: "#e2e8f0", cursor: "pointer" }}
              >
                This is a paid event
              </label>
            </div>

            {form.isPaid && (
              <input
                type="number"
                placeholder="Registration Fee (₹)"
                value={form.registrationFee}
                onChange={e => setForm({...form, registrationFee: parseFloat(e.target.value) || 0})}
                min="1"
                step="1"
                required={form.isPaid}  // only required if checked
                style={{ marginTop: "8px" }}
              />
            )}

            <input 
              type="time" 
              value={form.startTime} 
              onChange={e => setForm({...form, startTime: e.target.value})} 
            />
            
            <input 
              type="time" 
              value={form.endTime} 
              onChange={e => setForm({...form, endTime: e.target.value})} 
            />
            
            <input 
              className="full" 
              placeholder="Venue Location" 
              value={form.venue} 
              onChange={e => setForm({...form, venue: e.target.value})} 
            />
            
            <div className="full" style={{marginTop: "10px"}}>
              <label style={{fontSize: "0.8rem", color: "var(--text-dim)"}}>
                Event Thumbnail (Optional)
              </label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={e => setSelectedFile(e.target.files[0])} 
              />
            </div>

            <textarea 
              className="full" 
              placeholder="Internal Description" 
              value={form.description} 
              onChange={e => setForm({...form, description: e.target.value})} 
            />
            
            <button className="primary-glow-btn full">Publish to System</button>
          </form>
        </div>

        <div className="glass-card">
          <h3>Active Registry</h3>
          <div className="scroll-area">
            {events.map(e => (
              <div className="event-row-card" key={e.id}>
                <div>
                  <h4 className="e-title">{e.name}</h4>
                  <small>
                    {e.venue} • {new Date(e.event_date).toLocaleDateString()}
                    {e.registration_fee > 0 && ` • ₹${e.registration_fee}`}
                  </small>
                </div>
                <div className="btn-group">
                  <button className="btn-mini-sec" onClick={() => viewRegs(e.id)}>Track</button>
                  <button className="btn-mini-danger" onClick={() => deleteEvent(e.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card full-width-card">
        <div className="table-header">
          <h3>Attendance Manifest</h3>
          <span className="badge">{regs.length} Students</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Student</th><th>ID</th><th>Dept</th><th>Status</th></tr></thead>
            <tbody>
              {regs.map((r, i) => (
                <tr key={i} className="table-row-anim">
                  <td>{r.student_name}</td>
                  <td className="mono">{r.register_no}</td>
                  <td>{r.department}</td>
                  <td><span className={`status-pill ${r.verified ? "verified" : "pending"}`}>{r.verified ? "Verified" : "Pending"}</span></td>
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

  // Load Razorpay script dynamically
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
  if (!form.studentName || !form.registerNo || !form.department) {
    alert("Please fill your name, register number and department first");
    return;
  }

  const selectedEvent = events.find(e => e.id === eventId);
  if (!selectedEvent) {
    alert("Event not found");
    return;
  }

  const fee = Number(selectedEvent.registration_fee) || 0;

  if (fee <= 0) {
    alert("This is a free event.\n\nDirect registration not implemented yet.");
    return;
  }

  try {
    // Step 1: Ensure Razorpay script is loaded
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded || !window.Razorpay) {
      alert("Failed to load Razorpay payment system.\nPlease check your internet, disable adblocker, or try again.");
      return;
    }

    console.log("Razorpay loaded successfully"); // debug

    // Step 2: Create order
    const orderResponse = await axios.post(
      `${API}/api/events/${eventId}/create-payment-order`,
      { amount: fee },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const { orderId, amount, currency } = orderResponse.data;

    console.log("Order created:", { orderId, amount }); // debug

    // Step 3: Open Razorpay checkout
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_your_test_key_here",
      amount: amount,
      currency: currency,
      name: "EventSphere",
      description: `Registration for ${selectedEvent.name}`,
      order_id: orderId,
      handler: async function (response) {
        console.log("Payment success response:", response); // debug

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
              amount: amount,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          // Show QR in popup
          const w = window.open("", "_blank", "width=450,height=650");
          if (w) {
            w.document.write(`
              <html>
                <body style="background:#0f172a;color:white;text-align:center;font-family:sans-serif;padding:30px;">
                  <h2 style="margin-bottom:20px;">ENTRY PASS</h2>
                  <div style="background:white;padding:20px;border-radius:12px;display:inline-block;margin-bottom:25px;">
                    <img src="${verifyRes.data.qrDataUrl}" width="240" />
                  </div>
                  <p style="font-size:1.3rem;color:#e2e8f0;margin-bottom:15px;">${form.studentName}</p>
                  <p style="color:#34d399;font-weight:bold;">Payment Successful ✓</p>
                  <button onclick="window.print()" style="padding:12px 40px;background:#6366f1;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;">
                    Print Pass
                  </button>
                </body>
              </html>
            `);
            w.document.close();
          } else {
            alert("Popup blocked! Please allow popups for this site.");
          }
        } catch (err) {
          console.error("Verification failed:", err);
          alert(err.response?.data?.message || "Registration failed after payment");
        }
      },
      prefill: {
        name: form.studentName,
      },
      theme: {
        color: "#6366f1",
      },
      modal: {
        ondismiss: function () {
          console.log("Checkout closed by user");
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  } catch (err) {
    console.error("Registration error:", err);
    alert(err.response?.data?.message || "Payment initiation failed. Check console for details.");
  }
};
  return (
    <div className="dashboard-container">
      <div className="glass-card full-width-card">
        <h3>Student Profile</h3>
        <p style={{color:"var(--text-dim)", fontSize:"0.9rem", marginBottom:"1rem"}}>Complete your profile to register for events</p>
        <div className="dynamic-form">
           <input placeholder="Name" onChange={e => setForm({...form, studentName: e.target.value})} />
           <input placeholder="Reg No" onChange={e => setForm({...form, registerNo: e.target.value})} />
           <input placeholder="Dept" onChange={e => setForm({...form, department: e.target.value})} />
        </div>
      </div>

      <h3 style={{marginTop: "40px", marginBottom: "20px"}}>Available Opportunities</h3>
      <div className="event-grid-industrial">
        {events.map(e => (
          <div className="event-card" key={e.id}>
            <div className="event-thumb">
              {e.thumbnail ? (
                <img src={`${API}${e.thumbnail}`} alt="Thumbnail" />
              ) : (
                <div className="no-thumb">No Image Available</div>
              )}
              <div className="event-date-badge">{new Date(e.event_date).toLocaleDateString()}</div>
            </div>
            <div className="event-details">
              <h4>{e.name}</h4>
              <p className="e-venue">📍 {e.venue}</p>
              <p className="e-desc">{e.description}</p>
              <p style={{fontSize: "0.9rem", margin: "8px 0", color: e.registration_fee > 0 ? "#fbbf24" : "#10b981"}}>
                {e.registration_fee > 0 ? `₹${e.registration_fee}` : "Free"}
              </p>
              <button className="primary-glow-btn full" onClick={() => register(e.id)}>
                {e.registration_fee > 0 ? "Pay & Register" : "Register"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card full-width-card" style={{marginTop: "40px"}}>
        <h3>My Credentials</h3>
        {registrations.length === 0 ? <p>No registrations found.</p> : (
          registrations.map(r => (
             <div className="event-row-card" key={r.reg_code}>
                <span>{r.event_name}</span>
                {r.verified ? (
                  <a href={`${API}/api/certificate/${r.reg_code}`} className="status-pill verified">Download Certificate</a>
                ) : (
                  <span className="status-pill pending">Attendance Pending</span>
                )}
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