const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = "event_system_secret";

/* ================= AUTH MIDDLEWARE ================= */
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin only" });
  next();
}

/* ================= DB ================= */
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "iAm@mysqlroot111",
  database: "event_system",
});

db.connect(err => {
  if (err) console.log("❌ DB error:", err);
  else console.log("✅ MySQL connected");
});

/* ================= AUTH ================= */
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)",
    [name, email, hashed, role],
    err => {
      if (err) return res.status(400).json({ message: "User exists" });
      res.json({ message: "Registered" });
    }
  );
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email=?", [email], async (_, rows) => {
    if (!rows.length) return res.status(401).json({ message: "Invalid" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token, user: { id: user.id, role: user.role } });
  });
});

/* ================= EVENTS ================= */
app.get("/api/events", (_, res) => {
  db.query("SELECT * FROM events ORDER BY event_date", (_, rows) =>
    res.json(rows)
  );
});

app.post("/api/events", auth, (req, res) => {
  if (req.user.role !== "organizer")
    return res.status(403).json({ message: "Forbidden" });

  const {
    name,
    eventDate,
    startTime,
    endTime,
    venue,
    description,
    maxSeats
  } = req.body;

  db.query(
    `INSERT INTO events
     (name, event_date, start_time, end_time, venue, description, max_seats, organizer_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      eventDate,
      startTime,
      endTime,
      venue,
      description,
      maxSeats || 0,
      req.user.id
    ],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Create failed" });
      res.json({ id: result.insertId });
    }
  );
});

/* ================= DELETE EVENT ================= */
app.delete("/api/events/:id", auth, (req, res) => {
  if (req.user.role !== "organizer")
    return res.status(403).json({ message: "Forbidden" });

  const eventId = req.params.id;

  db.query(
    "DELETE FROM event_registrations WHERE event_id=?",
    [eventId],
    err => {
      if (err) return res.status(500).json({ message: "Delete failed" });

      db.query(
        "DELETE FROM events WHERE id=? AND organizer_id=?",
        [eventId, req.user.id],
        (_, result) => {
          if (!result.affectedRows)
            return res.status(404).json({ message: "Event not found" });

          res.json({ message: "Event deleted" });
        }
      );
    }
  );
});

/* ================= ORGANIZER ================= */
app.get("/api/organizer/events", auth, (req, res) => {
  if (req.user.role !== "organizer")
    return res.status(403).json({ message: "Forbidden" });

  db.query(
    "SELECT * FROM events WHERE organizer_id=? ORDER BY event_date DESC",
    [req.user.id],
    (_, rows) => res.json(rows)
  );
});

app.get("/api/organizer/events/:id/registrations", auth, (req, res) => {
  if (req.user.role !== "organizer")
    return res.status(403).json({ message: "Forbidden" });

  const sql = `
    SELECT 
      r.student_name,
      r.register_no,
      r.department,
      r.verified
    FROM event_registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.event_id = ? AND e.organizer_id = ?
  `;

  db.query(sql, [req.params.id, req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(rows);
  });
});


/* ================= REGISTRATION ================= */
app.post("/api/events/:id/register", auth, (req, res) => {
  const { studentName, registerNo, department } = req.body;
  const eventId = req.params.id;

  db.query(
    "SELECT id FROM event_registrations WHERE event_id=? AND user_id=?",
    [eventId, req.user.id],
    (_, dup) => {
      if (dup.length)
        return res.status(400).json({ message: "Already registered" });

      const regCode = uuidv4();

      db.query(
        `INSERT INTO event_registrations
         (event_id,user_id,student_name,register_no,department,reg_code)
         VALUES (?,?,?,?,?,?)`,
        [eventId, req.user.id, studentName, registerNo, department, regCode],
        async () => {
          const qrDataUrl = await QRCode.toDataURL(
            `http://10.48.113.196:5001/api/verify/${regCode}`
          );
          res.json({ qrDataUrl });
        }
      );
    }
  );
});

/* ================= QR VERIFY ================= */
app.get("/api/verify/:code", (req, res) => {
  db.query(
    `
    SELECT r.student_name, r.register_no, r.department,
           e.name AS event_name, e.venue, e.start_time, e.end_time
    FROM event_registrations r
    JOIN events e ON r.event_id=e.id
    WHERE r.reg_code=?
    LIMIT 1
    `,
    [req.params.code],
    (err, rows) => {
      if (err || !rows.length)
        return res.status(404).send("Invalid QR");

      const r = rows[0];

      db.query(
        "UPDATE event_registrations SET verified=1, verified_at=NOW() WHERE reg_code=?",
        [req.params.code]
      );

      res.send(`
        <h2>Attendance Verified ✅</h2>
        <p><b>Name:</b> ${r.student_name}</p>
        <p><b>Register No:</b> ${r.register_no}</p>
        <p><b>Department:</b> ${r.department}</p>
        <p><b>Verified At:</b> ${new Date().toLocaleString("en-IN")}</p>
        <hr/>
        <p><b>Event:</b> ${r.event_name}</p>
        <p><b>Venue:</b> ${r.venue}</p>
        <p><b>Time:</b> ${r.start_time} – ${r.end_time}</p>
      `);
    }
  );
});

/* ================= CERTIFICATE ================= */
app.get("/api/certificate/:regCode", (req, res) => {
  db.query(
    `
    SELECT r.*, e.name AS event_name, e.event_date
    FROM event_registrations r
    JOIN events e ON r.event_id=e.id
    WHERE r.reg_code=?
    `,
    [req.params.regCode],
    (err, rows) => {
      if (err || !rows.length)
        return res.status(404).send("Invalid record");

      const r = rows[0];
      if (!r.verified)
        return res.status(403).send("Attendance not verified");

      if (r.certificate_issued_at)
        return res.status(403).send("Certificate already issued");

      db.query(
        "UPDATE event_registrations SET certificate_issued_at=NOW() WHERE reg_code=?",
        [req.params.regCode]
      );

      const doc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=certificate.pdf");
      doc.pipe(res);

      doc.fontSize(22).text("Certificate of Participation", { align: "center" });
      doc.moveDown(2);
      doc.text(r.student_name, { align: "center" });
      doc.moveDown();
      doc.text(`Event: ${r.event_name}`, { align: "center" });
      doc.text(`Date: ${r.event_date}`, { align: "center" });
      doc.end();
    }
  );
});

/* ================= STUDENT ================= */
app.get("/api/student/registrations", auth, (req, res) => {
  db.query(
    `
    SELECT r.reg_code, r.verified, e.name AS event_name, e.venue
    FROM event_registrations r
    JOIN events e ON r.event_id=e.id
    WHERE r.user_id=?
    `,
    [req.user.id],
    (_, rows) => res.json(rows)
  );
});

/* ================= ADMIN ================= */
app.get("/api/admin/events", auth, adminOnly, (_, res) => {
  db.query(
    `
    SELECT e.name,
           COUNT(r.id) AS registrations,
           SUM(r.verified=1) AS attended
    FROM events e
    LEFT JOIN event_registrations r ON e.id=r.event_id
    GROUP BY e.id
    `,
    (_, rows) => res.json(rows)
  );
});

/* ================= SERVER ================= */
app.listen(5001, () =>
  console.log("✅ Backend running on port 5001")
);
