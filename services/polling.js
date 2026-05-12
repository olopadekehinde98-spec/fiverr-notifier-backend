const { google } = require('googleapis');
const { loadTokens, storeTokens } = require('./gmail');
const { isFiverrEmail, extractEmailData } = require('./filter');
const { generateSummary } = require('./claude');
const { broadcast } = require('../websocket');

// Track message IDs we've already processed (in-memory — resets on server restart, that's fine)
const seenIds = new Set();
const INTERVAL_MS = 60 * 1000;

function buildAuthClient(tokens) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials(tokens);
  return client;
}

async function pollAccount(email, tokens) {
  const authClient = buildAuthClient(tokens);

  // Persist any refreshed tokens automatically
  authClient.on('tokens', async (newTokens) => {
    if (newTokens.refresh_token) {
      const all = await loadTokens();
      all[email] = { ...tokens, ...newTokens };
      await storeTokens(email, all[email]);
    }
  });

  const gmail = google.gmail({ version: 'v1', auth: authClient });

  // Get Fiverr emails from the last 2 minutes (safe window for 1-min polling)
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:fiverr newer_than:2m',
    maxResults: 10,
  });

  const msgs = listRes.data.messages || [];
  if (msgs.length === 0) return;

  for (const { id } of msgs) {
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const full = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    if (!isFiverrEmail(full.data)) continue;

    const emailData = extractEmailData(full.data);
    const summary = await generateSummary(emailData);

    broadcast({
      type: 'fiverr_email',
      account: email,
      timestamp: new Date().toISOString(),
      summary,
      subject: emailData.subject,
      from: emailData.from,
    });

    console.log(`[Poll] Fiverr email for ${email}: ${summary}`);
  }
}

async function pollAll() {
  const tokens = await loadTokens();
  const accounts = Object.keys(tokens);
  if (accounts.length === 0) return;

  for (const email of accounts) {
    try {
      await pollAccount(email, tokens[email]);
    } catch (err) {
      console.error(`[Poll] Error for ${email}:`, err.message);
    }
  }
}

function startPolling() {
  console.log('Gmail polling started — checking every 60 seconds');
  pollAll();
  setInterval(pollAll, INTERVAL_MS);
}

module.exports = { startPolling };
