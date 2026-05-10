const { WebSocketServer } = require('ws');

let wss;
const clients = new Set();

function initWebSocket(server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`Client connected. Total: ${clients.size}`);

    // Heartbeat — keeps connection alive on mobile browsers
    const ping = setInterval(() => {
      if (ws.readyState === ws.OPEN) ws.ping();
    }, 30000);

    ws.on('close', () => {
      clients.delete(ws);
      clearInterval(ping);
      console.log(`Client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', () => {
      clients.delete(ws);
      clearInterval(ping);
    });
  });
}

function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(message);
  });
}

module.exports = { initWebSocket, broadcast };
