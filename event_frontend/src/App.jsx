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
}

    finally { setLoading(false); }
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

/* ── ORGANIZER DASHBOARD (Updated for Thumbnails) ── */
function OrganizerDashboard({ token }) {
  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null); // New state for file
  const [form, setForm] = useState({ name: "", eventDate: "", startTime: "", endTime: "", venue: "", description: "", maxSeats: 0 });
  const headers = { Authorization: `Bearer ${token}` };

  const loadEvents = () => {
    setLoading(true);
    axios.get(`${API}/api/organizer/events`, { headers })
      .then(res => setEvents(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEvents(); }, [token]);

  const createEvent = async (e) => {
    e.preventDefault();
    
    // Industrial Standard: Using FormData for Multipart (File + Text)
    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("eventDate", form.eventDate);
    formData.append("startTime", form.startTime);
    formData.append("endTime", form.endTime);
    formData.append("venue", form.venue);
    formData.append("description", form.description);
    formData.append("maxSeats", form.maxSeats);
    
    if (selectedFile) {
      formData.append("thumbnail", selectedFile);
    }

    try {
      await axios.post(`${API}/api/events`, formData, { 
        headers: { ...headers, "Content-Type": "multipart/form-data" } 
      });
      setForm({ name: "", eventDate: "", startTime: "", endTime: "", venue: "", description: "", maxSeats: 0 });
      setSelectedFile(null); // Clear file input
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
            <input className="full" placeholder="Event Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            <input type="date" value={form.eventDate} onChange={e => setForm({...form, eventDate: e.target.value})} required />
            <input type="number" placeholder="Capacity" value={form.maxSeats} onChange={e => setForm({...form, maxSeats: e.target.value})} />
            <input type="time" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} />
            <input type="time" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} />
            <input className="full" placeholder="Venue Location" value={form.venue} onChange={e => setForm({...form, venue: e.target.value})} />
            
            {/* New File Input */}
            <div className="full" style={{marginTop: "10px"}}>
              <label style={{fontSize: "0.8rem", color: "var(--text-dim)"}}>Event Thumbnail (Optional)</label>
              <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files[0])} />
            </div>

            <textarea className="full" placeholder="Internal Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
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
                  <small>{e.venue} • {new Date(e.event_date).toLocaleDateString()}</small>
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

/* ── STUDENT DASHBOARD (Updated with Visual Cards) ── */
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


  const register = async (id) => {
  try {
    const res = await axios.post(
      `${API}/api/events/${id}/register`,
      form,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const w_width = 450;
    const w_height = 650;
    const left = (window.screen.width / 2) - (w_width / 2);
    const top = (window.screen.height / 2) - (w_height / 2);
    const w = window.open("", "_blank", `width=${w_width},height=${w_height},left=${left},top=${top}`);

    w.document.write(`
      <html>
        <body style="background:#030712;color:white;text-align:center;font-family:sans-serif;padding:20px;display:flex;align-items:center;justify-content:center;height:90vh;">
          <div style="border:1px solid rgba(255,255,255,0.1);padding:30px;border-radius:24px;background:rgba(17, 24, 39, 0.8);backdrop-filter:blur(10px);box-shadow:0 20px 50px rgba(0,0,0,0.5);width:100%;">
            <h2 style="letter-spacing:2px;font-weight:800;margin-bottom:20px;">ENTRY PASS</h2>
            <div style="background:white;padding:15px;display:inline-block;border-radius:12px;margin-bottom:20px;">
              <img src="${res.data.qrDataUrl}" width="220" />
            </div>
            <p style="font-size:1.2rem;margin-bottom:25px;color:#9ca3af;">${form.studentName}</p>
            <button onclick="window.print()" style="padding:12px 30px;background:#6366f1;color:white;border:none;border-radius:10px;font-weight:bold;cursor:pointer;width:100%;">Print Entry Pass</button>
          </div>
        </body>
      </html>
    `);

  } catch (err) {
    if (err.response) {
      alert(err.response.data.message);
    } else {
      alert("Registration failed. Try again.");
    }
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
              <button className="primary-glow-btn full" onClick={() => register(e.id)}>Secure Entry Pass</button>
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
                {r.verified ? <a href={`${API}/api/certificate/${r.reg_code}`} className="status-pill verified">Download Certificate</a> : <span className="status-pill pending">Attendance Pending</span>}
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