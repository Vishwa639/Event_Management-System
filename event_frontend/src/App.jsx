import { useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import "./App.css";

const API = "http://10.48.113.196:5001";

function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("login");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode(token);
      setUser({ token, role: decoded.role });
    }
  }, []);

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setMode("login");
  };

  return (
    <div className="container slide-up">
      {!user ? (
        mode === "login" ? (
          <Login setUser={setUser} setMode={setMode} />
        ) : (
          <Register setMode={setMode} />
        )
      ) : (
        <>
          {/* --- THE REFINED TOP BAR --- */}
          <div className="top-bar">
            <div>
              <h3>eventsphere_</h3>
              <p style={{ 
                margin: 0, 
                fontSize: '11px', 
                color: 'var(--text-secondary)', 
                textTransform: 'uppercase', 
                letterSpacing: '1.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px' 
              }}>
                <span style={{ 
                  width: '6px', 
                  height: '6px', 
                  background: 'var(--success-neon)', 
                  borderRadius: '50%', 
                  display: 'inline-block',
                  boxShadow: '0 0 8px var(--success-neon)' 
                }}></span>
                System Active // {user.role}
              </p>
            </div>
            <button className="secondary" onClick={logout}>Terminate Session</button>
          </div>

          <EventSystem role={user.role} token={user.token} />
        </>
      )}
    </div>
  );
}

function formatDateTime(dt) {
  const d = new Date(dt);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) + " • " +
  d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/* ================= LOGIN ================= */
function Login({ setUser, setMode }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/api/auth/login`, form);
      localStorage.setItem("token", res.data.token);
      setUser({ token: res.data.token, role: res.data.user.role });
    } catch { alert("Invalid credentials"); }
  };
  return (
    <div className="card" style={{maxWidth:'400px', margin:'80px auto'}}>
      <h2>Sign In</h2>
      <form onSubmit={submit} style={{display:'flex', flexDirection:'column'}}>
        <input placeholder="Email Address" onChange={e => setForm({ ...form, email: e.target.value })} />
        <input type="password" placeholder="Password" onChange={e => setForm({ ...form, password: e.target.value })} />
        <button className="primary" style={{width:'100%'}}>Continue</button>
      </form>
      <button className="secondary" style={{width:'100%', marginTop:'10px'}} onClick={() => setMode("register")}>Create Account</button>
    </div>
  );
}

/* ================= REGISTER ================= */
function Register({ setMode }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student" });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/api/auth/register`, form);
      alert("Registered successfully");
      setMode("login");
    } catch { alert("User already exists"); }
  };
  return (
    <div className="card" style={{maxWidth:'400px', margin:'80px auto'}}>
      <h2>Create Account</h2>
      <form onSubmit={submit} style={{display:'flex', flexDirection:'column'}}>
        <input placeholder="Full Name" onChange={e => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Email Address" onChange={e => setForm({ ...form, email: e.target.value })} />
        <input type="password" placeholder="Password" onChange={e => setForm({ ...form, password: e.target.value })} />
        <select onChange={e => setForm({ ...form, role: e.target.value })}>
          <option value="student">Student</option>
          <option value="organizer">Organizer</option>
        </select>
        <button className="primary" style={{width:'100%'}}>Register</button>
      </form>
      <button className="secondary" style={{width:'100%', marginTop:'10px'}} onClick={() => setMode("login")}>Back to Login</button>
    </div>
  );
}

function EventSystem({ role, token }) {
  if (role === "organizer") return <OrganizerDashboard token={token} />;
  if (role === "student") return <StudentDashboard />;
  if (role === "admin") return <AdminDashboard token={token} />;
  return null;
}

