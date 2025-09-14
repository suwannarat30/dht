const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// ✅ เปิด CORS สำหรับทุก origin
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

let latestData = { temperature: null, humidity: null };

// HTTP POST endpoint จาก ESP32
app.post('/temperature', (req, res) => {
  const data = req.body;
  if (data.temperature !== undefined && data.humidity !== undefined) {
    latestData = { temperature: data.temperature, humidity: data.humidity };
    console.log('Received from ESP32:', latestData);
    res.send('OK');
  } else {
    console.warn('Invalid POST data:', data);
    res.status(400).send('Invalid data');
  }
});

// HTTP GET endpoint สำหรับเว็บเพจ
app.get('/temperature', (req, res) => {
  console.log('Web GET request received');
  if (latestData.temperature !== null && latestData.humidity !== null) {
    res.json(latestData);
  } else {
    console.log('No data yet');
    res.status(204).send();
  }
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
  console.log(`API GET: https://your-domain.com/temperature`);
  console.log(`API POST (ESP32): https://your-domain.com/temperature`);
});
