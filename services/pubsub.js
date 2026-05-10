const { getNewMessages } = require('./gmail');
const { isFiverrEmail, extractEmailData } = require('./filter');
const { generateSummary } = require('./claude');
const { broadcast } = require('../websocket');

async function handlePubSubPush(req, res) {
  // Respond immediately — Pub/Sub retries if we don't respond within 10s
  res.status(200).send('OK');

  try {
    const message = req.body?.message;
    if (!message?.data) return;

    const decoded = JSON.parse(Buffer.from(message.data, 'base64').toString('utf-8'));
    const { emailAddress, historyId } = decoded;

    if (!emailAddress || !historyId) return;

    const messages = await getNewMessages(emailAddress, historyId);

    for (const msg of messages) {
      if (!isFiverrEmail(msg)) continue;

      const emailData = extractEmailData(msg);
      const summary = await generateSummary(emailData);

      broadcast({
        type: 'fiverr_email',
        account: emailAddress,
        timestamp: new Date().toISOString(),
        summary,
        subject: emailData.subject,
        from: emailData.from,
      });

      console.log(`Fiverr email for ${emailAddress}: ${summary}`);
    }
  } catch (err) {
    console.error('Pub/Sub handler error:', err.message);
  }
}

module.exports = { handlePubSubPush };
