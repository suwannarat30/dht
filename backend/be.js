const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000; // Render จะกำหนด PORT เอง

app.use(cors());
app.use(bodyParser.json());

// เก็บค่าล่าสุดสำหรับ HTTP GET fallback
let latestData = { temperature: 0, humidity: 0 };

// สร้าง HTTP server เดียวสำหรับทั้ง Express และ WS
const server = http.createServer(app);

// ผูก WebSocket เข้ากับ HTTP server เดียวกัน
const wss = new WebSocket.Server({ server });

// HTTP endpoint สำหรับ ESP32 POST
app.post('/temperature', (req, res) => {
  const data = req.body;
  latestData = data; // เก็บค่าล่าสุด
  console.log('Received:', data);

  // ส่งข้อมูลไป WebSocket client ทุกตัวที่เชื่อมต่อ
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });

  res.send('OK');
});

// HTTP GET endpoint สำหรับหน้าเว็บ fetch fallback
app.get('/temperature', (req, res) => {
  res.json(latestData);
});

// Start server (Express + WebSocket)
server.listen(port, () => {
  console.log(`Backend + WebSocket running on port ${port}`);
});
