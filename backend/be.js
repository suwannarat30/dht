// backend/be.js
const express = require('express');
const cors = require('cors');
// const { MongoClient } = require('mongodb'); // ไม่ต้องใช้
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CORS =====
const ALLOW_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'https://dht-git-main-suwannarat30s-projects.vercel.app/',
]);

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOW_ORIGINS.has(origin)),
}));

app.use(express.json());

// ===== Store latest readings in memory =====
let latest = { temperature: null, humidity: null };

// ===== ESP32 POSTs data here =====
app.post('/temperature', (req, res) => {
  let { temperature, humidity } = req.body || {};
  temperature = Number(temperature);
  humidity = Number(humidity);

  if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) {
    return res.status(400).json({ error: 'Invalid payload: need number temperature & humidity' });
  }

  latest = { temperature, humidity };

  console.log('Received:', latest);

  res.json({ ok: true });
});

// ===== frontend polls latest data =====
app.get('/data', (_req, res) => {
  res.json(latest);
});

// ===== Hello World route =====
app.get('/', (req, res) => res.send('Hello World!'));

// ===== Health check =====
app.get('/health', (_req, res) => res.send('ok'));

// ===== Start server =====
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
