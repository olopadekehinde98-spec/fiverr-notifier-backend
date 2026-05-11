require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { initWebSocket } = require('./websocket');
const authRoutes = require('./routes/auth');
const { handlePubSubPush } = require('./services/pubsub');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use('/auth', authRoutes);

// Gmail Pub/Sub push — no rate limit, Google calls this
app.post('/pubsub/push', handlePubSubPush);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Test endpoint — fires a fake Fiverr notification to all connected clients
app.get('/test', (req, res) => {
  const { broadcast } = require('./websocket');
  broadcast({
    type: 'fiverr_email',
    summary: 'New order from buyer john99 — Logo Design · $75',
    subject: 'New Order Received',
    account: 'test@fiverr.com',
    timestamp: new Date().toISOString(),
  });
  res.json({ ok: true, message: 'Test notification sent!' });
});

const server = http.createServer(app);
initWebSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Fiverr Notifier backend running on port ${PORT}`);
});
