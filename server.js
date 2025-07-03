
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

let db;

(async () => {
  db = await open({ filename: './database.sqlite', driver: sqlite3.Database });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff TEXT,
      dealerName TEXT,
      date TEXT,
      mobile TEXT,
      issue TEXT,
      image TEXT,
      foc TEXT,
      status TEXT
    )
  `);
})();

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

app.post('/jobs', upload.single('image'), async (req, res) => {
  const { staff, dealerName, date, mobile, issue, foc, status } = req.body;
  const image = req.file ? req.file.filename : '';
  await db.run(
    `INSERT INTO jobs (staff, dealerName, date, mobile, issue, image, foc, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [staff, dealerName, date, mobile, issue, image, foc, status]
  );
  res.json({ success: true });
});

app.get('/jobs', async (req, res) => {
  const jobs = await db.all(`SELECT * FROM jobs ORDER BY id DESC`);
  res.json(jobs);
});

app.get('/jobs/:id', async (req, res) => {
  const job = await db.get(`SELECT * FROM jobs WHERE id = ?`, [req.params.id]);
  res.json(job);
});

app.put('/jobs/:id', upload.single('image'), async (req, res) => {
  const { staff, dealerName, date, mobile, issue, foc, status } = req.body;
  const existing = await db.get(`SELECT * FROM jobs WHERE id = ?`, [req.params.id]);
  let image = existing.image;
  if (req.file) {
    if (fs.existsSync(path.join('uploads', existing.image))) {
      fs.unlinkSync(path.join('uploads', existing.image));
    }
    image = req.file.filename;
  }
  await db.run(
    `UPDATE jobs SET staff = ?, dealerName = ?, date = ?, mobile = ?, issue = ?, image = ?, foc = ?, status = ?
     WHERE id = ?`,
    [staff, dealerName, date, mobile, issue, image, foc, status, req.params.id]
  );
  res.json({ success: true });
});

app.get('/export', async (req, res) => {
  const jobs = await db.all(`SELECT * FROM jobs`);
  const data = jobs.map(({ image, ...rest }) => rest);
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(data);
  xlsx.utils.book_append_sheet(wb, ws, 'Jobs');
  const filePath = 'jobs_export.xlsx';
  xlsx.writeFile(wb, filePath);
  res.download(filePath, () => fs.unlinkSync(filePath));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
