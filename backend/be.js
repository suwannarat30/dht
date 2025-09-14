const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// เก็บค่าล่าสุดจาก ESP32
let latestData = { temperature: null, humidity: null };

// HTTP endpoint สำหรับ ESP32 POST ข้อมูล
app.post('/temperature', (req, res) => {
  const data = req.body;
  if (data.temperature !== undefined && data.humidity !== undefined) {
    latestData = { temperature: data.temperature, humidity: data.humidity };
    console.log('Received:', latestData);
    res.send('OK');
  } else {
    res.status(400).send('Invalid data');
  }
});

// HTTP endpoint สำหรับเว็บเพจ GET ข้อมูลล่าสุด
app.get('/temperature', (req, res) => {
  if (latestData.temperature !== null && latestData.humidity !== null) {
    res.json(latestData);
  } else {
    res.status(204).send(); // No Content
  }
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
