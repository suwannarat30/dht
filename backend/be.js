const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000; // Render จะกำหนด PORT เอง

app.use(cors());
app.use(bodyParser.json());

// เก็บค่าล่าสุดสำหรับ GET fallback
let latestData = { temperature: 0, humidity: 0 };

// สร้าง HTTP server เดียวสำหรับ Express + WS
const server = http.createServer(app);

// สร้าง WebSocket server
const wss = new WebSocket.Server({ server });

// POST endpoint สำหรับ ESP32
app.post('/temperature', (req, res) => {
  const data = req.body;
  latestData = data; // เก็บค่าล่าสุด
  console.log('Received:', data);

  // ส่งข้อมูลไป WebSocket clients
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });

  res.send('OK');
});

// GET endpoint สำหรับหน้าเว็บ fetch fallback
app.get('/temperature', (req, res) => {
  res.json(latestData);
});

// Start server
server.listen(port, () => {
  console.log(`Backend + WebSocket running on port ${port}`);
});
