import { useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import "./App.css";

const API = "http://10.48.113.196:5001";

/* ================= APP ================= */
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
    <div className="container">
      {!user ? (
        mode === "login" ? (
          <Login setUser={setUser} setMode={setMode} />
        ) : (
          <Register setMode={setMode} />
        )
      ) : (
        <>
          <div className="top-bar">
            <p>
              Logged in as <b>{user.role}</b>
            </p>
            <button className="secondary" onClick={logout}>
              Logout
            </button>
          </div>

          <EventSystem role={user.role} token={user.token} />
        </>
      )}
    </div>
  );
}

function formatDateTime(dt) {
  const d = new Date(dt);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }) + " • " +
  d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  });
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
    } catch {
      alert("Invalid credentials");
    }
  };

  return (
    <div className="card">
      <h2>Login</h2>
      <form onSubmit={submit}>
        <input placeholder="Email" onChange={e => setForm({ ...form, email: e.target.value })} />
        <input type="password" placeholder="Password" onChange={e => setForm({ ...form, password: e.target.value })} />
        <button className="primary">Login</button>
      </form>
      <button className="secondary" onClick={() => setMode("register")}>
        Register
      </button>
    </div>
  );
}

/* ================= REGISTER ================= */
function Register({ setMode }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
  });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/api/auth/register`, form);
      alert("Registered successfully");
      setMode("login");
    } catch {
      alert("User already exists");
    }
  };

  return (
    <div className="card">
      <h2>Register</h2>
      <form onSubmit={submit}>
        <input placeholder="Name" onChange={e => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Email" onChange={e => setForm({ ...form, email: e.target.value })} />
        <input type="password" placeholder="Password" onChange={e => setForm({ ...form, password: e.target.value })} />
        <select onChange={e => setForm({ ...form, role: e.target.value })}>
          <option value="student">Student</option>
          <option value="organizer">Organizer</option>
        </select>
        <button className="primary">Register</button>
      </form>
      <button className="secondary" onClick={() => setMode("login")}>
        Back
      </button>
    </div>
  );
}

/* ================= ROUTER ================= */
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

  const [form, setForm] = useState({
  name: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  venue: "",
  description: "",
  maxSeats: 0,
});


  const headers = { Authorization: `Bearer ${token}` };

  const loadEvents = () => {
    axios.get(`${API}/api/organizer/events`, { headers })
      .then(res => setEvents(res.data));
  };

  useEffect(() => {
    loadEvents();
  }, [token]);

  const createEvent = async (e) => {
    e.preventDefault();
    await axios.post(`${API}/api/events`, form, { headers });
    setForm({
  name: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  venue: "",
  description: "",
  maxSeats: 0,
});

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
      .then(res => setRegs(res.data))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <div className="dashboard-header">
        <h3>Organizer Dashboard</h3>
      </div>

      <div className="card">
        <h4>Create Event</h4>
        <form onSubmit={createEvent}>
          <input placeholder="Event Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input
          type="date"
          value={form.eventDate}
          onChange={e => setForm({ ...form, eventDate: e.target.value })}
          />
          <input
  type="time"
  title="Start Time"
  aria-label="Start Time"
  value={form.startTime}
  onChange={e => setForm({ ...form, startTime: e.target.value })}
/>

<input
  type="time"
  title="End Time"
  aria-label="End Time"
  value={form.endTime}
  onChange={e => setForm({ ...form, endTime: e.target.value })}
/>

          <input placeholder="Venue" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} />
          <input type="number" placeholder="Max Seats" value={form.maxSeats} onChange={e => setForm({ ...form, maxSeats: e.target.value })} />
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <button className="primary">Create Event</button>
        </form>
      </div>

      <div className="card">
        <h4>Your Events</h4>
        <ul>
          {events.map(e => (
            <li className="event-item" key={e.id}>
              <span>
  <b>{e.name}</b><br />
{e.venue} • {formatDateTime(e.event_date)} <br />
{e.start_time} – {e.end_time}
</span>

              <div className="event-actions">
                <button className="secondary" onClick={() => loadRegistrations(e.id)}>View</button>
                <button className="danger" onClick={() => deleteEvent(e.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h4>Attendance</h4>
        {loading ? <p>Loading...</p> : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Register No</th>
                <th>Department</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {regs.map((r, i) => (
                <tr key={i}>
                  <td>{r.student_name}</td>
                  <td>{r.register_no}</td>
                  <td>{r.department}</td>
                  <td>
                    <span className={`badge ${r.verified ? "present" : "absent"}`}>
                      {r.verified ? "Present" : "Absent"}
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

  const res = await axios.post(
    `${API}/api/events/${id}/register`,
    form,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const w = window.open();
  w.document.write(`<img src="${res.data.qrDataUrl}" />`);
};

  return (
    <div className="card">
      <h3>Student Dashboard</h3>

      <input placeholder="Name" onChange={e => setForm({ ...form, studentName: e.target.value })} />
      <input placeholder="Register No" onChange={e => setForm({ ...form, registerNo: e.target.value })} />
      <input placeholder="Department" onChange={e => setForm({ ...form, department: e.target.value })} />

      <h4>Available Events</h4>
      <ul>
        {events.map(e => (
          <li className="event-item" key={e.id}>
           <span>
  <b>{e.name}</b><br/>
  {new Date(e.event_date).toLocaleDateString("en-IN", {
  dateStyle: "medium"
})}
<br />
{e.start_time} – {e.end_time}

</span>


            <button className="primary" onClick={() => register(e.id)}>Register</button>
          </li>
        ))}
      </ul>

      <h4>My Certificates</h4>
      <ul>
        {registrations.map(r => (
          <li className="event-item" key={r.reg_code}>
            <span><b>{r.event_name}</b> – {r.venue}</span>
            {r.verified ? (
              <a href={`${API}/api/certificate/${r.reg_code}`} target="_blank" rel="noreferrer">
                Download Certificate
              </a>
            ) : (
              <span className="badge absent">Not Verified</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ================= ADMIN ================= */
function AdminDashboard({ token }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    axios.get(`${API}/api/admin/events`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setEvents(res.data));
  }, [token]);

  return (
    <div className="card">
      <h3>Admin Dashboard</h3>
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Date</th>
            <th>Venue</th>
            <th>Registrations</th>
            <th>Attended</th>
          </tr>
        </thead>
        <tbody>
          {events.map(e => (
            <tr key={e.id}>
              <td>{e.name}</td>
              <td>{e.event_date}</td>
              <td>{e.venue}</td>
              <td>{e.registrations}</td>
              <td>{e.attended}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;


