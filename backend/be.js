// backend/be.js  (Polling + MongoDB logging)
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Mongo config via env on Render =====
const MONGO_URI  = process.env.MONGODB_URI;          // ใส่บน Render
const DB_NAME    = process.env.DB_NAME || 'weather'; // ใส่บน Render (หรือใช้ค่า default)
const COLLECTION = process.env.COLLECTION_NAME || 'readings';

let mongoClient;
let readingsCol;

// connect เพียงครั้งเดียวตอนบูต
async function initMongo() {
  if (!MONGO_URI) {
    console.warn('MONGODB_URI not set. Mongo logging will be skipped.');
    return;
  }
  mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  const db = mongoClient.db(DB_NAME);
  readingsCol = db.collection(COLLECTION);
  await readingsCol.createIndex({ at: -1 });
  console.log(`Connected to MongoDB → db: ${DB_NAME}, col: ${COLLECTION}`);
}
initMongo().catch(err => console.error('Mongo init error:', err));

// ===== CORS (แก้ origin ตามโดเมนจริงของคุณ) =====
const ALLOW_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'https://dht-git-main-suwannarat30s-projects.vercel.app', // Vercel frontend ของคุณ
]);

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOW_ORIGINS.has(origin)),
}));

app.use(express.json());

// เก็บค่าล่าสุดไว้ในหน่วยความจำ (ให้ frontend แสดงเร็วๆ ได้)
let latest = { temperature: null, humidity: null, at: null };

// ===== ESP32 POST ข้อมูลเข้ามาที่นี่ =====
app.post('/temperature', async (req, res) => {
  let { temperature, humidity } = req.body || {};
  temperature = Number(temperature);
  humidity    = Number(humidity);

  if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) {
    return res.status(400).json({ error: 'Invalid payload: need number temperature & humidity' });
  }

  const doc = { temperature, humidity, at: new Date() };
  latest = { temperature, humidity, at: Date.now() };

  console.log('Received:', latest);

  // บันทึกลง Mongo ถ้าเชื่อมต่อแล้ว
  if (readingsCol) {
    try {
      await readingsCol.insertOne(doc);
    } catch (e) {
      console.error('Mongo insert error:', e);
    }
  }

  res.json({ ok: true });
});

// ===== frontend polling ล่าสุด =====
app.get('/data', async (_req, res) => {
  try {
    if (readingsCol) {
      const last = await readingsCol.find().sort({ at: -1 }).limit(1).next();
      if (last) {
        return res.json({
          temperature: last.temperature,
          humidity: last.humidity,
          at: last.at.getTime(),
        });
      }
    }
  } catch (e) {
    console.error('Mongo read error:', e);
  }
  res.json(latest);
});

// ===== history endpoint สำหรับกราฟย้อนหลัง =====
app.get('/history', async (req, res) => {
  try {
    if (!readingsCol) return res.json([]);
    const limit = Math.min(Number(req.query.limit || 200), 2000);
    const docs = await readingsCol.find({})
      .sort({ at: -1 })
      .limit(limit)
      .toArray();
    res.json(docs.reverse()); // เรียงเวลาเก่า→ใหม่
  } catch (e) {
    console.error('/history error:', e);
    res.json([]);
  }
});

// Health check
app.get('/health', (_req, res) => res.send('ok'));

// ปิด connection ให้เรียบร้อยตอนหยุด
process.on('SIGTERM', async () => {
  try { await mongoClient?.close(); } catch {}
  process.exit(0);
});

app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