/* ================= ORGANIZER ================= */
function OrganizerDashboard({ token }) {
  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", eventDate: "", startTime: "", endTime: "", venue: "", description: "", maxSeats: 0 });
  const headers = { Authorization: `Bearer ${token}` };

  const loadEvents = () => {
    axios.get(`${API}/api/organizer/events`, { headers }).then(res => setEvents(res.data));
  };
  useEffect(() => { loadEvents(); }, [token]);

  const createEvent = async (e) => {
    e.preventDefault();
    await axios.post(`${API}/api/events`, form, { headers });
    setForm({ name: "", eventDate: "", startTime: "", endTime: "", venue: "", description: "", maxSeats: 0 });
    loadEvents();
  };

  const deleteEvent = async (id) => {
    if (!window.confirm("Delete this event?")) return;
    await axios.delete(`${API}/api/events/${id}`, { headers });
    setEvents(prev => prev.filter(e => e.id !== id));
    setRegs([]);
  };

  const loadRegistrations = (id) => {
    setLoading(true);
    axios.get(`${API}/api/organizer/events/${id}/registrations`, { headers })
      .then(res => setRegs(res.data)).finally(() => setLoading(false));
  };

  return (
    <>
      <div className="card">
        <h4>Event Configuration</h4>
        <form onSubmit={createEvent}>
          <input style={{gridColumn:'span 2'}} placeholder="Event Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input type="date" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} />
          <input type="number" placeholder="Max Capacity" value={form.maxSeats} onChange={e => setForm({ ...form, maxSeats: e.target.value })} />
          <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
          <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
          <input style={{gridColumn:'span 2'}} placeholder="Venue" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} />
          <textarea style={{gridColumn:'span 2'}} placeholder="Event Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <button className="primary" style={{gridColumn:'span 2'}}>Publish Event</button>
        </form>
      </div>

      <div className="card">
        <h4>Managed Events</h4>
        {events.map(e => (
          <div className="event-item" key={e.id}>
            <span><b>{e.name}</b><br/>{e.venue} • {formatDateTime(e.event_date)}</span>
            <div style={{display:'flex', gap:'8px'}}>
              <button className="secondary" onClick={() => loadRegistrations(e.id)}>Track</button>
              {/* UPDATED: Added className="danger" for crimson styling */}
              <button className="danger" onClick={() => deleteEvent(e.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h4>Attendance Manifest</h4>
        {loading ? <p>Syncing...</p> : (
          <table>
            <thead><tr><th>Student</th><th>Reg No</th><th>Department</th><th>Status</th></tr></thead>
            <tbody>
              {regs.map((r, i) => (
                <tr key={i}>
                  <td>{r.student_name}</td><td>{r.register_no}</td><td>{r.department}</td>
                  <td>
                    {/* UPDATED: Uses the status-badge and new emerald/amber classes */}
                    <span className={`status-badge ${r.verified ? "status-verified" : "status-pending"}`}>
                      {r.verified ? "Verified" : "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ================= STUDENT ================= */
function StudentDashboard() {
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [form, setForm] = useState({ studentName: "", registerNo: "", department: "" });

  useEffect(() => {
    axios.get(`${API}/api/events`).then(res => setEvents(res.data));
    const token = localStorage.getItem("token");
    axios.get(`${API}/api/student/registrations`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setRegistrations(res.data));
  }, []);

  const register = async (id) => {
    const token = localStorage.getItem("token");
    const res = await axios.post(`${API}/api/events/${id}/register`, form, { headers: { Authorization: `Bearer ${token}` } });
    const w = window.open("", "_blank", "width=500,height=700");
    w.document.write(`
      <html><head><title>Entry Pass</title><style>
        body { font-family: sans-serif; background: #0f172a; color: white; text-align: center; padding: 40px; }
        .ticket { border: 2px solid #334155; padding: 30px; border-radius: 16px; background: #1e293b; }
        img { background: white; padding: 15px; border-radius: 12px; margin: 20px 0; }
        b { color: #6366f1; }
      </style></head>
      <body><div class="ticket"><h2>PASS CONFIRMED</h2><img src="${res.data.qrDataUrl}" width="200" />
      <p>Student: <b>${form.studentName}</b></p><p>ID: <b>${form.registerNo}</b></p>
      <button onclick="window.print()" style="padding:10px 20px; background:#6366f1; color:white; border:none; border-radius:5px;">Print Pass</button>
      </div></body></html>
    `);
  };

  return (
    <div className="card">
      <h4>Student Profile</h4>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'20px'}}>
        <input placeholder="Name" onChange={e => setForm({ ...form, studentName: e.target.value })} />
        <input placeholder="Register No" onChange={e => setForm({ ...form, registerNo: e.target.value })} />
        <input placeholder="Department" onChange={e => setForm({ ...form, department: e.target.value })} />
      </div>
      <h4>Available Opportunities</h4>
      {events.map(e => (
        <div className="event-item" key={e.id}>
          <span><b>{e.name}</b><br/>{new Date(e.event_date).toLocaleDateString()} • {e.start_time}</span>
          <button className="primary" onClick={() => register(e.id)}>Register</button>
        </div>
      ))}
      <h4 style={{marginTop:'30px'}}>My Credentials</h4>
      {registrations.map(r => (
        <div className="event-item" key={r.reg_code}>
          <span><b>{r.event_name}</b></span>
          {r.verified ? 
            <a href={`${API}/api/certificate/${r.reg_code}`} className="status-badge status-verified" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>Download Certificate</a> 
            : <span className="status-badge status-pending">Awaiting Verification</span>}
        </div>
      ))}
    </div>
  );
}

/* ================= ADMIN ================= */
function AdminDashboard({ token }) {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    axios.get(`${API}/api/admin/events`, { headers: { Authorization: `Bearer ${token}` } }).then(res => setEvents(res.data));
  }, [token]);
  return (
    <div className="card">
      <h4>System Analytics</h4>
      <table>
        <thead><tr><th>Event</th><th>Date</th><th>Venue</th><th>Regs</th><th>Attended</th></tr></thead>
        <tbody>
          {events.map(e => (
            <tr key={e.id}><td>{e.name}</td><td>{e.event_date}</td><td>{e.venue}</td><td>{e.registrations}</td><td><b>{e.attended}</b></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;