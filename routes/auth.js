const express = require('express');
const { google } = require('googleapis');
const { storeTokens, setupGmailWatch } = require('../services/gmail');

const router = express.Router();

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Step 1: redirect user to Google consent screen
router.get('/connect', (req, res) => {
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    prompt: 'consent',
  });
  res.redirect(url);
});

// Step 2: Google redirects back here with auth code
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send(`OAuth error: ${error}`);
  if (!code) return res.status(400).send('Missing authorization code');

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress;

    await storeTokens(email, tokens);

    // Watch setup is non-fatal — tokens are stored even if this fails
    try {
      await setupGmailWatch(email, oauth2Client);
    } catch (watchErr) {
      console.error('Gmail watch setup failed (non-fatal):', watchErr.message);
    }

    const frontendUrl = 'https://elaborate-mooncake-c2b4fb.netlify.app';
    res.redirect(`${frontendUrl}?connected=true&email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error('Auth callback error:', err.message);
    res.status(500).send(`Authentication failed: ${err.message}`);
  }
});

// List connected accounts
router.get('/accounts', async (req, res) => {
  try {
    const { loadTokens } = require('../services/gmail');
    const tokens = await loadTokens();
    res.json({ accounts: Object.keys(tokens) });
  } catch {
    res.json({ accounts: [] });
  }
});

// Disconnect an account
router.delete('/accounts/:email', async (req, res) => {
  try {
    const { removeAccount } = require('../services/gmail');
    await removeAccount(req.params.email);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
