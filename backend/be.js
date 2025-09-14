// backend/be.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// ===== Mongo config via env =====
const MONGO_URI  = process.env.MONGODB_URI;
const DB_NAME    = process.env.DB_NAME || 'weather';
const COLLECTION = process.env.COLLECTION_NAME || 'readings';

let mongoClient;
let readingsCol;

// connect MongoDB ตอนบูต
async function initMongo() {
  if (!MONGO_URI) {
    console.warn('MONGODB_URI not set. Mongo logging skipped.');
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

// ===== CORS =====
const ALLOW_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'https://dht-git-main-suwannarat30s-projects.vercel.app',
]);

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOW_ORIGINS.has(origin)),
}));
app.use(bodyParser.json());

// ===== HTTP server (Express + WS) =====
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// เก็บค่าล่าสุด
let latest = { temperature: null, humidity: null, at: null };

// ===== ESP32 POST =====
app.post('/temperature', async (req, res) => {
  let { temperature, humidity } = req.body || {};
  temperature = Number(temperature);
  humidity    = Number(humidity);

  if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const doc = { temperature, humidity, at: new Date() };
  latest = { temperature, humidity, at: Date.now() };

  console.log('Received:', latest);

  // broadcast ผ่าน WS
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(latest));
    }
  });

  // insert MongoDB
  if (readingsCol) {
    try {
      await readingsCol.insertOne(doc);
    } catch (e) {
      console.error('Mongo insert error:', e);
    }
  }

  res.json({ ok: true });
});

// ===== polling endpoint ล่าสุด =====
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

// ===== history endpoint =====
app.get('/history', async (req, res) => {
  try {
    if (!readingsCol) return res.json([]);
    const limit = Math.min(Number(req.query.limit || 200), 2000);
    const docs = await readingsCol.find({})
      .sort({ at: -1 })
      .limit(limit)
      .toArray();
    res.json(docs.reverse());
  } catch (e) {
    console.error('/history error:', e);
    res.json([]);
  }
});

// health check
app.get('/health', (_req, res) => res.send('ok'));

// ปิด connection ตอน stop
process.on('SIGTERM', async () => {
  try { await mongoClient?.close(); } catch {}
  process.exit(0);
});

// Start server
server.listen(port, () => {
  console.log(`Backend + WS + Mongo running on port ${port}`);
});
