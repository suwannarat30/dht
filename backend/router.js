// backend/router.js

const express = require('express');
const router = express.Router();

// ===== ESP32 POSTs data here =====
router.post('/temperature', async (req, res) => {
  let { temperature, humidity } = req.body || {};
  temperature = Number(temperature);
  humidity = Number(humidity);

  if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) {
    return res.status(400).json({ error: 'Invalid payload: need number temperature & humidity' });
  }

  const doc = { temperature, humidity, at: new Date() };
  latest = { temperature, humidity, at: Date.now() };

  console.log('Received:', latest);

  if (readingsCol) {
    try { await readingsCol.insertOne(doc); }
    catch (e) { console.error('Mongo insert error:', e); }
  }

  res.json({ ok: true });
});

// ===== frontend polls latest data =====
router.get('/data', async (_req, res) => {
  try {
    if (readingsCol) {
      const last = await readingsCol.find().sort({ at: -1 }).limit(1).next();
      if (last) return res.json({
        temperature: last.temperature,
        humidity: last.humidity,
        at: last.at.getTime(),
      });
    }
  } catch (e) { console.error('Mongo read error:', e); }
  res.json(latest);
});

// ===== history endpoint =====
router.get('/history', async (req, res) => {
  try {
    if (!readingsCol) return res.json([]);
    const limit = Math.min(Number(req.query.limit || 200), 2000);
    const docs = await readingsCol.find({})
      .sort({ at: -1 })
      .limit(limit)
      .toArray();
    res.json(docs.reverse());
  } catch (e) { console.error('/history error:', e); res.json([]); }
});

// Health check
router.get('/health', (_req, res) => res.send('ok'));

// อย่าลืม export router
module.exports = router;