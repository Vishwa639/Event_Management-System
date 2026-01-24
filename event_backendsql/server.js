console.log("🔥🔥 RUNNING THIS SERVER FILE 🔥🔥");
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
const crypto = require("crypto");
const Razorpay = require("razorpay");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================= CONFIG ================= */
const JWT_SECRET = process.env.JWT_SECRET;

/* ================= RAZORPAY ================= */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ================= FILE UPLOAD ================= */
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use("/uploads", express.static("uploads"));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, "uploads/"),
    filename: (_, file, cb) =>
      cb(null, Date.now() + path.extname(file.originalname)),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
});

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
  db.query(
    "SELECT id, name, event_date, venue, max_seats, thumbnail, registration_fee FROM events ORDER BY event_date",
    (_, rows) => res.json(rows)
  );
});

app.post("/api/events", auth, upload.single("thumbnail"), (req, res) => {
  if (req.user.role !== "organizer")
    return res.status(403).json({ message: "Forbidden" });

  const {
    name,
    eventDate,
    venue,
    description,
    maxSeats,
    registrationFee = 0,
  } = req.body;

  db.query(
    `INSERT INTO events
     (name,event_date,venue,description,max_seats,organizer_id,thumbnail,registration_fee)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      name,
      eventDate,
      venue,
      description,
      maxSeats,
      req.user.id,
      req.file ? `/uploads/${req.file.filename}` : null,
      registrationFee,
    ],
    err => {
      if (err) return res.status(500).json({ message: "Create failed" });
      res.json({ message: "Event created" });
    }
  );
});

/* ================= ORGANIZER ================= */
app.get("/api/organizer/events", auth, (req, res) => {
  if (req.user.role !== "organizer")
    return res.status(403).json({ message: "Forbidden" });

  db.query(
    "SELECT * FROM events WHERE organizer_id=?",
    [req.user.id],
    (_, rows) => res.json(rows)
  );
});

app.get("/api/organizer/events/:id/registrations", auth, (req, res) => {
  db.query(
    "SELECT student_name, register_no, department, verified FROM event_registrations WHERE event_id=?",
    [req.params.id],
    (_, rows) => res.json(rows)
  );
});

app.delete("/api/events/:id", auth, (req, res) => {
  db.query(
    "DELETE FROM events WHERE id=? AND organizer_id=?",
    [req.params.id, req.user.id],
    () => res.json({ message: "Deleted" })
  );
});

/* ================= STUDENT ================= */
app.get("/api/student/registrations", auth, (req, res) => {
  db.query(
    `SELECT r.reg_code, r.verified, e.name AS event_name
     FROM event_registrations r
     JOIN events e ON r.event_id=e.id
     WHERE r.user_id=?`,
    [req.user.id],
    (_, rows) => res.json(rows)
  );
});

/* ================= PAYMENT ORDER ================= */
app.post("/api/events/:id/create-payment-order", auth, (req, res) => {
  db.query(
    "SELECT id FROM event_registrations WHERE event_id=? AND user_id=?",
    [req.params.id, req.user.id],
    (_, exists) => {
      if (exists.length) {
        return res.status(400).json({ message: "Already registered" });
      }

      // ✅ MOVE seat + fee query HERE
      db.query(
        `
        SELECT 
          e.registration_fee,
          e.max_seats,
          COUNT(r.id) AS usedSeats
        FROM events e
        LEFT JOIN event_registrations r ON e.id = r.event_id
        WHERE e.id = ?
        GROUP BY e.id
        `,
        [req.params.id],
        (_, rows) => {
          if (!rows.length)
            return res.status(404).json({ message: "Event not found" });

          const { registration_fee, max_seats, usedSeats } = rows[0];

          if (max_seats > 0 && usedSeats >= max_seats)
            return res.status(403).json({ message: "Event is full" });

          if (registration_fee <= 0)
            return res.status(400).json({ message: "Free event" });

          razorpay.orders.create(
            {
              amount: registration_fee * 100,
              currency: "INR",
            },
            (_, order) => {
              res.json({
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
              });
            }
          );
        }
      );
    }
  );
});


/* ================= VERIFY + REGISTER ================= */
app.post("/api/events/:id/verify-payment-and-register", auth, async (req, res) => {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    studentName,
    registerNo,
    department,
    amount,
  } = req.body;

  const isFree = razorpay_signature === "FREE";

  if (!isFree) {
    const sign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (sign !== razorpay_signature)
      return res.status(400).json({ message: "Invalid signature" });
  }

  const regCode = uuidv4();

db.query(
  "SELECT id FROM event_registrations WHERE event_id=? AND user_id=?",
  [req.params.id, req.user.id],
  (_, exists) => {
    if (exists.length) {
      return res.status(400).json({ message: "Already registered" });
    }

    // ⬇️ seat check MUST be inside
    db.query(
      `
      SELECT 
        e.max_seats,
        COUNT(r.id) AS usedSeats
      FROM events e
      LEFT JOIN event_registrations r ON e.id = r.event_id
      WHERE e.id = ?
      GROUP BY e.id
      `,
      [req.params.id],
      (err, rows) => {
        if (err) return res.status(500).json({ message: "Seat check failed" });

        const { max_seats, usedSeats } = rows[0];

        if (max_seats > 0 && usedSeats >= max_seats) {
          return res.status(403).json({ message: "Event is full" });
        }

        db.query(
          `INSERT INTO event_registrations
           (event_id,user_id,student_name,register_no,department,reg_code,payment_id)
           VALUES (?,?,?,?,?,?,?)`,
          [
            req.params.id,
            req.user.id,
            studentName,
            registerNo,
            department,
            regCode,
            razorpay_payment_id,
          ],
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
// ← THIS closes seat-check query
});

/* ================= QR VERIFY ================= */
app.get("/api/verify/:code", (req, res) => {
  db.query(
    "UPDATE event_registrations SET verified=1 WHERE reg_code=?",
    [req.params.code],
    () => res.send("<h2>Attendance Verified ✅</h2>")
  );
});

/* ================= ADMIN ================= */
app.get("/api/admin/events", auth, (_, res) => res.json([]));

/* ================= SERVER ================= */
app.listen(5001, () => {
  console.log("✅ Backend running on port 5001");
});
