const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000; // Render จะกำหนด PORT เอง

app.use(cors());
app.use(bodyParser.json());

// สร้าง HTTP server เดียวสำหรับทั้ง Express และ WS
const server = http.createServer(app);

// ผูก WebSocket เข้ากับ HTTP server เดียวกัน
const wss = new WebSocket.Server({ server });

// HTTP endpoint สำหรับ ESP32
app.post('/temperature', (req, res) => {
  const data = req.body;
  console.log('Received:', data);

  // ส่งข้อมูลไปยังทุก client ที่เชื่อมต่อผ่าน WS
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });

  res.send('OK');
});

// Start server (Express + WS)
server.listen(port, () => {
  console.log(`Backend + WebSocket running on port ${port}`);
});
