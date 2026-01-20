const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================= FILE UPLOAD CONFIG ================= */
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use("/uploads", express.static("uploads"));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith("image/"))
      return cb(new Error("Only images allowed"));
    cb(null, true);
  },
});

/* ================= CONFIG ================= */
const JWT_SECRET = process.env.JWT_SECRET;

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

/* ================= DB ================= */
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
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

app.post("/api/events", auth, upload.single("thumbnail"), (req, res) => {
  if (req.user.role !== "organizer")
    return res.status(403).json({ message: "Forbidden" });

  const {
    name,
    eventDate,
    startTime,
    endTime,
    venue,
    description,
    maxSeats,
  } = req.body;

  const thumbnailPath = req.file ? `/uploads/${req.file.filename}` : null;

  db.query(
    `INSERT INTO events
     (name,event_date,start_time,end_time,venue,description,max_seats,organizer_id,thumbnail)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      name,
      eventDate,
      startTime,
      endTime,
      venue,
      description,
      maxSeats || 0,
      req.user.id,
      thumbnailPath,
    ],
    err => {
      if (err) return res.status(500).json({ message: "Create failed" });
      res.json({ message: "Event created" });
    }
  );
});

/* ================= ORGANIZER EVENTS ================= */
app.get("/api/organizer/events", auth, (req, res) => {
  if (req.user.role !== "organizer")
    return res.status(403).json({ message: "Forbidden" });

  db.query(
    "SELECT * FROM events WHERE organizer_id=? ORDER BY event_date DESC",
    [req.user.id],
    (_, rows) => res.json(rows)
  );
});

/* ================= ORGANIZER EVENT REGISTRATIONS ================= */
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


/* ================= STUDENT REGISTRATIONS (MISSING FIX) ================= */
app.get("/api/student/registrations", auth, (req, res) => {
  db.query(
    `
    SELECT r.reg_code, r.verified,
           e.name AS event_name, e.venue
    FROM event_registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.user_id = ?
    `,
    [req.user.id],
    (_, rows) => res.json(rows)
  );
});

/* ================= REGISTRATION (SEAT LIMIT) ================= */
app.post("/api/events/:id/register", auth, (req, res) => {
  const { studentName, registerNo, department } = req.body;
  const eventId = req.params.id;

  db.query(
    `SELECT 
        (SELECT COUNT(*) FROM event_registrations WHERE event_id=?) AS usedSeats,
        max_seats
     FROM events WHERE id=?`,
    [eventId, eventId],
    (_, rows) => {
      if (!rows.length)
        return res.status(404).json({ message: "Event not found" });

      const { usedSeats, max_seats } = rows[0];
      if (max_seats > 0 && usedSeats >= max_seats)
        return res.status(403).json({ message: "Event full" });

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
              const qr = await QRCode.toDataURL(
                `${process.env.BASE_URL}/api/verify/${regCode}`
              );

              res.json({ qrDataUrl: qr });
            }
          );
        }
      );
    }
  );
});

/* ================= QR VERIFY ================= */
app.get("/api/verify/:code", (req, res) => {
  db.query(
    `SELECT r.*, e.name AS event_name
     FROM event_registrations r
     JOIN events e ON r.event_id=e.id
     WHERE r.reg_code=?`,
    [req.params.code],
    (_, rows) => {
      if (!rows.length) return res.status(404).send("Invalid QR");

      const r = rows[0];
      if (r.verified) return res.send("<h2>Already Verified ✅</h2>");

      db.query(
        "UPDATE event_registrations SET verified=1, verified_at=NOW() WHERE reg_code=?",
        [req.params.code]
      );

      res.send(`<h2>Attendance Verified ✅</h2><p>${r.student_name}</p>`);
    }
  );
});

/* ================= SERVER ================= */
app.listen(5001, () =>
  console.log("✅ Backend running on port 5001")
);
