// backend/be.js (Polling + MongoDB logging)
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Mongo config via env =====
// Use process.env to access environment variables loaded by dotenv
const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME;
const COLLECTION = process.env.COLLECTION_NAME;

let mongoClient;
let readingsCol;

// connect only once on boot
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

// ===== CORS (adjust origin to your real domain) =====
const ALLOW_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'https://dht-git-main-suwannarat30s-projects.vercel.app/', // Your Vercel frontend
]);

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOW_ORIGINS.has(origin)),
}));

app.use(express.json());

// Store the latest values in memory (for fast frontend display)
// and as a fallback if the DB is not ready
let latest = { temperature: null, humidity: null, at: null };

// ===== ESP32 POSTs data here =====
app.post('/temperature', async (req, res) => {
  let { temperature, humidity } = req.body || {};
  temperature = Number(temperature);
  humidity = Number(humidity);

  if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) {
    return res.status(400).json({ error: 'Invalid payload: need number temperature & humidity' });
  }

  const doc = { temperature, humidity, at: new Date() };
  latest = { temperature, humidity, at: Date.now() };

  console.log('Received:', latest);

  // Log to Mongo if connected
  if (readingsCol) {
    try {
      await readingsCol.insertOne(doc);
    } catch (e) {
      console.error('Mongo insert error:', e);
    }
  }

  res.json({ ok: true });
});

// ===== frontend polls for latest data =====
app.get('/data', async (_req, res) => {
  // If DB is available, get the "latest item" from DB (prevents value reset on app restart)
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
  // fallback: value from memory
  res.json(latest);
});

// ===== history endpoint for historical graph =====
// Example: GET /history?limit=200
app.get('/history', async (req, res) => {
  try {
    if (!readingsCol) return res.json([]);
    const limit = Math.min(Number(req.query.limit || 200), 2000);
    const docs = await readingsCol.find({})
      .sort({ at: -1 })
      .limit(limit)
      .toArray();
    // Reorder from oldest to newest for the graph
    res.json(docs.reverse());
  } catch (e) {
    console.error('/history error:', e);
    res.json([]);
  }
});

// Health check
app.get('/health', (_req, res) => res.send('ok'));

// Close connection gracefully on shutdown
process.on('SIGTERM', async () => {
  try { await mongoClient?.close(); } catch {}
  process.exit(0);
});

// ย้ายคำสั่ง app.listen() มาที่นี่
initMongo()
  .then(() => {
    app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
  })
  .catch(err => console.error('Mongo init error:', err));